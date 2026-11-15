import { OAuthError, registerClient } from "@trendtrack/db";
import { oauthJson, preflight } from "@/lib/oauth/cors";
import { serviceDb } from "@/lib/server/db";

/** RFC 7591: dynamic client registration. Alleen publieke clients (PKCE, geen secret). */
export async function POST(req: Request) {
  let body: { client_name?: string; redirect_uris?: unknown };
  try {
    body = await req.json();
  } catch {
    return oauthJson(
      { error: "invalid_client_metadata", error_description: "Body moet JSON zijn" },
      400,
    );
  }
  try {
    const c = await registerClient(serviceDb(), body);
    return oauthJson(
      {
        client_id: c.client_id,
        client_name: c.client_name,
        redirect_uris: c.redirect_uris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        client_id_issued_at: Math.floor(Date.now() / 1000),
      },
      201,
    );
  } catch (err) {
    if (err instanceof OAuthError)
      return oauthJson({ error: err.error, error_description: err.description }, 400);
    console.error("[oauth register]", err);
    return oauthJson({ error: "server_error" }, 500);
  }
}

export const OPTIONS = preflight;
