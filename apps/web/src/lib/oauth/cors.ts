/** OAuth-endpoints worden ook vanuit browsers aangeroepen (bv. MCP Inspector): open CORS, geen cookies. */
export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, mcp-protocol-version",
  "access-control-max-age": "86400",
};

export const preflight = () => new Response(null, { status: 204, headers: CORS });

export function oauthJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { ...CORS, "cache-control": "no-store", pragma: "no-cache" },
  });
}

export function issuer(req: Request): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin).replace(/\/$/, "");
}
