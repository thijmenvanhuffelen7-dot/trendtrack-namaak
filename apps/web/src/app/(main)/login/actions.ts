"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext, siteUrl } from "@/lib/server/session";
import { createUserClient } from "@/lib/supabase/server";

export interface LoginState {
  status: "idle" | "sent" | "error" | "confirm";
  email?: string;
  /** Sleutel in messages/*.json → login.errors.* */
  error?: string;
}

const Email = z.email().max(254);
const Password = z.string().min(8).max(72);
const LinkSchema = z.object({ email: Email, next: z.string().optional() });
const PasswordSchema = z.object({
  email: Email,
  password: Password,
  mode: z.enum(["signin", "signup"]),
  next: z.string().optional(),
});

const read = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v : undefined;
};

/** Inloglink per mail (zonder wachtwoord). Vereist dat Supabase mail kan versturen (SMTP). */
export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = LinkSchema.safeParse({
    email: read(form, "email")?.trim(),
    next: read(form, "next"),
  });
  if (!parsed.success) return { status: "error", error: "invalidEmail" };
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
    console.error("[login] magic link:", error.message);
    return { status: "error", email: parsed.data.email, error: mapError(error.message) };
  }
  return { status: "sent", email: parsed.data.email };
}

/**
 * Inloggen of account maken met e-mail en wachtwoord. Werkt zonder mailserver zolang
 * "Confirm email" in Supabase uit staat; staat het aan, dan vragen we eerst de mail te bevestigen.
 */
export async function passwordAuth(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = PasswordSchema.safeParse({
    email: read(form, "email")?.trim(),
    password: read(form, "password"),
    mode: read(form, "mode"),
    next: read(form, "next"),
  });
  const email = read(form, "email")?.trim();
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return {
      status: "error",
      email,
      error: field === "password" ? "passwordShort" : "invalidEmail",
    };
  }
  const { password, mode } = parsed.data;
  const next = safeNext(parsed.data.next);
  const db = await createUserClient();

  if (mode === "signin") {
    const { error } = await db.auth.signInWithPassword({ email: parsed.data.email, password });
    if (error) return { status: "error", email, error: mapError(error.message) };
    redirect(next);
  }

  const origin = siteUrl(await headers());
  const { data, error } = await db.auth.signUp({
    email: parsed.data.email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { status: "error", email, error: mapError(error.message) };
  // Met e-mailbevestiging uit is er meteen een sessie; anders eerst de mail bevestigen.
  if (data.session) redirect(next);
  return { status: "confirm", email };
}

/** Wachtwoord vergeten: mail met een link die inlogt en naar "wachtwoord instellen" gaat. */
export async function sendPasswordReset(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = Email.safeParse(read(form, "email")?.trim());
  if (!parsed.success) return { status: "error", error: "invalidEmail" };
  const db = await createUserClient();
  const origin = siteUrl(await headers());
  const { error } = await db.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/app/settings/password")}`,
  });
  if (error) {
    console.error("[login] reset:", error.message);
    return { status: "error", email: parsed.data, error: mapError(error.message) };
  }
  // Ook als het adres niet bestaat: zelfde antwoord, zodat niemand accounts kan aftasten.
  return { status: "sent", email: parsed.data };
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

/** Vertaalt Supabase-foutmeldingen naar onze eigen teksten (geen technische details naar de gebruiker). */
function mapError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "wrongPassword";
  if (m.includes("email not confirmed")) return "notConfirmed";
  if (m.includes("already registered") || m.includes("already been registered")) return "exists";
  if (m.includes("password")) return "passwordWeak";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes"))
    return "rateLimit";
  if (m.includes("not authorized") || m.includes("sending") || m.includes("smtp"))
    return "mailDown";
  return "generic";
}
