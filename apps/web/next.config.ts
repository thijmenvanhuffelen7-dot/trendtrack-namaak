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

const isDev = process.env.NODE_ENV !== "production";
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/**
 * Content-Security-Policy. Next zet kleine inline scripts voor hydration, daarom 'unsafe-inline'
 * voor scripts (een nonce zou elke pagina dynamisch maken). Beelden van shops en Meta komen van
 * allerlei CDN's (https:). Landingspagina's van ads tonen we in een iframe zonder scripts (frame-src https:).
 */
const cspParts = (formAction: string) => [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabase}${isDev ? " ws: http://localhost:*" : ""}`.trim(),
  "frame-src https:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  `form-action ${formAction}`,
  // Alleen achter https (productie); lokaal met `next start` zou het elke request naar https omzetten.
  ...(process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://")
    ? ["upgrade-insecure-requests"]
    : []),
];
const csp = cspParts("'self' https://checkout.stripe.com https://billing.stripe.com").join("; ");
// OAuth-consent stuurt door naar de redirect-URI van de MCP-client (ook http://localhost bij desktop-apps).
const oauthCsp = cspParts("'self' https: http://localhost:* http://127.0.0.1:*").join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev
    ? []
    : [
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      ]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/oauth/:path*", headers: [{ key: "Content-Security-Policy", value: oauthCsp }] },
    ];
  },
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
