import "server-only";
import { getWorkspaceForUser } from "@trendtrack/db";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createUserClient } from "@/lib/supabase/server";

/**
 * De ingelogde gebruiker met zijn workspace. Stuurt door naar /login als er geen sessie is.
 * `db` leest met de rechten van de gebruiker (RLS); schrijven gaat via serviceDb() na deze check.
 */
export const getSession = cache(async () => {
  const db = await createUserClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");

  const [workspace, profile] = await Promise.all([
    getWorkspaceForUser(db, user.id),
    db
      .from("profiles")
      .select("email, full_name, locale, is_admin")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  if (!workspace) throw new Error("Geen workspace gevonden voor deze gebruiker");
  return {
    db,
    user: { id: user.id, email: user.email ?? profile.data?.email ?? "" },
    workspace,
    isAdmin: profile.data?.is_admin ?? false,
  };
});

/** Site-URL voor redirects in mails en OAuth. */
export function siteUrl(headers: Headers): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  const proto =
    headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Alleen interne paden als redirect-doel (geen open redirect). */
export function safeNext(next: string | null | undefined, fallback = "/app"): string {
  return next && /^\/(?!\/)[\w\-./?=&%[\]]*$/.test(next) ? next : fallback;
}
