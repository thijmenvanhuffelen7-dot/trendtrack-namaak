import { getAd } from "@trendtrack/db";
import { ApiError, apiRoute, notFound } from "@/lib/api/handler";
import { toAd } from "@/lib/api/serialize";
import { serviceDb } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** GET /api/v1/ads/{id} */
export const GET = apiRoute<{ id: string }>(serviceDb, async (_req, ctx, { id }) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(400, "bad_request", "Ongeldig id");
  const ad = await getAd(ctx.db, id);
  if (!ad) throw notFound("Ad");
  return toAd(ad);
});
