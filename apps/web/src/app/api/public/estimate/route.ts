import { getShopByDomain } from "@trendtrack/db";
import { serviceDb } from "@/lib/server/db";
import { limited, toolError } from "@/lib/public/respond";
import { hitPublicLimit, parseDomain } from "@/lib/public/tools";

export const dynamic = "force-dynamic";

/** De zoekbalk op de homepage: de schattingsband van een bekende shop, of "nog niet bekend". */
export async function GET(req: Request) {
  try {
    const domain = parseDomain(new URL(req.url).searchParams.get("domain"));
    const hit = await hitPublicLimit(serviceDb(), req.headers, "estimate");
    if (!hit.allowed) return limited(hit.resetAt);
    const s = await getShopByDomain(serviceDb(), domain);
    if (!s || s.status === "dead") return Response.json({ domain, known: false });
    return Response.json({
      domain,
      known: true,
      name: s.name,
      country: s.country,
      niche: s.niche,
      theme: s.theme_name,
      active_ads: s.active_ads_count,
      growth_score: s.growth_score,
      monthly_revenue:
        s.est_monthly_revenue_low !== null && s.est_monthly_revenue_high !== null
          ? {
              low: Number(s.est_monthly_revenue_low),
              mid: Number(s.est_monthly_revenue),
              high: Number(s.est_monthly_revenue_high),
              confidence: s.est_confidence,
              estimate: true,
            }
          : null,
    });
  } catch (err) {
    return toolError(err);
  }
}
