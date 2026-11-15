import { fileURLToPath } from "node:url";
import { createServiceClient } from "@trendtrack/db";
import type { CrawlerDeps } from "./crawler/deps";
import { PoliteFetcher } from "./http/polite-fetcher";
import { crawlerIdentity } from "./http/user-agent";
import { SupabaseShopRepo } from "./repo/supabase-shop-repo";

export const SEED_DOMAINS_PATH = fileURLToPath(
  new URL("../../../data/seed-domains.txt", import.meta.url),
);

/** Bouwt de echte afhankelijkheden (netwerk + Supabase) uit env. */
export function createCrawlerDeps(): CrawlerDeps {
  const { userAgent, robotsToken } = crawlerIdentity();
  return {
    fetcher: new PoliteFetcher({ userAgent, robotsToken }),
    repo: new SupabaseShopRepo(createServiceClient()),
    log: (msg, extra) => console.log(`[crawler] ${msg}`, extra ?? ""),
  };
}
