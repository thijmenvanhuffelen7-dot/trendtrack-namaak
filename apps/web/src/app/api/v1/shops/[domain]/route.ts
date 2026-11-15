import { tryNormalizeDomain } from "@trendtrack/core";
import { getShopOverview } from "@trendtrack/db";
import type { z } from "zod";
import { ApiError, apiRoute, notFound } from "@/lib/api/handler";
import type { ShopDetail } from "@/lib/api/schemas";
import { money, spend, toShop } from "@/lib/api/serialize";
import { serviceDb } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** GET /api/v1/shops/{domain} — detail met schattingen, tech en samenvatting van ads en e-mails. */
export const GET = apiRoute<{ domain: string }>(serviceDb, async (_req, ctx, { domain: raw }) => {
  const domain = tryNormalizeDomain(decodeURIComponent(raw));
  if (!domain) throw new ApiError(400, "bad_request", "Ongeldig domein");
  const o = await getShopOverview(ctx.db, domain);
  if (!o) throw notFound(`Shop ${domain} (vraag hem op via POST /api/v1/lookups)`);
  const s = o.shop;
  const body: z.infer<typeof ShopDetail> = {
    ...toShop(s, ctx.origin),
    platform: s.platform,
    last_crawled_at: s.last_crawled_at,
    monthly_orders:
      s.est_monthly_orders_low !== null && s.est_monthly_orders_high !== null
        ? {
            low: s.est_monthly_orders_low,
            mid: s.est_monthly_orders,
            high: s.est_monthly_orders_high,
            estimate: true,
          }
        : null,
    estimate_signals: Object.keys((s.est_signals ?? {}) as Record<string, unknown>),
    products: { count: o.productCount },
    ads: {
      active: o.ads.active,
      total: o.ads.total,
      total_eu_reach: o.ads.totalReach,
      spend: spend(o.ads.spendLow, o.ads.spendHigh),
    },
    emails: {
      count: o.emails.count,
      by_type: o.emails.byType,
      last_received_at: o.emails.lastReceivedAt,
    },
    history: o.history.map((h) => ({
      date: h.captured_on,
      daily_revenue: money(
        h.est_daily_revenue_low,
        h.est_daily_revenue,
        h.est_daily_revenue_high,
        null,
      ),
      active_ads: h.active_ads_count,
    })),
  };
  return body;
});
