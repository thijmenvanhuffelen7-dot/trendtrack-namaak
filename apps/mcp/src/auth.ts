import { verifyAccessToken, verifyApiKey, type Db } from "@trendtrack/db";

export interface AuthResult {
  workspaceId: string;
  userId: string | null;
  via: "api_key" | "oauth";
}

/** Bearer-token: een API-key (tt_live_...) of een OAuth-access-token (tt_oat_...). */
export async function authenticate(
  db: Db,
  authorization: string | undefined,
): Promise<AuthResult | null> {
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  if (token.startsWith("tt_live_")) {
    const k = await verifyApiKey(db, token);
    return k ? { workspaceId: k.workspaceId, userId: null, via: "api_key" } : null;
  }
  const t = await verifyAccessToken(db, token);
  return t ? { workspaceId: t.workspaceId, userId: t.userId, via: "oauth" } : null;
}
