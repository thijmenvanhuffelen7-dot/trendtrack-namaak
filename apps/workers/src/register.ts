import type PgBoss from "pg-boss";
import { crawlBestsellers } from "./crawler/crawl-bestsellers";
import { crawlProducts } from "./crawler/crawl-products";
import { snapshotShop, type SnapshotDeps } from "./snapshot/snapshot-shop";
import { detectShop } from "./crawler/detect-shop";
import { runDiscovery } from "./crawler/discovery";
import { DiscoverPayloadSchema, DomainPayloadSchema, JOBS } from "./jobs";

const SHOP_QUEUES = [
  JOBS.shopDetect,
  JOBS.shopCrawlProducts,
  JOBS.shopCrawlBestsellers,
  JOBS.shopSnapshot,
] as const;

/** Maakt de queues aan en registreert de shop-handlers. */
export async function registerShopJobs(boss: PgBoss, deps: SnapshotDeps, seedFilePath: string) {
  // policy "short": per singletonKey (domein) maximaal één job in de wachtrij.
  for (const name of SHOP_QUEUES) await boss.createQueue(name, { name, policy: "short" });
  await boss.createQueue(JOBS.shopDiscover, { name: JOBS.shopDiscover, policy: "singleton" });

  await boss.work(JOBS.shopDetect, { batchSize: 1 }, async ([job]) => {
    const { domain } = DomainPayloadSchema.parse(job!.data);
    const result = await detectShop(domain, deps);
    if (result.status === "active" && result.isShopify) {
      await boss.send(
        JOBS.shopCrawlProducts,
        { domain: result.domain },
        { singletonKey: result.domain },
      );
    }
    return { status: result.status, isShopify: result.isShopify, linkedAds: result.linkedAds };
  });

  await boss.work(JOBS.shopCrawlProducts, { batchSize: 1 }, async ([job]) => {
    const { domain } = DomainPayloadSchema.parse(job!.data);
    const result = await crawlProducts(domain, deps);
    // Bestsellers pas na producten, zodat de handles te koppelen zijn.
    if (!result.blocked && result.products > 0) {
      await boss.send(
        JOBS.shopCrawlBestsellers,
        { domain: result.domain },
        { singletonKey: result.domain },
      );
    }
    return result;
  });

  await boss.work(JOBS.shopCrawlBestsellers, { batchSize: 1 }, async ([job]) => {
    const { domain } = DomainPayloadSchema.parse(job!.data);
    return crawlBestsellers(domain, deps);
  });

  await boss.work(JOBS.shopSnapshot, { batchSize: 1 }, async ([job]) => {
    const { domain } = DomainPayloadSchema.parse(job!.data);
    const r = await snapshotShop(domain, deps);
    return {
      skipped: r.skipped,
      products: r.products,
      estimate: r.estimate,
      growthScore: r.growthScore,
    };
  });

  await boss.work(JOBS.shopDiscover, { batchSize: 1 }, async ([job]) => {
    const { limit } = DiscoverPayloadSchema.parse(job!.data ?? {});
    return runDiscovery({ repo: deps.repo, queue: boss, seedFilePath }, limit);
  });
}
