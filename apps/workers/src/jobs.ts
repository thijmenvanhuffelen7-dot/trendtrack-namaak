import { z } from "zod";

/** Alle jobnamen op één plek, zodat producers en consumers niet uit elkaar lopen. */
export const JOBS = {
  shopDetect: "shop.detect",
  shopCrawlProducts: "shop.crawl_products",
  shopCrawlBestsellers: "shop.crawl_bestsellers",
  shopDiscover: "shop.discover",
  shopSnapshot: "shop.snapshot",
  adsSyncAdvertiser: "ads.sync_advertiser",
  adsDiscover: "ads.discover",
} as const;

export type JobName = (typeof JOBS)[keyof typeof JOBS];

export const DomainPayloadSchema = z.object({ domain: z.string().min(3).max(253) });
export type DomainPayload = z.infer<typeof DomainPayloadSchema>;

export const DiscoverPayloadSchema = z.object({
  limit: z.number().int().positive().max(5000).default(500),
});

/** Waarom een domein in de wachtrij komt; bepaalt de prioriteit. */
export type DomainSource = "ads" | "seed" | "user";
export const PRIORITY: Record<DomainSource, number> = { user: 10, ads: 5, seed: 1 };

export const SyncAdvertiserPayloadSchema = z.object({
  page_id: z.string().regex(/^\d{5,25}$/),
  countries: z.array(z.string().regex(/^[A-Z]{2}$/)).optional(),
});
export const DiscoverAdsPayloadSchema = z.object({
  keyword: z.string().min(2).max(100),
  country: z.string().regex(/^[A-Z]{2}$/),
  maxPages: z.number().int().min(1).max(20).optional(),
});
