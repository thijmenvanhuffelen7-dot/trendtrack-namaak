import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Ververst de Supabase-sessie en schermt /app en /admin af voor niet-ingelogde bezoekers.
 * Of iemand admin is controleert de admin-layout zelf (profiles.is_admin).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = /^\/(app|admin|login)(\/|$)/.test(pathname);
  if (!isProtected) return withReferral(request, NextResponse.next({ request }));

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

  const { search } = request.nextUrl;
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
  return withReferral(request, response);
}

/** Affiliate-link (?ref=code): 30 dagen onthouden; checkoutAction zet hem in de Stripe-metadata. */
function withReferral(request: NextRequest, response: NextResponse) {
  const ref = request.nextUrl.searchParams.get("ref")?.toLowerCase();
  if (ref && /^[a-z0-9_-]{3,40}$/.test(ref) && !request.cookies.get("ref")) {
    response.cookies.set("ref", ref, {
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      path: "/",
    });
  }
  return response;
}

export const config = {
  // Node.js in plaats van Edge: Vercel-services ondersteunen geen Edge Functions (sinds Next 15.5 stabiel).
  runtime: "nodejs",
  // Alles behalve statische bestanden en API-routes.
  matcher: ["/((?!_next/|api/|mcp|oauth/token|oauth/register|.*\\.[a-z0-9]+$).*)"],
};
