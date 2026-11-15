import { execSync } from "node:child_process";

/** Leest URL en keys van de draaiende lokale Supabase en zet ze in process.env. */
export default function setup() {
  let out: string;
  try {
    out = execSync("pnpm exec supabase status -o env", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new Error("Lokale Supabase draait niet. Start hem met `pnpm db:start`.");
  }
  const vars = Object.fromEntries(
    out
      .split("\n")
      .map((line) => line.match(/^([A-Z_]+)="(.*)"$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );
  process.env.SUPABASE_URL = vars.API_URL;
  process.env.SUPABASE_ANON_KEY = vars.ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = vars.SERVICE_ROLE_KEY;
}
