import { createServiceClient } from "@trendtrack/db";
import { createApp } from "./app";

/**
 * Ingang voor Vercel (service "mcp" in /vercel.json). Geen app.listen: Vercel roept de app aan.
 * Web en MCP delen één domein, dus beide publieke URL's zijn standaard de site-URL. Dit zijn de
 * adressen die OAuth-clients (zoals Claude) zien; daarom geen interne binding-URL.
 * Op de VPS (Docker) blijft src/index.ts de ingang.
 */
const site = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/$/, "");

const app = createApp({
  db: createServiceClient(),
  publicUrl: (process.env.MCP_PUBLIC_URL ?? site).replace(/\/$/, ""),
  webOrigin: (process.env.WEB_PUBLIC_URL ?? site).replace(/\/$/, ""),
  log: (entry) => console.log(JSON.stringify({ at: new Date().toISOString(), ...entry })),
});

export default app;
