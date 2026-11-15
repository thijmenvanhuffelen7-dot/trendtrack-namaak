import { exchangeCode, OAuthError, refreshTokens } from "@trendtrack/db";
import { oauthJson, preflight } from "@/lib/oauth/cors";
import { serviceDb } from "@/lib/server/db";

/** Token-endpoint: authorization_code (met PKCE) en refresh_token (met rotatie). */
export async function POST(req: Request) {
  const type = req.headers.get("content-type") ?? "";
  let p: Record<string, string>;
  try {
    p = type.includes("application/json")
      ? await req.json()
      : Object.fromEntries(new URLSearchParams(await req.text()));
  } catch {
    return oauthJson({ error: "invalid_request", error_description: "Ongeldige body" }, 400);
  }
  try {
    if (p.grant_type === "authorization_code") {
      if (!p.code || !p.client_id || !p.redirect_uri || !p.code_verifier)
        throw new OAuthError(
          "invalid_request",
          "code, client_id, redirect_uri en code_verifier zijn verplicht",
        );
      return oauthJson(
        await exchangeCode(serviceDb(), {
          code: p.code,
          clientId: p.client_id,
          redirectUri: p.redirect_uri,
          codeVerifier: p.code_verifier,
        }),
      );
    }
    if (p.grant_type === "refresh_token") {
      if (!p.refresh_token || !p.client_id)
        throw new OAuthError("invalid_request", "refresh_token en client_id zijn verplicht");
      return oauthJson(
        await refreshTokens(serviceDb(), { refreshToken: p.refresh_token, clientId: p.client_id }),
      );
    }
    throw new OAuthError("unsupported_grant_type", "Alleen authorization_code en refresh_token");
  } catch (err) {
    if (err instanceof OAuthError)
      return oauthJson({ error: err.error, error_description: err.description }, 400);
    console.error("[oauth token]", err);
    return oauthJson({ error: "server_error" }, 500);
  }
}

export const OPTIONS = preflight;
