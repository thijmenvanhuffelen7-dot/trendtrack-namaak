import { serviceDb } from "@/lib/server/db";
import { limited, toolError } from "@/lib/public/respond";
import {
  exportProductsPublic,
  hitPublicLimit,
  parseDomain,
  productsToCsv,
} from "@/lib/public/tools";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

/** Productexport als CSV (max 250 producten, gratis). ?format=json voor de preview. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const domain = parseDomain(url.searchParams.get("domain"));
    const hit = await hitPublicLimit(serviceDb(), req.headers, "products");
    if (!hit.allowed) return limited(hit.resetAt);
    const rows = await exportProductsPublic(domain);
    if (url.searchParams.get("format") === "json") {
      return Response.json({
        domain,
        count: rows.length,
        preview: rows
          .slice(0, 10)
          .map((r) => ({ title: r.title, price: r.price_min, type: r.product_type })),
        csv: productsToCsv(domain, rows),
      });
    }
    return new Response(productsToCsv(domain, rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${domain}-producten.csv"`,
      },
    });
  } catch (err) {
    return toolError(err);
  }
}
