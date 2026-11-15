import { growthScore, type DailySignal } from "@trendtrack/core";
import type pg from "pg";

export async function activeShopifyDomains(pool: pg.Pool): Promise<string[]> {
  const { rows } = await pool.query<{ domain: string }>(
    "select domain from public.shops where status = 'active' and platform = 'shopify'",
  );
  return rows.map((r) => r.domain);
}

/** Abonnementen die tellen als "betalend": actief of in proefperiode, niet gratis. */
const PAID = "sub.status in ('active', 'trialing') and sub.plan_id <> 'free'";

export async function paidTrackedDomains(pool: pg.Pool): Promise<string[]> {
  const { rows } = await pool.query<{ domain: string }>(
    `select distinct s.domain from public.tracked_brands tb
       join public.shops s on s.id = tb.shop_id and s.status = 'active'
       join public.subscriptions sub on sub.workspace_id = tb.workspace_id
      where ${PAID}`,
  );
  return rows.map((r) => r.domain);
}

export async function metaAdvertisers(
  pool: pg.Pool,
): Promise<{ all: string[]; tracked: string[] }> {
  const all = await pool.query<{ page_id: string }>(
    "select page_id from public.advertisers where platform = 'meta'",
  );
  const tracked = await pool.query<{ page_id: string }>(
    `select distinct a.page_id from public.advertisers a
       join public.tracked_brands tb on tb.shop_id = a.shop_id
       join public.subscriptions sub on sub.workspace_id = tb.workspace_id
      where a.platform = 'meta' and ${PAID}`,
  );
  return { all: all.rows.map((r) => r.page_id), tracked: tracked.rows.map((r) => r.page_id) };
}

/** Herberekent growth_score voor alle actieve shops uit de laatste 35 dagen snapshots. */
export async function recomputeGrowthScores(pool: pg.Pool): Promise<number> {
  const { rows } = await pool.query<{
    shop_id: string;
    captured_on: string;
    new_products: number | null;
    active_ads_count: number | null;
    est_daily_revenue: string | null;
  }>(
    `select ss.shop_id, to_char(ss.captured_on, 'YYYY-MM-DD') as captured_on, ss.new_products,
            ss.active_ads_count, ss.est_daily_revenue
       from public.shop_snapshots ss join public.shops s on s.id = ss.shop_id and s.status = 'active'
      where ss.captured_on > current_date - 35
      order by ss.shop_id, ss.captured_on`,
  );
  const byShop = new Map<string, DailySignal[]>();
  for (const r of rows) {
    const list = byShop.get(r.shop_id) ?? [];
    list.push({
      date: r.captured_on,
      selloutValue: null,
      reviewCount: null,
      activeAds: r.active_ads_count,
      newProducts: r.new_products,
      productCount: null,
      estDailyRevenue: r.est_daily_revenue === null ? null : Number(r.est_daily_revenue),
    });
    byShop.set(r.shop_id, list);
  }
  let updated = 0;
  for (const [shopId, days] of byShop) {
    await pool.query("update public.shops set growth_score = $2 where id = $1", [
      shopId,
      growthScore(days),
    ]);
    updated++;
  }
  return updated;
}
