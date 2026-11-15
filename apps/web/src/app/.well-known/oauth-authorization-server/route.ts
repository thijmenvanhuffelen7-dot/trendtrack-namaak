import { CORS, issuer, preflight } from "@/lib/oauth/cors";

/** RFC 8414: metadata van de autorisatieserver (gebruikt door MCP-clients zoals Claude). */
export function GET(req: Request) {
  const iss = issuer(req);
  return Response.json(
    {
      issuer: iss,
      authorization_endpoint: `${iss}/oauth/authorize`,
      token_endpoint: `${iss}/oauth/token`,
      registration_endpoint: `${iss}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["mcp"],
      service_documentation: `${iss}/app/mcp`,
    },
    { headers: { ...CORS, "cache-control": "public, max-age=300" } },
  );
}

export const OPTIONS = preflight;
