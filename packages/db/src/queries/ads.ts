import { escapeLike, type AdFilters, type AdvertiserFilters } from "@trendtrack/core";
import type { Db } from "../client";

const AD_COLUMNS =
  "id, platform, external_id, body, title, landing_url, landing_domain, media_type, snapshot_url, started_at, ended_at, is_active, run_days_final, eu_total_reach, est_spend_low, est_spend_high, countries, languages, shop_id, advertiser_id, advertisers(page_name, page_id), shops(domain, name)";

export async function listAds(db: Db, f: AdFilters, now = new Date()) {
  let q = db.from("ads").select(AD_COLUMNS, { count: "exact" });
  if (f.q) q = q.textSearch("fts", f.q, { type: "websearch", config: "simple" });
  if (f.country) q = q.contains("countries", [f.country]);
  if (f.language) q = q.contains("languages", [f.language]);
  if (f.active !== undefined) q = q.eq("is_active", f.active);
  if (f.min_reach !== undefined) q = q.gte("eu_total_reach", f.min_reach);
  if (f.media_type) q = q.eq("media_type", f.media_type);
  if (f.domain) q = q.eq("landing_domain", f.domain.toLowerCase());
  if (f.advertiser_id) q = q.eq("advertiser_id", f.advertiser_id);
  if (f.min_days !== undefined && f.min_days > 0) {
    // Lopende ads: gestart vóór (nu − N dagen). Gestopte ads: hun eindlooptijd ≥ N.
    const before = new Date(now.getTime() - f.min_days * 86_400_000).toISOString();
    q = q.or(`and(is_active.eq.true,started_at.lte.${before}),run_days_final.gte.${f.min_days}`);
  }
  const order =
    f.sort === "reach"
      ? { column: "eu_total_reach", ascending: false }
      : f.sort === "longest"
        ? { column: "started_at", ascending: true }
        : { column: "started_at", ascending: false };
  const from = (f.page - 1) * f.per_page;
  const { data, count, error } = await q
    .order(order.column, { ascending: order.ascending, nullsFirst: false })
    .order("id")
    .range(from, from + f.per_page - 1);
  if (error) throw error;
  return { rows: data, total: count ?? 0, page: f.page, perPage: f.per_page };
}
export type AdRow = Awaited<ReturnType<typeof listAds>>["rows"][number];

export async function getAd(db: Db, id: string): Promise<AdRow | null> {
  const { data, error } = await db.from("ads").select(AD_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAdsByIds(db: Db, ids: string[]): Promise<AdRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db.from("ads").select(AD_COLUMNS).in("id", ids);
  if (error) throw error;
  return data;
}

/** Looptijd in dagen: tot vandaag voor lopende ads, anders tot de stopdatum. */
export function adRunDays(
  ad: { started_at: string | null; ended_at: string | null; is_active: boolean },
  now = new Date(),
): number | null {
  if (!ad.started_at) return null;
  const end = !ad.is_active && ad.ended_at ? Date.parse(ad.ended_at) : now.getTime();
  return Math.max(0, Math.floor((end - Date.parse(ad.started_at)) / 86_400_000));
}

export async function listAdvertisers(db: Db, f: AdvertiserFilters) {
  let q = db.from("advertiser_stats").select("*", { count: "exact" });
  if (f.q) {
    const term = escapeLike(f.q);
    if (term) q = q.or(`page_name.ilike.%${term}%,shop_domain.ilike.%${term}%`);
  }
  if (f.country) q = q.eq("country", f.country);
  const from = (f.page - 1) * f.per_page;
  const { data, count, error } = await q
    .order(f.sort === "reach" ? "total_reach" : "active_ads", { ascending: false })
    .order("total_reach", { ascending: false })
    .range(from, from + f.per_page - 1);
  if (error) throw error;
  return { rows: data, total: count ?? 0, page: f.page, perPage: f.per_page };
}

export async function getAdvertiser(db: Db, id: string) {
  const { data, error } = await db.from("advertiser_stats").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}
