import { listAds } from "@trendtrack/db";
import { apiRoute, parseQuery } from "@/lib/api/handler";
import { nextCursor, pageFrom } from "@/lib/api/cursor";
import { AdsQuery } from "@/lib/api/schemas";
import { toAd } from "@/lib/api/serialize";
import { serviceDb } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** GET /api/v1/ads — ads met filters en full-text zoeken (q). */
export const GET = apiRoute(serviceDb, async (req, ctx) => {
  const { limit, cursor, ...filters } = parseQuery(AdsQuery, req);
  const { page, perPage } = pageFrom({ limit, cursor });
  const r = await listAds(ctx.db, { ...filters, page, per_page: perPage });
  return {
    data: r.rows.map(toAd),
    total: r.total,
    next_cursor: nextCursor(page, perPage, r.total),
  };
});
