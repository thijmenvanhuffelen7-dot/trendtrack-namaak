import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.gen";
import { readServerEnv } from "./env";

export type Db = SupabaseClient<Database>;

/** Service-role client: omzeilt RLS. Alleen server-side gebruiken. */
export function createServiceClient(env: NodeJS.ProcessEnv = process.env): Db {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = readServerEnv(env);
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
