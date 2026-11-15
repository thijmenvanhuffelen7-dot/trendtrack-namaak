import { z } from "zod";
import { JOBS } from "./jobs";

const int = (def: number) => z.coerce.number().int().min(0).max(50).default(def);

const ConfigSchema = z.object({
  CONCURRENCY_SHOP_DETECT: int(4),
  CONCURRENCY_SHOP_CRAWL_PRODUCTS: int(2),
  CONCURRENCY_SHOP_CRAWL_BESTSELLERS: int(2),
  CONCURRENCY_SHOP_SNAPSHOT: int(3),
  CONCURRENCY_ADS_SYNC: int(1),
  CONCURRENCY_ADS_DISCOVER: int(1),
  KEYWORDS_PER_HOUR: int(3),
  SCHEDULER_TZ: z.string().default("Europe/Amsterdam"),
  ALERT_WEBHOOK_URL: z.url().optional(),
  WORKER_HEALTH_PORT: z.coerce.number().int().default(8080),
  /** Zet op "false" om alleen jobs te verwerken en niet te plannen (bv. extra worker-server). */
  SCHEDULER_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

export type WorkerConfig = z.infer<typeof ConfigSchema>;

export function readConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return ConfigSchema.parse(env);
}

/** Concurrency per jobtype (aantal parallelle workers in dit proces). */
export function concurrencyFor(c: WorkerConfig): Record<string, number> {
  return {
    [JOBS.shopDetect]: c.CONCURRENCY_SHOP_DETECT,
    [JOBS.shopCrawlProducts]: c.CONCURRENCY_SHOP_CRAWL_PRODUCTS,
    [JOBS.shopCrawlBestsellers]: c.CONCURRENCY_SHOP_CRAWL_BESTSELLERS,
    [JOBS.shopSnapshot]: c.CONCURRENCY_SHOP_SNAPSHOT,
    [JOBS.adsSyncAdvertiser]: c.CONCURRENCY_ADS_SYNC,
    [JOBS.adsDiscover]: c.CONCURRENCY_ADS_DISCOVER,
  };
}
