import { buildOpenApi } from "@/lib/api/openapi";

/** Publieke OpenAPI-spec (geen key nodig). */
export function GET(req: Request) {
  return Response.json(buildOpenApi(new URL(req.url).origin), {
    headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=300" },
  });
}
