import { getAdvertiser } from "@trendtrack/db";
import { ApiError, apiRoute, notFound } from "@/lib/api/handler";
import { toAdvertiser } from "@/lib/api/serialize";
import { serviceDb } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** GET /api/v1/advertisers/{id} */
export const GET = apiRoute<{ id: string }>(serviceDb, async (_req, ctx, { id }) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(400, "bad_request", "Ongeldig id");
  const a = await getAdvertiser(ctx.db, id);
  if (!a) throw notFound("Adverteerder");
  return toAdvertiser(a);
});
