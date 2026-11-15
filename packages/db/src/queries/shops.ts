import { escapeLike, normalizeDomain, type ShopFilters } from "@trendtrack/core";
import type { Db } from "../client";

export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  perPage: number;
}

const SHOP_LIST_COLUMNS =
  "id, domain, name, country, currency, theme_name, niche, apps, status, first_seen_at, active_ads_count, growth_score, est_monthly_revenue, est_monthly_revenue_low, est_monthly_revenue_high, est_confidence";

const SORT: Record<ShopFilters["sort"], { column: string; ascending: boolean }> = {
  growth: { column: "growth_score", ascending: false },
  revenue: { column: "est_monthly_revenue", ascending: false },
  ads: { column: "active_ads_count", ascending: false },
  newest: { column: "first_seen_at", ascending: false },
  name: { column: "name", ascending: true },
};

export async function listShops(db: Db, f: ShopFilters) {
  let q = db.from("shops").select(SHOP_LIST_COLUMNS, { count: "exact" }).eq("status", "active");
  if (f.q) {
    const term = escapeLike(f.q);
    if (term) q = q.or(`domain.ilike.%${term}%,name.ilike.%${term}%`);
  }
  if (f.country) q = q.eq("country", f.country);
  if (f.niche) q = q.eq("niche", f.niche);
  if (f.theme) q = q.eq("theme_name", f.theme);
  if (f.app) q = q.contains("apps", JSON.stringify([f.app]));
  if (f.revenue_min !== undefined) q = q.gte("est_monthly_revenue", f.revenue_min);
  if (f.revenue_max !== undefined) q = q.lte("est_monthly_revenue", f.revenue_max);
  if (f.ads_min !== undefined) q = q.gte("active_ads_count", f.ads_min);
  if (f.growth_min !== undefined) q = q.gte("growth_score", f.growth_min);
  if (f.first_seen_after) q = q.gte("first_seen_at", f.first_seen_after);

  const sort = SORT[f.sort];
  const ascending = f.order ? f.order === "asc" : sort.ascending;
  const from = (f.page - 1) * f.per_page;
  const { data, count, error } = await q
    .order(sort.column, { ascending, nullsFirst: false })
    .order("domain")
    .range(from, from + f.per_page - 1);
  if (error) throw error;
  return { rows: data, total: count ?? 0, page: f.page, perPage: f.per_page };
}
export type ShopListRow = Awaited<ReturnType<typeof listShops>>["rows"][number];

export async function getShopByDomain(db: Db, domain: string) {
  const { data, error } = await db
    .from("shops")
    .select("*")
    .eq("domain", normalizeDomain(domain))
    .maybeSingle();
  if (error) throw error;
  return data;
}
export type ShopDetail = NonNullable<Awaited<ReturnType<typeof getShopByDomain>>>;

export async function getShopSnapshots(db: Db, shopId: string, days = 90) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await db
    .from("shop_snapshots")
    .select(
      "captured_on, est_daily_revenue, est_daily_revenue_low, est_daily_revenue_high, active_ads_count, product_count, new_products",
    )
    .eq("shop_id", shopId)
    .gte("captured_on", since)
    .order("captured_on");
  if (error) throw error;
  return data;
}

const PRODUCT_COLUMNS =
  "id, external_id, handle, title, product_type, vendor, price_min, price_max, compare_at_price, image_url, published_at, first_seen_at";

export async function listShopProducts(
  db: Db,
  shopId: string,
  opts: { sort?: "newest" | "price"; limit?: number; offset?: number } = {},
) {
  const { sort = "newest", limit = 24, offset = 0 } = opts;
  const { data, count, error } = await db
    .from("products")
    .select(PRODUCT_COLUMNS, { count: "exact" })
    .eq("shop_id", shopId)
    .order(sort === "price" ? "price_min" : "published_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

/** Bestsellers volgens de laatste snapshot met posities. Leeg als de shop geen bestseller-data heeft. */
export async function listShopBestsellers(db: Db, shopId: string, limit = 12) {
  const { data: latest, error: e1 } = await db
    .from("product_snapshots")
    .select("captured_on, products!inner(shop_id)")
    .eq("products.shop_id", shopId)
    .not("position_in_bestsellers", "is", null)
    .order("captured_on", { ascending: false })
    .limit(1);
  if (e1) throw e1;
  const date = latest[0]?.captured_on;
  if (!date) return { capturedOn: null, rows: [] };
  const { data, error } = await db
    .from("product_snapshots")
    .select(`position_in_bestsellers, products!inner(${PRODUCT_COLUMNS}, shop_id)`)
    .eq("products.shop_id", shopId)
    .eq("captured_on", date)
    .not("position_in_bestsellers", "is", null)
    .order("position_in_bestsellers")
    .limit(limit);
  if (error) throw error;
  return {
    capturedOn: date,
    rows: data.map((r) => ({ position: r.position_in_bestsellers!, ...r.products })),
  };
}

export interface ShopFacets {
  countries: string[];
  niches: string[];
  themes: string[];
}

export async function getShopFacets(db: Db): Promise<ShopFacets> {
  const { data, error } = await db.rpc("shop_facets");
  if (error) throw error;
  const f = (data ?? {}) as Partial<ShopFacets>;
  return { countries: f.countries ?? [], niches: f.niches ?? [], themes: f.themes ?? [] };
}

export type ShopEventType =
  "new_ad" | "stopped_ad" | "new_product" | "removed_product" | "price_change" | "new_email";

/** Veranderingen bij één of meer shops, nieuwste eerst (Brandtracker-feed, prijswijzigingen). */
export async function listShopEvents(
  db: Db,
  shopIds: string[],
  opts: { types?: ShopEventType[]; since?: string; limit?: number } = {},
) {
  if (shopIds.length === 0) return [];
  let q = db
    .from("shop_events")
    .select("id, shop_id, type, occurred_at, ref_id, payload, shops!inner(domain, name)")
    .in("shop_id", shopIds);
  if (opts.types?.length) q = q.in("type", opts.types);
  if (opts.since) q = q.gte("occurred_at", opts.since);
  const { data, error } = await q
    .order("occurred_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (error) throw error;
  return data;
}
export type ShopEventRow = Awaited<ReturnType<typeof listShopEvents>>[number];

/**
 * Alles over één shop in één keer: detail, aantallen producten, samenvatting van ads en e-mails
 * en de laatste 30 dagen snapshots. Gedeeld door de REST API en de MCP-server.
 */
export async function getShopOverview(db: Db, domain: string) {
  const shop = await getShopByDomain(db, domain);
  if (!shop) return null;
  const [products, ads, emails, history] = await Promise.all([
    db.from("products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    db
      .from("ads")
      .select("is_active, eu_total_reach, est_spend_low, est_spend_high")
      .eq("shop_id", shop.id)
      .limit(10_000),
    db
      .from("emails")
      .select("type, received_at")
      .eq("shop_id", shop.id)
      .order("received_at", { ascending: false })
      .limit(10_000),
    getShopSnapshots(db, shop.id, 30),
  ]);
  if (ads.error) throw ads.error;
  if (emails.error) throw emails.error;
  const adRows = ads.data;
  const sum = (f: (a: (typeof adRows)[number]) => number | null) =>
    adRows.reduce((s, a) => s + (f(a) ?? 0), 0);
  const byType = { welcome: 0, flow: 0, campaign: 0 };
  for (const e of emails.data) byType[e.type]++;
  return {
    shop,
    productCount: products.count ?? 0,
    ads: {
      active: adRows.filter((a) => a.is_active).length,
      total: adRows.length,
      totalReach: sum((a) => a.eu_total_reach),
      spendLow: sum((a) => a.est_spend_low),
      spendHigh: sum((a) => a.est_spend_high),
    },
    emails: {
      count: emails.data.length,
      byType,
      lastReceivedAt: emails.data[0]?.received_at ?? null,
    },
    history,
  };
}
