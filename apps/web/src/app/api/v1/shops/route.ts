import { listShops } from "@trendtrack/db";
import { apiRoute, parseQuery } from "@/lib/api/handler";
import { nextCursor, pageFrom } from "@/lib/api/cursor";
import { ShopsQuery } from "@/lib/api/schemas";
import { toShop } from "@/lib/api/serialize";
import { serviceDb } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** GET /api/v1/shops — snelgroeiende shops met filters (zelfde als het dashboard). */
export const GET = apiRoute(serviceDb, async (req, ctx) => {
  const { limit, cursor, ...filters } = parseQuery(ShopsQuery, req);
  const { page, perPage } = pageFrom({ limit, cursor });
  const r = await listShops(ctx.db, { ...filters, page, per_page: perPage });
  return {
    data: r.rows.map((s) => toShop(s, ctx.origin)),
    total: r.total,
    next_cursor: nextCursor(page, perPage, r.total),
  };
});
