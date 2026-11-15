"use server";

import { z } from "zod";
import { getSession } from "@/lib/server/session";

export interface PasswordState {
  status: "idle" | "saved" | "error";
  error?: "short" | "mismatch" | "generic";
}

const Schema = z
  .object({ password: z.string().min(8).max(72), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"] });

/** Nieuw wachtwoord voor de ingelogde gebruiker (ook na "wachtwoord vergeten"). */
export async function updatePassword(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  const parsed = Schema.safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  if (!parsed.success)
    return {
      status: "error",
      error: parsed.error.issues[0]?.path[0] === "confirm" ? "mismatch" : "short",
    };
  // Met de sessie van de gebruiker zelf: Supabase wijzigt alleen het eigen wachtwoord.
  const { db } = await getSession();
  const { error } = await db.auth.updateUser({ password: parsed.data.password });
  if (error) {
    console.error("[password]", error.message);
    return { status: "error", error: "generic" };
  }
  return { status: "saved" };
}
