import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Eén .env.local in de root van de monorepo voor alle apps.
// forceReload: Next heeft al (leeg) geladen voor apps/web en cachet dat resultaat.
loadEnvConfig(
  path.resolve(__dirname, "../.."),
  process.env.NODE_ENV !== "production",
  undefined,
  true,
);

const nextConfig: NextConfig = {
  // Workspace-packages worden als TypeScript-bron geïmporteerd.
  transpilePackages: ["@trendtrack/core", "@trendtrack/db"],
  // Server-only packages die Node-API's gebruiken niet bundelen.
  serverExternalPackages: ["sanitize-html"],
};

export default nextConfig;
