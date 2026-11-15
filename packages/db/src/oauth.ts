import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Db } from "./client";

/**
 * Minimale OAuth 2.1-autorisatieserver voor de MCP-server (MCP Authorization spec):
 * dynamic client registration (RFC 7591), authorization code + PKCE S256, refresh-token-rotatie.
 * Alleen publieke clients (geen client secret); PKCE is verplicht.
 */

export const ACCESS_TOKEN_TTL_S = 60 * 60;
export const REFRESH_TOKEN_TTL_S = 30 * 24 * 60 * 60;
const CODE_TTL_S = 5 * 60;

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const random = (prefix: string) => prefix + randomBytes(32).toString("base64url");

export class OAuthError extends Error {
  constructor(
    readonly error:
      | "invalid_request"
      | "invalid_client"
      | "invalid_grant"
      | "unsupported_grant_type"
      | "invalid_client_metadata"
      | "invalid_redirect_uri",
    readonly description: string,
  ) {
    super(description);
  }
}

/** Alleen https, of http op localhost (ontwikkeltools). Geen fragmenten. */
export function isAllowedRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    if (u.protocol === "https:") return true;
    return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

/** PKCE S256: base64url(sha256(verifier)) === challenge. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const computed = createHash("sha256").update(verifier).digest("base64url");
  const a = Buffer.from(computed);
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function registerClient(
  serviceDb: Db,
  input: { client_name?: string; redirect_uris?: unknown },
) {
  const uris = Array.isArray(input.redirect_uris)
    ? input.redirect_uris.filter((u): u is string => typeof u === "string")
    : [];
  if (uris.length === 0 || uris.length > 10)
    throw new OAuthError("invalid_redirect_uri", "Geef 1 tot 10 redirect_uris");
  const bad = uris.find((u) => !isAllowedRedirectUri(u));
  if (bad) throw new OAuthError("invalid_redirect_uri", `Redirect-URI niet toegestaan: ${bad}`);
  const client = {
    client_id: random("ttc_"),
    client_name: (input.client_name ?? "MCP-client").toString().slice(0, 100),
    redirect_uris: uris,
  };
  const { error } = await serviceDb.from("oauth_clients").insert(client);
  if (error) throw error;
  return client;
}

export async function getClient(serviceDb: Db, clientId: string) {
  const { data } = await serviceDb
    .from("oauth_clients")
    .select("client_id, client_name, redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();
  return data;
}

export async function createAuthorizationCode(
  serviceDb: Db,
  input: {
    clientId: string;
    workspaceId: string;
    userId: string;
    redirectUri: string;
    codeChallenge: string;
    scope?: string;
    resource?: string | null;
  },
) {
  const code = random("ttcode_");
  const { error } = await serviceDb.from("oauth_codes").insert({
    code_hash: sha256(code),
    client_id: input.clientId,
    workspace_id: input.workspaceId,
    user_id: input.userId,
    redirect_uri: input.redirectUri,
    code_challenge: input.codeChallenge,
    scope: input.scope ?? "mcp",
    resource: input.resource ?? null,
    expires_at: new Date(Date.now() + CODE_TTL_S * 1000).toISOString(),
  });
  if (error) throw error;
  return code;
}

async function issueTokens(
  serviceDb: Db,
  t: { clientId: string; workspaceId: string; userId: string; scope: string },
) {
  const access = random("tt_oat_");
  const refresh = random("tt_ort_");
  const now = Date.now();
  const rows = [
    {
      token_hash: sha256(access),
      kind: "access",
      expires_at: new Date(now + ACCESS_TOKEN_TTL_S * 1000).toISOString(),
    },
    {
      token_hash: sha256(refresh),
      kind: "refresh",
      expires_at: new Date(now + REFRESH_TOKEN_TTL_S * 1000).toISOString(),
    },
  ].map((r) => ({
    ...r,
    client_id: t.clientId,
    workspace_id: t.workspaceId,
    user_id: t.userId,
    scope: t.scope,
  }));
  const { error } = await serviceDb.from("oauth_tokens").insert(rows);
  if (error) throw error;
  return {
    access_token: access,
    token_type: "Bearer" as const,
    expires_in: ACCESS_TOKEN_TTL_S,
    refresh_token: refresh,
    scope: t.scope,
  };
}

/** grant_type=authorization_code */
export async function exchangeCode(
  serviceDb: Db,
  p: { code: string; clientId: string; redirectUri: string; codeVerifier: string },
) {
  const { data: row } = await serviceDb
    .from("oauth_codes")
    .select("*")
    .eq("code_hash", sha256(p.code))
    .maybeSingle();
  if (!row || row.used_at || Date.parse(row.expires_at) < Date.now())
    throw new OAuthError("invalid_grant", "Code ongeldig, verlopen of al gebruikt");
  // Eenmalig: markeer als gebruikt vóór we tokens uitgeven.
  const { data: claimed } = await serviceDb
    .from("oauth_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code_hash", row.code_hash)
    .is("used_at", null)
    .select("code_hash");
  if (!claimed?.length) throw new OAuthError("invalid_grant", "Code al gebruikt");
  if (row.client_id !== p.clientId)
    throw new OAuthError("invalid_grant", "Code hoort bij een andere client");
  if (row.redirect_uri !== p.redirectUri)
    throw new OAuthError("invalid_grant", "redirect_uri komt niet overeen");
  if (!verifyPkce(p.codeVerifier, row.code_challenge))
    throw new OAuthError("invalid_grant", "PKCE-controle mislukt");
  return issueTokens(serviceDb, {
    clientId: row.client_id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    scope: row.scope,
  });
}

/** grant_type=refresh_token, met rotatie: het oude refresh-token vervalt. */
export async function refreshTokens(serviceDb: Db, p: { refreshToken: string; clientId: string }) {
  const hash = sha256(p.refreshToken);
  const { data: row } = await serviceDb
    .from("oauth_tokens")
    .select("*")
    .eq("token_hash", hash)
    .eq("kind", "refresh")
    .maybeSingle();
  if (
    !row ||
    row.revoked_at ||
    Date.parse(row.expires_at) < Date.now() ||
    row.client_id !== p.clientId
  ) {
    throw new OAuthError("invalid_grant", "Refresh-token ongeldig of verlopen");
  }
  const { data: claimed } = await serviceDb
    .from("oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", hash)
    .is("revoked_at", null)
    .select("token_hash");
  if (!claimed?.length) throw new OAuthError("invalid_grant", "Refresh-token al gebruikt");
  return issueTokens(serviceDb, {
    clientId: row.client_id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    scope: row.scope,
  });
}

/** Controleert een OAuth-access-token. Null als ongeldig, verlopen of ingetrokken. */
export async function verifyAccessToken(
  serviceDb: Db,
  token: string,
): Promise<{ workspaceId: string; userId: string; clientId: string } | null> {
  if (!token.startsWith("tt_oat_")) return null;
  const { data } = await serviceDb
    .from("oauth_tokens")
    .select("workspace_id, user_id, client_id, expires_at, revoked_at, last_used_at, token_hash")
    .eq("token_hash", sha256(token))
    .eq("kind", "access")
    .maybeSingle();
  if (!data || data.revoked_at || Date.parse(data.expires_at) < Date.now()) return null;
  if (!data.last_used_at || Date.now() - Date.parse(data.last_used_at) > 60_000) {
    await serviceDb
      .from("oauth_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("token_hash", data.token_hash);
  }
  return { workspaceId: data.workspace_id, userId: data.user_id, clientId: data.client_id };
}

/** Verbonden apps van een workspace (voor de MCP-pagina) en intrekken. */
export async function listConnectedClients(serviceDb: Db, workspaceId: string) {
  const { data, error } = await serviceDb
    .from("oauth_tokens")
    .select("client_id, last_used_at, created_at, oauth_clients!inner(client_name)")
    .eq("workspace_id", workspaceId)
    .eq("kind", "refresh")
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  const seen = new Map<string, { clientId: string; name: string; since: string }>();
  for (const r of data)
    if (!seen.has(r.client_id))
      seen.set(r.client_id, {
        clientId: r.client_id,
        name: r.oauth_clients.client_name,
        since: r.created_at,
      });
  return [...seen.values()];
}

export async function revokeClient(serviceDb: Db, workspaceId: string, clientId: string) {
  const { error } = await serviceDb
    .from("oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("client_id", clientId)
    .is("revoked_at", null);
  if (error) throw error;
}
