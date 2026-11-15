import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/server/session";
import { createUserClient } from "@/lib/supabase/server";

const TYPES = new Set(["email", "magiclink", "signup", "recovery", "invite"]);

/** Magic link uit de mail: /auth/confirm?token_hash=...&type=email */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "email";
  const target = request.nextUrl.clone();
  target.search = "";

  if (tokenHash && TYPES.has(type)) {
    const db = await createUserClient();
    const { error } = await db.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (!error) {
      const [path, query] = safeNext(searchParams.get("next")).split("?");
      target.pathname = path!;
      target.search = query ? `?${query}` : "";
      return NextResponse.redirect(target);
    }
  }
  target.pathname = "/login";
  target.search = "?error=link";
  return NextResponse.redirect(target);
}
