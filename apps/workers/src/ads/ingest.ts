import {
  estimateAdSpend,
  isRecent,
  mapMetaAd,
  type ShopEventInput,
  type MetaAd,
  type MetaAdLibraryClient,
} from "@trendtrack/core";
import { enqueueDomains, type JobQueue } from "../crawler/discovery";
import { JOBS } from "../jobs";
import type { AdRow, AdsRepo } from "../repo/ads-repo";

export interface AdsDeps {
  client: Pick<MetaAdLibraryClient, "search">;
  ads: AdsRepo;
  queue?: JobQueue;
  now?: () => Date;
  log?: (msg: string, extra?: Record<string, unknown>) => void;
}

export interface IngestResult {
  saved: number;
  linkedToShop: number;
  newAdvertisers: string[];
  unknownDomains: string[];
  spend: { low: number; high: number; estimate: true };
}

/** Slaat één pagina API-ads op: adverteerders, ads, koppeling aan shops. */
export async function ingestAds(
  metaAds: MetaAd[],
  countries: string[],
  deps: AdsDeps,
): Promise<IngestResult> {
  const now = deps.now?.() ?? new Date();
  const mapped = metaAds.map((a) => mapMetaAd(a, countries, now));

  const { ids, created } = await deps.ads.upsertAdvertisers(
    mapped.map((m) => ({ page_id: m.page_id, page_name: m.page_name })),
  );
  // Landen samenvoegen met wat we al wisten (een ad kan in NL én BE gevonden worden).
  const known = await deps.ads.existingAds(mapped.map((m) => m.external_id));
  const domains = [...new Set(mapped.map((m) => m.landing_domain).filter((d): d is string => !!d))];
  const shopIds = await deps.ads.shopIdsByDomain(domains);

  const rows: AdRow[] = mapped.map(({ page_id, page_name: _name, ...m }) => {
    const countriesAll = [
      ...new Set([...(known.get(m.external_id)?.countries ?? []), ...m.countries]),
    ].sort();
    const spend = estimateAdSpend(m.eu_total_reach, countriesAll);
    return {
      ...m,
      countries: countriesAll,
      est_spend_low: spend?.low ?? null,
      est_spend_high: spend?.high ?? null,
      platform: "meta",
      advertiser_id: ids.get(page_id)!,
      shop_id: m.landing_domain ? (shopIds.get(m.landing_domain) ?? null) : null,
    };
  });
  const adIds = await deps.ads.upsertAds(rows);
  const saved = rows.length;
  await deps.ads.saveEvents(adEvents(rows, known, adIds, now));

  for (const r of rows)
    if (r.shop_id) await deps.ads.linkAdvertiserShop(r.advertiser_id, r.shop_id);

  const unknownDomains = domains.filter((d) => !shopIds.has(d));
  if (deps.queue && unknownDomains.length) await enqueueDomains(deps.queue, unknownDomains, "ads");

  return {
    saved,
    linkedToShop: rows.filter((r) => r.shop_id).length,
    newAdvertisers: created,
    unknownDomains,
    spend: {
      low: round2(rows.reduce((s, r) => s + (r.est_spend_low ?? 0), 0)),
      high: round2(rows.reduce((s, r) => s + (r.est_spend_high ?? 0), 0)),
      estimate: true,
    },
  };
}

/** Feed-events: nieuwe ads en ads die net gestopt zijn (alleen recent en alleen als de shop bekend is). */
function adEvents(
  rows: AdRow[],
  known: Map<string, { is_active: boolean }>,
  adIds: Map<string, string>,
  now: Date,
): ShopEventInput[] {
  const events: ShopEventInput[] = [];
  for (const r of rows) {
    if (!r.shop_id) continue;
    const before = known.get(r.external_id);
    const base = { shop_id: r.shop_id, ref_id: adIds.get(r.external_id) ?? null };
    const payload = {
      title: r.title,
      body: r.body?.slice(0, 200) ?? null,
      external_id: r.external_id,
    };
    if (!before && isRecent(r.started_at, now)) {
      events.push({
        ...base,
        type: "new_ad",
        occurred_at: r.started_at!,
        payload,
        dedupe_key: `new_ad:${r.external_id}`,
      });
    }
    const justStopped = !r.is_active && (before ? before.is_active : true);
    if (justStopped && isRecent(r.ended_at, now)) {
      const runDays =
        r.started_at && r.ended_at
          ? Math.max(
              0,
              Math.floor((Date.parse(r.ended_at) - Date.parse(r.started_at)) / 86_400_000),
            )
          : null;
      events.push({
        ...base,
        type: "stopped_ad",
        occurred_at: r.ended_at!,
        payload: { ...payload, run_days: runDays },
        dedupe_key: `stopped_ad:${r.external_id}`,
      });
    }
  }
  return events;
}

function emptyResult(): IngestResult {
  return {
    saved: 0,
    linkedToShop: 0,
    newAdvertisers: [],
    unknownDomains: [],
    spend: { low: 0, high: 0, estimate: true },
  };
}

function add(a: IngestResult, b: IngestResult): IngestResult {
  return {
    saved: a.saved + b.saved,
    linkedToShop: a.linkedToShop + b.linkedToShop,
    newAdvertisers: [...new Set([...a.newAdvertisers, ...b.newAdvertisers])],
    unknownDomains: [...new Set([...a.unknownDomains, ...b.unknownDomains])],
    spend: {
      low: round2(a.spend.low + b.spend.low),
      high: round2(a.spend.high + b.spend.high),
      estimate: true,
    },
  };
}

/** ads.sync_advertiser: alle ads (actief en gestopt) van één Facebook-pagina. */
export async function syncAdvertiser(
  pageId: string,
  countries: string[],
  deps: AdsDeps,
): Promise<IngestResult> {
  let total = emptyResult();
  for await (const page of deps.client.search({
    countries,
    searchPageIds: [pageId],
    activeStatus: "ALL",
  })) {
    total = add(total, await ingestAds(page, countries, deps));
  }
  await deps.ads.markAdvertiserSynced(pageId, (deps.now?.() ?? new Date()).toISOString());
  deps.log?.("adverteerder gesynchroniseerd", { pageId, saved: total.saved });
  return total;
}

/**
 * ads.discover: zoekt actieve ads op een e-commerce-zoekwoord in één land, om nieuwe
 * adverteerders te vinden. Nieuwe adverteerders gaan in de wachtrij voor een volledige sync.
 */
export async function discoverAds(
  keyword: string,
  country: string,
  deps: AdsDeps,
  maxPages = 3,
): Promise<IngestResult> {
  let total = emptyResult();
  for await (const page of deps.client.search({
    countries: [country],
    searchTerms: keyword,
    activeStatus: "ACTIVE",
    maxPages,
  })) {
    total = add(total, await ingestAds(page, [country], deps));
  }
  if (deps.queue) {
    for (const pageId of total.newAdvertisers) {
      await deps.queue.send(
        JOBS.adsSyncAdvertiser,
        { page_id: pageId },
        { singletonKey: pageId, retryLimit: 2 },
      );
    }
  }
  deps.log?.("discover klaar", {
    keyword,
    country,
    saved: total.saved,
    nieuw: total.newAdvertisers.length,
  });
  return total;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
