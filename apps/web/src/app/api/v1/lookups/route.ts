import { tryNormalizeDomain } from "@trendtrack/core";
import { getShopByDomain, requestLookup } from "@trendtrack/db";
import type { z } from "zod";
import { ApiError, apiRoute, parseBody } from "@/lib/api/handler";
import { LookupBody, type Lookup } from "@/lib/api/schemas";
import { serviceDb } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** POST /api/v1/lookups — zet een (nieuw) domein in de wachtrij. 202 als het opgehaald wordt. */
export const POST = apiRoute(
  serviceDb,
  async (req, ctx): Promise<z.infer<typeof Lookup>> => {
    const { domain: raw } = await parseBody(LookupBody, req);
    const domain = tryNormalizeDomain(raw);
    if (!domain)
      throw new ApiError(400, "bad_request", "Ongeldig domein", {
        domain: ["Geen geldig publiek domein"],
      });
    const shop_url = `${ctx.origin}/api/v1/shops/${domain}`;
    if (await getShopByDomain(ctx.db, domain)) return { domain, status: "known", shop_url };
    const lookup = await requestLookup(ctx.db, ctx.workspaceId, null, domain, "api");
    return { domain, status: lookup.status === "processing" ? "processing" : "queued", shop_url };
  },
  { status: 202 },
);
