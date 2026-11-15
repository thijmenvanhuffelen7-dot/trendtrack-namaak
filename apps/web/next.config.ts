import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import createNextIntlPlugin from "next-intl/plugin";

// Eén .env.local in de root van de monorepo voor alle apps.
// forceReload: Next heeft al (leeg) geladen voor apps/web en cachet dat resultaat.
loadEnvConfig(
  path.resolve(__dirname, "../.."),
  process.env.NODE_ENV !== "production",
  undefined,
  true,
);

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
  // Workspace-packages worden als TypeScript-bron geïmporteerd.
  transpilePackages: ["@trendtrack/core", "@trendtrack/db"],
  // Server-only packages die Node-API's gebruiken niet bundelen.
  serverExternalPackages: ["sanitize-html"],
  // Het dev-icoontje linksonder ligt over de taal- en uitlogknop in de sidebar.
  devIndicators: false,
};

// Blogposts zijn MDX-bestanden in src/content/blog (zie lib/site/blog.ts).
const withMDX = createMDX({});

export default createNextIntlPlugin("./src/i18n/request.ts")(withMDX(nextConfig));
