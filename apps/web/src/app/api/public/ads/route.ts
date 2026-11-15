import { AdFiltersSchema, parseFilters } from "@trendtrack/core";
import { listAds } from "@trendtrack/db";
import { toAd } from "@trendtrack/db/public-api";
import { serviceDb } from "@/lib/server/db";
import { limited, toolError } from "@/lib/public/respond";
import { hitPublicLimit, ToolError } from "@/lib/public/tools";

export const dynamic = "force-dynamic";

/** Winnende-ads-finder: de 12 langst lopende actieve ads voor een zoekwoord. De rest achter login. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
    if (q.length < 2)
      throw new ToolError(400, "Vul een zoekwoord in, bijvoorbeeld 'gratis verzending'.");
    const country = url.searchParams.get("country") ?? "NL";
    const hit = await hitPublicLimit(serviceDb(), req.headers, "ads");
    if (!hit.allowed) return limited(hit.resetAt);
    const r = await listAds(
      serviceDb(),
      parseFilters(AdFiltersSchema, {
        q,
        country,
        active: "true",
        sort: "longest",
        per_page: "12",
      }),
    );
    return Response.json({
      q,
      total: r.total,
      ads: r.rows.map((a) => {
        const ad = toAd(a);
        return {
          title: ad.title,
          body: ad.body,
          advertiser: ad.advertiser.name,
          landing_domain: ad.landing_domain,
          days_running: ad.days_running,
          eu_total_reach: ad.eu_total_reach,
          spend: ad.spend,
          library_url: ad.library_url,
        };
      }),
    });
  } catch (err) {
    return toolError(err);
  }
}
