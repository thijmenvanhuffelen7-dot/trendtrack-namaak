import { getClient, isAllowedRedirectUri, type Db } from "@trendtrack/db";

export interface AuthorizeRequest {
  clientId: string;
  clientName: string;
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
  scope: string;
  resource: string | null;
}

/**
 * Controleert een /oauth/authorize-verzoek. Bij een onbekende client of redirect-URI tonen we
 * een fout en sturen we NIET door (anders kan iemand de server als open redirect misbruiken).
 */
export async function validateAuthorize(
  serviceDb: Db,
  sp: Record<string, string | undefined>,
): Promise<{ ok: true; req: AuthorizeRequest } | { ok: false; message: string }> {
  if (sp.response_type !== "code") return { ok: false, message: "response_type moet 'code' zijn" };
  if (!sp.client_id) return { ok: false, message: "client_id ontbreekt" };
  const client = await getClient(serviceDb, sp.client_id);
  if (!client)
    return { ok: false, message: "Onbekende client. Registreer eerst via /oauth/register." };
  const redirectUri =
    sp.redirect_uri ?? (client.redirect_uris.length === 1 ? client.redirect_uris[0] : undefined);
  if (
    !redirectUri ||
    !client.redirect_uris.includes(redirectUri) ||
    !isAllowedRedirectUri(redirectUri)
  ) {
    return { ok: false, message: "redirect_uri hoort niet bij deze client" };
  }
  if (!sp.code_challenge || sp.code_challenge_method !== "S256")
    return { ok: false, message: "PKCE (code_challenge met S256) is verplicht" };
  if (!/^[A-Za-z0-9_-]{43}$/.test(sp.code_challenge))
    return { ok: false, message: "Ongeldige code_challenge" };
  return {
    ok: true,
    req: {
      clientId: client.client_id,
      clientName: client.client_name,
      redirectUri,
      codeChallenge: sp.code_challenge,
      state: sp.state ?? null,
      scope: "mcp",
      resource: sp.resource ?? null,
    },
  };
}

export function redirectWith(uri: string, params: Record<string, string | null>) {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v !== null) u.searchParams.set(k, v);
  return u.toString();
}
