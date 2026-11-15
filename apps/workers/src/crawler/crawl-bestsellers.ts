import { extractProductHandles, normalizeDomain, parseProductsPage } from "@trendtrack/core";
import { BlockedError, RobotsDisallowedError } from "@trendtrack/core";
import { isoDate, logOf, nowOf, type CrawlerDeps } from "./deps";

export type BestsellerSource = "sort_by" | "collection" | "none";

export interface CrawlBestsellersResult {
  domain: string;
  source: BestsellerSource;
  /** Gebruikte URL (of null als niets bruikbaar was). */
  url: string | null;
  saved: number;
  /** Product-handles in bestsellervolgorde (positie 1 eerst). */
  handles: string[];
}

/**
 * Collecties die winkels zelf als "bestsellers" bijhouden. De standaard Shopify-robots.txt
 * verbiedt `/collections/*sort_by*`, dus `sort_by=best-selling` mag bijna nooit. Dan vallen we
 * terug op deze (handmatig of door een app gesorteerde) collecties.
 */
const BESTSELLER_COLLECTIONS = [
  "bestsellers",
  "best-sellers",
  "bestseller",
  "best-seller",
  "best-selling",
  "meest-verkocht",
  "populair",
  "top-sellers",
];

export async function crawlBestsellers(
  input: string,
  deps: CrawlerDeps,
): Promise<CrawlBestsellersResult> {
  const domain = normalizeDomain(input);
  const log = logOf(deps);
  const shop = await deps.repo.getShop(domain);
  if (!shop || shop.status !== "active" || shop.platform !== "shopify") {
    return { domain, source: "none", url: null, saved: 0, handles: [] };
  }
  const capturedOn = isoDate(nowOf(deps));

  try {
    // 1. Alleen als robots.txt het toestaat: de echte best-selling sortering.
    const sortUrl = `https://${domain}/collections/all?sort_by=best-selling`;
    if (await deps.fetcher.isAllowed(sortUrl)) {
      const { response } = await deps.fetcher.get(sortUrl, { accept: "text/html" });
      if (response.ok) {
        const handles = extractProductHandles(await response.text());
        if (handles.length > 0) {
          const saved = await deps.repo.saveBestsellerPositions(shop.id, handles, capturedOn);
          return { domain, source: "sort_by", url: sortUrl, saved, handles };
        }
      }
    } else {
      log("sort_by=best-selling verboden door robots.txt; probeer bestseller-collecties", {
        domain,
      });
    }

    // 2. Fallback: een bestseller-collectie van de winkel zelf.
    for (const handle of BESTSELLER_COLLECTIONS) {
      const url = `https://${domain}/collections/${handle}/products.json?limit=250`;
      if (!(await deps.fetcher.isAllowed(url))) continue;
      const { response } = await deps.fetcher.get(url, { accept: "application/json" });
      if (!response.ok) continue;
      const products = parseProductsPage(await response.json());
      if (products.length === 0) continue;
      const handles = products.map((p) => p.handle);
      const saved = await deps.repo.saveBestsellerPositions(shop.id, handles, capturedOn);
      return { domain, source: "collection", url, saved, handles };
    }
  } catch (err) {
    if (err instanceof BlockedError) {
      await deps.repo.upsertShop(domain, { status: "blocked" });
      return { domain, source: "none", url: null, saved: 0, handles: [] };
    }
    if (!(err instanceof RobotsDisallowedError)) throw err;
  }

  return { domain, source: "none", url: null, saved: 0, handles: [] };
}
