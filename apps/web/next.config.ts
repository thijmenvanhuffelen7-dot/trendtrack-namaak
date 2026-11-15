import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace-packages worden als TypeScript-bron geïmporteerd.
  transpilePackages: ["@trendtrack/core", "@trendtrack/db"],
};

export default nextConfig;
