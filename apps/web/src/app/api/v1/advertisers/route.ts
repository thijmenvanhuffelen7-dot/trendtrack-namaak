import { listAdvertisers } from "@trendtrack/db";
import { apiRoute, parseQuery } from "@/lib/api/handler";
import { nextCursor, pageFrom } from "@/lib/api/cursor";
import { AdvertisersQuery } from "@/lib/api/schemas";
import { toAdvertiser } from "@/lib/api/serialize";
import { serviceDb } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** GET /api/v1/advertisers — gesorteerd op actieve ads of bereik. */
export const GET = apiRoute(serviceDb, async (req, ctx) => {
  const { limit, cursor, ...filters } = parseQuery(AdvertisersQuery, req);
  const { page, perPage } = pageFrom({ limit, cursor });
  const r = await listAdvertisers(ctx.db, { ...filters, page, per_page: perPage });
  return {
    data: r.rows.map(toAdvertiser),
    total: r.total,
    next_cursor: nextCursor(page, perPage, r.total),
  };
});
