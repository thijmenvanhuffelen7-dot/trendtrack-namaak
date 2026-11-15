import { listEmails } from "@trendtrack/db";
import { apiRoute, parseQuery } from "@/lib/api/handler";
import { nextCursor, pageFrom } from "@/lib/api/cursor";
import { EmailsQuery } from "@/lib/api/schemas";
import { toEmail } from "@/lib/api/serialize";
import { serviceDb } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** GET /api/v1/emails — nieuwsbrieven met filters (type, shop, niche, periode). */
export const GET = apiRoute(serviceDb, async (req, ctx) => {
  const { limit, cursor, ...filters } = parseQuery(EmailsQuery, req);
  const { page, perPage } = pageFrom({ limit, cursor });
  const r = await listEmails(ctx.db, { ...filters, page, per_page: perPage });
  return {
    data: r.rows.map((e) => toEmail(e, ctx.origin)),
    total: r.total,
    next_cursor: nextCursor(page, perPage, r.total),
  };
});
