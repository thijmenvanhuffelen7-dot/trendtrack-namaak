import { createServiceClient } from "@trendtrack/db";
import { z } from "zod";
import { createApp } from "./app";

const env = z
  .object({
    MCP_PORT: z.coerce.number().int().default(3333),
    MCP_PUBLIC_URL: z.url().default("http://localhost:3333"),
    WEB_PUBLIC_URL: z.url().default("http://localhost:3000"),
  })
  .parse(process.env);

const app = createApp({
  db: createServiceClient(),
  publicUrl: env.MCP_PUBLIC_URL.replace(/\/$/, ""),
  webOrigin: env.WEB_PUBLIC_URL.replace(/\/$/, ""),
  log: (entry) => console.log(JSON.stringify({ at: new Date().toISOString(), ...entry })),
});
app.listen(env.MCP_PORT, () => console.log(`MCP-server op ${env.MCP_PUBLIC_URL}/mcp`));
