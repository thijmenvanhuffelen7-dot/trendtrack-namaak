import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Ververst de Supabase-sessie en schermt /app en /admin af voor niet-ingelogde bezoekers.
 * Of iemand admin is controleert de admin-layout zelf (profiles.is_admin).
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  if (!user && pathname !== "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if (user && pathname === "/login") {
    const next = request.nextUrl.searchParams.get("next");
    const target = next && /^\/(?!\/)/.test(next) ? next : "/app";
    return NextResponse.redirect(new URL(target, request.url));
  }
  return response;
}

export const config = { matcher: ["/app", "/app/:path*", "/admin", "/admin/:path*", "/login"] };
