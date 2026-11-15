import type { AdRow } from "../queries/ads";
import type { EmailRow } from "../queries/emails";
import type { ShopListRow } from "../queries/shops";
import { adRunDays } from "../queries/ads";
import type { z } from "zod";
import type { Ad, Advertiser, Email, MoneyEstimate, Product, Shop, SpendEstimate } from "./schemas";

const num = (v: number | string | null | undefined) =>
  v === null || v === undefined ? null : Number(v);

export function money(
  low: unknown,
  mid: unknown,
  high: unknown,
  confidence: unknown,
): z.infer<typeof MoneyEstimate> | null {
  const l = num(low as number);
  const h = num(high as number);
  if (l === null || h === null) return null;
  return {
    low: l,
    mid: num(mid as number),
    high: h,
    confidence: num(confidence as number),
    currency: "EUR",
    estimate: true,
  };
}

export function spend(low: unknown, high: unknown): z.infer<typeof SpendEstimate> | null {
  const l = num(low as number);
  const h = num(high as number);
  return l === null || h === null || h <= 0
    ? null
    : { low: l, high: h, currency: "EUR", estimate: true };
}

const apps = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export function toShop(s: ShopListRow, origin: string): z.infer<typeof Shop> {
  return {
    domain: s.domain,
    name: s.name,
    country: s.country,
    currency: s.currency,
    niche: s.niche,
    theme: s.theme_name,
    apps: apps(s.apps),
    status: s.status,
    first_seen_at: s.first_seen_at,
    active_ads: s.active_ads_count,
    growth_score: s.growth_score,
    monthly_revenue: money(
      s.est_monthly_revenue_low,
      s.est_monthly_revenue,
      s.est_monthly_revenue_high,
      s.est_confidence,
    ),
    url: `${origin}/app/shops/${s.domain}`,
  };
}

export function toProduct(
  p: {
    id: string;
    external_id: string;
    title: string;
    handle: string | null;
    product_type: string | null;
    vendor: string | null;
    price_min: number | null;
    price_max: number | null;
    compare_at_price: number | null;
    image_url: string | null;
    published_at: string | null;
    first_seen_at: string;
  },
  domain: string,
): z.infer<typeof Product> {
  return {
    id: p.id,
    external_id: p.external_id,
    title: p.title,
    handle: p.handle,
    product_type: p.product_type,
    vendor: p.vendor,
    price_min: num(p.price_min),
    price_max: num(p.price_max),
    compare_at_price: num(p.compare_at_price),
    image_url: p.image_url,
    published_at: p.published_at,
    first_seen_at: p.first_seen_at,
    url: p.handle ? `https://${domain}/products/${p.handle}` : null,
  };
}

export function toAd(a: AdRow): z.infer<typeof Ad> {
  return {
    id: a.id,
    platform: a.platform,
    external_id: a.external_id,
    advertiser: {
      id: a.advertiser_id,
      name: a.advertisers?.page_name ?? null,
      page_id: a.advertisers?.page_id ?? null,
    },
    shop_domain: a.shops?.domain ?? null,
    title: a.title,
    body: a.body,
    landing_url: a.landing_url,
    landing_domain: a.landing_domain,
    media_type: a.media_type,
    library_url: a.snapshot_url,
    started_at: a.started_at,
    ended_at: a.ended_at,
    is_active: a.is_active,
    days_running: adRunDays(a),
    eu_total_reach: num(a.eu_total_reach),
    spend: spend(a.est_spend_low, a.est_spend_high),
    countries: a.countries,
    languages: a.languages,
  };
}

export function toEmail(e: EmailRow, origin: string): z.infer<typeof Email> {
  return {
    id: e.id,
    shop_domain: e.shops.domain,
    shop_name: e.shops.name,
    from: e.from_address,
    subject: e.subject,
    preheader: e.preheader,
    preview: e.text_preview,
    type: e.type,
    flow_step: e.flow_step,
    received_at: e.received_at,
    url: `${origin}/app/emails/${e.id}`,
  };
}

export function toAdvertiser(a: {
  id: string | null;
  platform: string | null;
  page_id: string | null;
  page_name: string | null;
  country: string | null;
  shop_domain: string | null;
  active_ads: number | null;
  total_ads: number | null;
  total_reach: number | null;
  est_spend_low: number | null;
  est_spend_high: number | null;
  last_ad_started_at: string | null;
}): z.infer<typeof Advertiser> {
  return {
    id: a.id ?? "",
    platform: a.platform ?? "meta",
    page_id: a.page_id ?? "",
    name: a.page_name,
    country: a.country,
    shop_domain: a.shop_domain,
    active_ads: a.active_ads ?? 0,
    total_ads: a.total_ads ?? 0,
    total_eu_reach: Number(a.total_reach ?? 0),
    spend: spend(a.est_spend_low, a.est_spend_high),
    last_ad_started_at: a.last_ad_started_at,
  };
}
