import { tryNormalizeDomain } from "@trendtrack/core";
import { getShopByDomain, listShopProducts } from "@trendtrack/db";
import { ApiError, apiRoute, notFound, parseQuery } from "@/lib/api/handler";
import { nextCursor, pageFrom } from "@/lib/api/cursor";
import { ProductsQuery } from "@/lib/api/schemas";
import { toProduct } from "@/lib/api/serialize";
import { serviceDb } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** GET /api/v1/shops/{domain}/products — producten, nieuwste of duurste eerst. */
export const GET = apiRoute<{ domain: string }>(serviceDb, async (req, ctx, { domain: raw }) => {
  const domain = tryNormalizeDomain(decodeURIComponent(raw));
  if (!domain) throw new ApiError(400, "bad_request", "Ongeldig domein");
  const { sort, limit, cursor } = parseQuery(ProductsQuery, req);
  const shop = await getShopByDomain(ctx.db, domain);
  if (!shop) throw notFound(`Shop ${domain}`);
  const { page, perPage } = pageFrom({ limit, cursor });
  const r = await listShopProducts(ctx.db, shop.id, {
    sort,
    limit: perPage,
    offset: (page - 1) * perPage,
  });
  return {
    data: r.rows.map((p) => toProduct(p, domain)),
    total: r.total,
    next_cursor: nextCursor(page, perPage, r.total),
  };
});
