/** Alle jobnamen op één plek, zodat producers en consumers niet uit elkaar lopen. */
export const JOBS = {
  shopDetect: "shop.detect",
  shopCrawlProducts: "shop.crawl_products",
  shopCrawlBestsellers: "shop.crawl_bestsellers",
  shopSnapshot: "shop.snapshot",
  adsSyncAdvertiser: "ads.sync_advertiser",
  adsDiscover: "ads.discover",
} as const;

export type JobName = (typeof JOBS)[keyof typeof JOBS];
