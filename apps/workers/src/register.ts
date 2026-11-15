import type PgBoss from "pg-boss";
import type pg from "pg";
import { discoverAds, syncAdvertiser, type AdsDeps } from "./ads/ingest";
import { readKeywords } from "./ads/keywords";
import { concurrencyFor, type WorkerConfig } from "./config";
import { crawlBestsellers } from "./crawler/crawl-bestsellers";
import { crawlProducts } from "./crawler/crawl-products";
import { detectShop } from "./crawler/detect-shop";
import { runDiscovery } from "./crawler/discovery";
import { withDomainLock } from "./infra/domain-lock";
import { tracked, type JobLike } from "./infra/job-runs";
import { completeLookups, noteLookupError } from "./infra/lookups";
import {
  DiscoverAdsPayloadSchema,
  DiscoverPayloadSchema,
  DomainPayloadSchema,
  JOBS,
  SYSTEM_JOBS,
  SyncAdvertiserPayloadSchema,
} from "./jobs";
import { checkFailures, webhookNotifier } from "./monitor/failure-alert";
import { hourIndex, rotatingBatch } from "./scheduler/buckets";
import { planAdvertiserSyncs, planShopSnapshots } from "./scheduler/plan";
import {
  activeShopifyDomains,
  metaAdvertisers,
  paidTrackedDomains,
  recomputeGrowthScores,
} from "./scheduler/queries";
import { snapshotShop, type SnapshotDeps } from "./snapshot/snapshot-shop";

export interface RegisterDeps {
  boss: PgBoss;
  pool: pg.Pool;
  config: WorkerConfig;
  shop: SnapshotDeps;
  /** Null als er geen Meta-token is: dan geen ads-jobs. */
  ads: Omit<AdsDeps, "queue"> | null;
  metaCountries: string[];
  seedFilePath: string;
  keywordsPath: string;
}

type Handler = (job: JobLike) => Promise<unknown>;

/** Registreert `n` parallelle workers voor een queue, met job_runs-registratie. */
async function work(
  d: RegisterDeps,
  name: string,
  n: number,
  keyOf: (job: JobLike) => string | null,
  handler: Handler,
) {
  const wrapped = tracked(d.pool, keyOf, handler);
  for (let i = 0; i < Math.max(1, n); i++) {
    await d.boss.work(name, { batchSize: 1 }, (jobs) => wrapped(jobs as JobLike[]));
  }
}

const domainKey = (job: JobLike) => DomainPayloadSchema.safeParse(job.data).data?.domain ?? null;

/** Domein-jobs: max één tegelijk per domein (ook over servers heen). */
const domainJob =
  (d: RegisterDeps, fn: (domain: string) => Promise<unknown>): Handler =>
  async (job) => {
    const { domain } = DomainPayloadSchema.parse(job.data);
    return withDomainLock(d.pool, domain, () => fn(domain));
  };

// Bij "bezig" of tijdelijke fouten later opnieuw proberen.
const RETRY = { retryLimit: 5, retryDelay: 120, retryBackoff: true } as const;

export async function registerAll(d: RegisterDeps) {
  const { boss } = d;
  const conc = concurrencyFor(d.config);

  // --- Shop-jobs ------------------------------------------------------------
  for (const name of [
    JOBS.shopDetect,
    JOBS.shopCrawlProducts,
    JOBS.shopCrawlBestsellers,
    JOBS.shopSnapshot,
  ]) {
    await boss.createQueue(name, { name, policy: "short", ...RETRY });
  }
  await boss.createQueue(JOBS.shopDiscover, { name: JOBS.shopDiscover, policy: "singleton" });

  await work(
    d,
    JOBS.shopDetect,
    conc[JOBS.shopDetect]!,
    domainKey,
    domainJob(d, async (domain) => {
      try {
        const r = await detectShop(domain, d.shop);
        await completeLookups(d.pool, r);
        if (r.status === "active" && r.isShopify) {
          await boss.send(
            JOBS.shopCrawlProducts,
            { domain: r.domain },
            { singletonKey: r.domain, priority: 5 },
          );
        }
        return { status: r.status, isShopify: r.isShopify, linkedAds: r.linkedAds };
      } catch (err) {
        // Laat de gebruiker zien wat er misging; pg-boss probeert het later opnieuw.
        await noteLookupError(d.pool, domain, err instanceof Error ? err.message : String(err));
        throw err;
      }
    }),
  );

  await work(
    d,
    JOBS.shopCrawlProducts,
    conc[JOBS.shopCrawlProducts]!,
    domainKey,
    domainJob(d, async (domain) => {
      const r = await crawlProducts(domain, d.shop);
      if (!r.blocked && r.products > 0) {
        await boss.send(
          JOBS.shopCrawlBestsellers,
          { domain: r.domain },
          { singletonKey: r.domain },
        );
      }
      return r;
    }),
  );

  await work(
    d,
    JOBS.shopCrawlBestsellers,
    conc[JOBS.shopCrawlBestsellers]!,
    domainKey,
    domainJob(d, async (domain) => {
      const r = await crawlBestsellers(domain, d.shop);
      return { source: r.source, saved: r.saved };
    }),
  );

  await work(
    d,
    JOBS.shopSnapshot,
    conc[JOBS.shopSnapshot]!,
    domainKey,
    domainJob(d, async (domain) => {
      const r = await snapshotShop(domain, d.shop);
      return {
        skipped: r.skipped,
        products: r.products,
        estimate: r.estimate,
        growthScore: r.growthScore,
      };
    }),
  );

  await work(
    d,
    JOBS.shopDiscover,
    1,
    () => null,
    async (job) => {
      const { limit } = DiscoverPayloadSchema.parse(job.data ?? {});
      return runDiscovery({ repo: d.shop.repo, queue: boss, seedFilePath: d.seedFilePath }, limit);
    },
  );

  // --- Ads-jobs ---------------------------------------------------------------
  if (d.ads) {
    const ads: AdsDeps = { ...d.ads, queue: boss };
    await boss.createQueue(JOBS.adsSyncAdvertiser, {
      name: JOBS.adsSyncAdvertiser,
      policy: "short",
      ...RETRY,
    });
    await boss.createQueue(JOBS.adsDiscover, { name: JOBS.adsDiscover, policy: "short", ...RETRY });

    await work(
      d,
      JOBS.adsSyncAdvertiser,
      conc[JOBS.adsSyncAdvertiser]!,
      (j) => SyncAdvertiserPayloadSchema.safeParse(j.data).data?.page_id ?? null,
      async (job) => {
        const { page_id, countries } = SyncAdvertiserPayloadSchema.parse(job.data);
        const r = await syncAdvertiser(page_id, countries ?? d.metaCountries, ads);
        return {
          saved: r.saved,
          linkedToShop: r.linkedToShop,
          unknownDomains: r.unknownDomains.length,
        };
      },
    );

    await work(
      d,
      JOBS.adsDiscover,
      conc[JOBS.adsDiscover]!,
      (j) => {
        const p = DiscoverAdsPayloadSchema.safeParse(j.data).data;
        return p ? `${p.country}:${p.keyword}` : null;
      },
      async (job) => {
        const { keyword, country, maxPages } = DiscoverAdsPayloadSchema.parse(job.data);
        const r = await discoverAds(keyword, country, ads, maxPages);
        return {
          saved: r.saved,
          newAdvertisers: r.newAdvertisers.length,
          unknownDomains: r.unknownDomains.length,
        };
      },
    );
  }

  // --- Planner & monitoring ---------------------------------------------------
  for (const name of Object.values(SYSTEM_JOBS))
    await boss.createQueue(name, { name, policy: "singleton" });

  await work(
    d,
    SYSTEM_JOBS.hourlyShops,
    1,
    () => null,
    async () => {
      const hour = new Date().getUTCHours();
      const plan = planShopSnapshots(
        await activeShopifyDomains(d.pool),
        await paidTrackedDomains(d.pool),
        hour,
      );
      for (const j of plan)
        await boss.send(
          JOBS.shopSnapshot,
          { domain: j.key },
          { singletonKey: j.key, priority: j.priority },
        );
      return { queued: plan.length, tracked: plan.filter((j) => j.priority > 0).length };
    },
  );

  await work(
    d,
    SYSTEM_JOBS.hourlyAds,
    1,
    () => null,
    async () => {
      if (!d.ads) return { skipped: "geen META_ACCESS_TOKEN" };
      const { all, tracked: trackedIds } = await metaAdvertisers(d.pool);
      const plan = planAdvertiserSyncs(all, trackedIds, new Date().getUTCHours());
      for (const j of plan)
        await boss.send(
          JOBS.adsSyncAdvertiser,
          { page_id: j.key },
          { singletonKey: j.key, priority: j.priority },
        );
      return { queued: plan.length };
    },
  );

  await work(
    d,
    SYSTEM_JOBS.hourlyDiscovery,
    1,
    () => null,
    async () => {
      await boss.send(JOBS.shopDiscover, { limit: 500 });
      if (!d.ads) return { ads: "uit (geen META_ACCESS_TOKEN)" };
      const keywords = rotatingBatch(
        await readKeywords(d.keywordsPath),
        hourIndex(new Date()),
        d.config.KEYWORDS_PER_HOUR,
      );
      for (const keyword of keywords) {
        for (const country of d.metaCountries) {
          await boss.send(
            JOBS.adsDiscover,
            { keyword, country },
            { singletonKey: `${country}:${keyword}` },
          );
        }
      }
      return { keywords };
    },
  );

  await work(
    d,
    SYSTEM_JOBS.dailyMaintenance,
    1,
    () => null,
    async () => {
      const growth = await recomputeGrowthScores(d.pool);
      const { rows } = await d.pool.query<{ n: string }>("select public.prune_job_runs(30) as n");
      await d.pool.query("select public.prune_api_rate_counters()");
      await d.pool.query("select public.prune_public_rate_counters()");
      return { growthUpdated: growth, prunedRuns: Number(rows[0]?.n ?? 0) };
    },
  );

  const notify = d.config.ALERT_WEBHOOK_URL ? webhookNotifier(d.config.ALERT_WEBHOOK_URL) : null;
  // Monitoring zelf niet via tracked(): anders telt een kapotte monitor mee in zijn eigen statistiek.
  await boss.work(SYSTEM_JOBS.monitorFailures, { batchSize: 1 }, async () =>
    checkFailures(d.pool, notify),
  );

  if (d.config.SCHEDULER_ENABLED) {
    const tz = d.config.SCHEDULER_TZ;
    await boss.schedule(SYSTEM_JOBS.hourlyShops, "5 * * * *", {}, { tz });
    await boss.schedule(SYSTEM_JOBS.hourlyAds, "15 * * * *", {}, { tz });
    await boss.schedule(SYSTEM_JOBS.hourlyDiscovery, "25 * * * *", {}, { tz });
    await boss.schedule(SYSTEM_JOBS.dailyMaintenance, "30 3 * * *", {}, { tz });
    await boss.schedule(SYSTEM_JOBS.monitorFailures, "*/10 * * * *", {}, { tz });
  }
}
