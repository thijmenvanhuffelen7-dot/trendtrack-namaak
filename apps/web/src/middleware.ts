import { NextResponse, type NextRequest } from "next/server";

/**
 * Tijdelijke beveiliging van /admin met Basic auth (ADMIN_PASSWORD).
 * Vanaf Prompt 8 (Supabase Auth) vervangen door een check op profiles.is_admin.
 * Zonder ADMIN_PASSWORD bestaat /admin niet (404).
 */
export function middleware(req: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return new NextResponse("Not found", { status: 404 });

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const given = decoded.slice(decoded.indexOf(":") + 1);
    if (constantTimeEqual(given, password)) return NextResponse.next();
  }
  return new NextResponse("Authenticatie vereist", {
    status: 401,
    headers: { "www-authenticate": 'Basic realm="TrendTrack admin", charset="UTF-8"' },
  });
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
