import { fileURLToPath } from "node:url";
import { createServiceClient } from "@trendtrack/db";
import { PoliteFetcher } from "./http/polite-fetcher";
import { crawlerIdentity } from "./http/user-agent";
import { SupabaseShopRepo, SupabaseSnapshotRepo } from "./repo/supabase-shop-repo";
import type { SnapshotDeps } from "./snapshot/snapshot-shop";

export const SEED_DOMAINS_PATH = fileURLToPath(
  new URL("../../../data/seed-domains.txt", import.meta.url),
);

/** Bouwt de echte afhankelijkheden (netwerk + Supabase) uit env. */
export function createCrawlerDeps(): SnapshotDeps {
  const { userAgent, robotsToken } = crawlerIdentity();
  const db = createServiceClient();
  return {
    fetcher: new PoliteFetcher({ userAgent, robotsToken }),
    repo: new SupabaseShopRepo(db),
    snapshots: new SupabaseSnapshotRepo(db),
    log: (msg, extra) => console.log(`[crawler] ${msg}`, extra ?? ""),
  };
}
