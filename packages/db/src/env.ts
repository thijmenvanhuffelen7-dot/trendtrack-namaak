import { z } from "zod";

const ServerEnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

/** Leest en valideert server-env. Alleen gebruiken in workers, API en MCP, nooit in de browser. */
export function readServerEnv(env: NodeJS.ProcessEnv = process.env) {
  return ServerEnvSchema.parse(env);
}
