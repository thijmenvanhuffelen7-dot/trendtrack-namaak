import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { Database, Db } from "@trendtrack/db";
import { cookies } from "next/headers";
import { supabasePublicEnv } from "./env";

/** Supabase-client met de sessie van de ingelogde gebruiker: leest via RLS, kan niet schrijven. */
export async function createUserClient(): Promise<Db> {
  const store = await cookies();
  const { url, anonKey } = supabasePublicEnv();
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // In een server component kunnen cookies niet gezet worden; de middleware ververst de sessie.
        }
      },
    },
  }) as unknown as Db;
}
