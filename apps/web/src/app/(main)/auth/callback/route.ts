import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/server/session";
import { createUserClient } from "@/lib/supabase/server";

/** OAuth (Google) en PKCE: /auth/callback?code=... */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const target = request.nextUrl.clone();
  target.search = "";
  if (code) {
    const db = await createUserClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) {
      const [path, query] = safeNext(searchParams.get("next")).split("?");
      target.pathname = path!;
      target.search = query ? `?${query}` : "";
      return NextResponse.redirect(target);
    }
  }
  target.pathname = "/login";
  target.search = "?error=oauth";
  return NextResponse.redirect(target);
}
