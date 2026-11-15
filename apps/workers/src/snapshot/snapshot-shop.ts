import {
  diffSnapshots,
  dominantProductType,
  estimateAov,
  estimateRevenue,
  extractReviewCount,
  growthScore,
  normalizeDomain,
  type DailySignal,
  type ProductRecord,
  type ProductState,
  type RevenueEstimate,
  type ShopEventInput,
  type SnapshotDiff,
} from "@trendtrack/core";
import { crawlBestsellers } from "../crawler/crawl-bestsellers";
import { fetchAllProducts } from "../crawler/crawl-products";
import { isoDate, logOf, nowOf, type CrawlerDeps } from "../crawler/deps";
import { BlockedError, RobotsDisallowedError } from "@trendtrack/core";
import type { ProductSnapshotRow, ShopSnapshotRow, SnapshotRepo } from "../repo/snapshot-repo";

export interface SnapshotDeps extends CrawlerDeps {
  snapshots: SnapshotRepo;
}

export interface SnapshotResult {
  domain: string;
  capturedOn: string;
  skipped?: "not_active" | "blocked";
  products?: number;
  diff?: Pick<
    SnapshotDiff,
    "newProducts" | "removedProducts" | "priceChanges" | "sellouts" | "selloutValue"
  >;
  estimate?: RevenueEstimate["monthlyRevenue"] | null;
  growthScore?: number | null;
}

const HISTORY_DAYS = 35;

/**
 * Dagelijkse snapshot van één shop: producten + voorraad, verschillen met de vorige snapshot,
 * bestsellers, reviews, ads, en daarna een nieuwe omzetschatting en growth_score.
 */
export async function snapshotShop(input: string, deps: SnapshotDeps): Promise<SnapshotResult> {
  const domain = normalizeDomain(input);
  const log = logOf(deps);
  const now = nowOf(deps);
  const capturedOn = isoDate(now);

  const shop = await deps.repo.getShop(domain);
  if (!shop || shop.status !== "active" || shop.platform !== "shopify") {
    return { domain, capturedOn, skipped: "not_active" };
  }

  // 1. Homepage voor het aantal reviews (als de review-app dat publiek toont).
  let reviewCount: number | null = null;
  try {
    const { response } = await deps.fetcher.get(`https://${domain}/`, { accept: "text/html" });
    if (response.ok) reviewCount = extractReviewCount(await response.text());
  } catch (err) {
    if (err instanceof BlockedError || err instanceof RobotsDisallowedError)
      return markBlocked(domain, capturedOn, deps);
    throw err;
  }

  // 2. Alle producten.
  const { records, blocked } = await fetchAllProducts(domain, deps.fetcher, log);
  if (blocked) return markBlocked(domain, capturedOn, deps);
  await deps.repo.upsertProducts(shop.id, records, now.toISOString());

  // 3. Bestsellers (slaat zelf de posities op).
  const bestsellers = await crawlBestsellers(domain, deps);
  const positionByHandle = new Map(bestsellers.handles.map((h, i) => [h, i + 1]));

  // 4. Toestand vandaag vs. vorige snapshot.
  const current: ProductState[] = records.map((r) => ({
    external_id: r.external_id,
    price: r.price_min,
    available_variants: r.available_variants,
    total_variants: r.total_variants,
    position: positionByHandle.get(r.handle) ?? null,
  }));
  const previous = await deps.snapshots.previousProductStates(shop.id, capturedOn);
  const hasPrevious = previous.date !== null;
  const diff = diffSnapshots(previous.states, current);

  const ids = await deps.snapshots.productIds(shop.id);
  const prevById = new Map(previous.states.map((s) => [s.external_id, s]));
  const productRows: ProductSnapshotRow[] = current.flatMap((c) => {
    const id = ids.get(c.external_id);
    if (!id) return [];
    const prev = prevById.get(c.external_id);
    return [
      {
        product_id: id,
        captured_on: capturedOn,
        price: c.price,
        available_variants: c.available_variants,
        position_in_bestsellers: c.position,
        inventory_signal: {
          total_variants: c.total_variants,
          sold_out_variants: c.total_variants - c.available_variants,
          delta_available: prev ? c.available_variants - prev.available_variants : null,
        },
      },
    ];
  });
  await deps.snapshots.saveProductSnapshots(productRows);
  await deps.repo.upsertShop(domain, { niche: dominantProductType(records) });
  if (hasPrevious)
    await deps.snapshots.saveEvents(diffEvents(shop.id, capturedOn, now, diff, records, ids));

  // 5. Ads en historie => schatting.
  const ads = await deps.snapshots.adStats(shop.id, now);
  const history = await deps.snapshots.shopHistory(
    shop.id,
    shiftDate(capturedOn, -(HISTORY_DAYS - 1)),
    capturedOn,
  );
  const newProducts = hasPrevious ? diff.newProducts.length : countRecentlyPublished(records, now);

  const today: DailySignal = {
    date: capturedOn,
    selloutValue: hasPrevious ? diff.selloutValue : null,
    reviewCount,
    activeAds: ads.activeAds,
    newProducts,
    productCount: records.length,
  };
  const aov = estimateAov(bestsellerPrices(records, bestsellers.handles));
  const estimate = estimateRevenue({
    days: [...history, today],
    aov,
    ads:
      ads.monthlySpendLow !== null && ads.monthlySpendHigh !== null
        ? { monthlyLow: ads.monthlySpendLow, monthlyHigh: ads.monthlySpendHigh }
        : null,
  });
  const rev = estimate?.monthlyRevenue ?? null;
  today.estDailyRevenue = rev ? round2(rev.mid / 30) : null;

  const shopRow: ShopSnapshotRow = {
    shop_id: shop.id,
    captured_on: capturedOn,
    product_count: records.length,
    new_products: newProducts,
    removed_products: hasPrevious ? diff.removedProducts.length : null,
    price_changes: hasPrevious ? diff.priceChanges.length : null,
    sellouts: hasPrevious ? diff.sellouts.length : null,
    sellout_value: today.selloutValue,
    review_count: reviewCount,
    active_ads_count: ads.activeAds,
    total_reach: ads.totalReach,
    est_daily_revenue: today.estDailyRevenue,
    est_daily_revenue_low: rev ? round2(rev.low / 30) : null,
    est_daily_revenue_high: rev ? round2(rev.high / 30) : null,
    est_confidence: rev?.confidence ?? null,
  };
  await deps.snapshots.saveShopSnapshot(shopRow);

  const growth = growthScore([...history, today]);
  const orders = estimate?.monthlyOrders ?? null;
  await deps.snapshots.updateShopEstimate(shop.id, {
    est_monthly_revenue: rev?.mid ?? null,
    est_monthly_revenue_low: rev?.low ?? null,
    est_monthly_revenue_high: rev?.high ?? null,
    est_monthly_orders: orders?.mid ?? null,
    est_monthly_orders_low: orders?.low ?? null,
    est_monthly_orders_high: orders?.high ?? null,
    est_confidence: rev?.confidence ?? null,
    est_signals: estimate
      ? Object.fromEntries(estimate.signals.map((s) => [s.name, round2(s.reliability)]))
      : null,
    est_updated_at: now.toISOString(),
    growth_score: growth,
    last_crawled_at: now.toISOString(),
  });

  log("snapshot klaar", { domain, products: records.length, mid: rev?.mid, growth });
  return {
    domain,
    capturedOn,
    products: records.length,
    diff: {
      newProducts: diff.newProducts,
      removedProducts: diff.removedProducts,
      priceChanges: diff.priceChanges,
      sellouts: diff.sellouts,
      selloutValue: diff.selloutValue,
    },
    estimate: rev,
    growthScore: growth,
  };
}

async function markBlocked(
  domain: string,
  capturedOn: string,
  deps: SnapshotDeps,
): Promise<SnapshotResult> {
  await deps.repo.upsertShop(domain, { status: "blocked" });
  return { domain, capturedOn, skipped: "blocked" };
}

/** Zet de verschillen om naar feed-events (max 100 per soort, zodat een herindeling de feed niet overspoelt). */
function diffEvents(
  shopId: string,
  capturedOn: string,
  now: Date,
  diff: SnapshotDiff,
  records: ProductRecord[],
  ids: Map<string, string>,
): ShopEventInput[] {
  const byId = new Map(records.map((r) => [r.external_id, r]));
  const at = now.toISOString();
  const events: ShopEventInput[] = [];
  for (const ext of diff.newProducts.slice(0, 100)) {
    const r = byId.get(ext);
    events.push({
      shop_id: shopId,
      type: "new_product",
      occurred_at: at,
      ref_id: ids.get(ext) ?? null,
      payload: {
        title: r?.title ?? ext,
        handle: r?.handle ?? null,
        price: r?.price_min ?? null,
        image_url: r?.image_url ?? null,
      },
      dedupe_key: `new_product:${shopId}:${ext}`,
    });
  }
  for (const c of diff.priceChanges.slice(0, 100)) {
    const r = byId.get(c.external_id);
    events.push({
      shop_id: shopId,
      type: "price_change",
      occurred_at: at,
      ref_id: ids.get(c.external_id) ?? null,
      payload: {
        title: r?.title ?? c.external_id,
        handle: r?.handle ?? null,
        from: c.from,
        to: c.to,
      },
      dedupe_key: `price:${shopId}:${c.external_id}:${capturedOn}`,
    });
  }
  for (const ext of diff.removedProducts.slice(0, 100)) {
    events.push({
      shop_id: shopId,
      type: "removed_product",
      occurred_at: at,
      ref_id: null,
      payload: { external_id: ext },
      dedupe_key: `removed:${shopId}:${ext}:${capturedOn}`,
    });
  }
  return events;
}

/** Eerste snapshot: "nieuw" = gepubliceerd in de afgelopen 24 uur. */
function countRecentlyPublished(records: ProductRecord[], now: Date): number {
  const since = now.getTime() - 86_400_000;
  return records.filter((r) => {
    const t = Date.parse(r.published_at ?? r.created_at_shop ?? "");
    return Number.isFinite(t) && t >= since;
  }).length;
}

/** Prijzen van de top-10 bestsellers; zonder bestsellers alle producten. */
function bestsellerPrices(records: ProductRecord[], handles: string[]): (number | null)[] {
  const byHandle = new Map(records.map((r) => [r.handle, r]));
  const top = handles.slice(0, 10).flatMap((h) => {
    const r = byHandle.get(h);
    return r ? [r.price_min] : [];
  });
  return top.length > 0 ? top : records.map((r) => r.price_min);
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
