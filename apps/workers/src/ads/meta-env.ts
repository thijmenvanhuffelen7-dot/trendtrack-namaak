import { MetaAdLibraryClient } from "@trendtrack/core";
import { z } from "zod";

const MetaEnvSchema = z.object({
  META_ACCESS_TOKEN: z
    .string({
      error: "META_ACCESS_TOKEN ontbreekt: zet je Meta-token in .env.local (zie .env.example)",
    })
    .min(10, "META_ACCESS_TOKEN lijkt ongeldig (te kort)"),
  META_API_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/)
    .default("v23.0"),
  META_COUNTRIES: z
    .string()
    .default("NL,BE")
    .transform((s) =>
      s
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
    ),
});

export function readMetaEnv(env: NodeJS.ProcessEnv = process.env) {
  return MetaEnvSchema.parse(env);
}

export function createMetaClient(env: NodeJS.ProcessEnv = process.env) {
  const { META_ACCESS_TOKEN, META_API_VERSION } = readMetaEnv(env);
  return new MetaAdLibraryClient({
    accessToken: META_ACCESS_TOKEN,
    apiVersion: META_API_VERSION,
    log: (msg, extra) => console.log(`[meta] ${msg}`, extra ?? ""),
  });
}
