import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

/** Lokale Supabase-keys uit `supabase status` en de webhook-secret uit .env.local. */
export default function setup() {
  if (!process.env.SUPABASE_URL) {
    try {
      const out = execSync("pnpm exec supabase status -o env", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      for (const line of out.split("\n")) {
        const m = line.match(/^([A-Z_]+)="(.*)"$/);
        if (!m) continue;
        if (m[1] === "API_URL") process.env.SUPABASE_URL = m[2];
        if (m[1] === "SERVICE_ROLE_KEY") process.env.SUPABASE_SERVICE_ROLE_KEY = m[2];
        if (m[1] === "MAILPIT_URL" || m[1] === "INBUCKET_URL") process.env.MAILPIT_URL ??= m[2];
      }
    } catch {
      throw new Error("Geen Supabase gevonden: start hem met `pnpm db:start` of zet SUPABASE_URL.");
    }
  }
  process.env.MAILPIT_URL ??= "http://127.0.0.1:54324";
  if (!process.env.STRIPE_WEBHOOK_SECRET && existsSync(".env.local")) {
    const m = readFileSync(".env.local", "utf8").match(/^STRIPE_WEBHOOK_SECRET=(.+)$/m);
    if (m?.[1]) process.env.STRIPE_WEBHOOK_SECRET = m[1].trim();
  }
}
