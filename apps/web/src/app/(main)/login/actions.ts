"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext, siteUrl } from "@/lib/server/session";
import { createUserClient } from "@/lib/supabase/server";

export interface LoginState {
  status: "idle" | "sent" | "error";
  email?: string;
}

const Schema = z.object({ email: z.email().max(254), next: z.string().optional() });

export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = Schema.safeParse({
    email: String(form.get("email") ?? "").trim(),
    next: form.get("next") ?? undefined,
  });
  if (!parsed.success) return { status: "error" };
  const db = await createUserClient();
  const origin = siteUrl(await headers());
  const next = safeNext(parsed.data.next);
  const { error } = await db.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
    },
  });
  if (error) {
    console.error("[login]", error.message);
    return { status: "error", email: parsed.data.email };
  }
  return { status: "sent", email: parsed.data.email };
}

export async function signInWithGoogle(form: FormData) {
  const db = await createUserClient();
  const origin = siteUrl(await headers());
  const next = safeNext(String(form.get("next") ?? ""));
  const { data, error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}
