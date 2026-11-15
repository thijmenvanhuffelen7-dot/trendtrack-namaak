import { normalizeDomain, parseProductsPage, toProductRecord } from "@trendtrack/core";
import { BlockedError } from "../http/errors";
import { logOf, nowOf, type CrawlerDeps } from "./deps";

export interface CrawlProductsResult {
  domain: string;
  products: number;
  pages: number;
  blocked: boolean;
}

/** Shopify geeft max 250 per pagina; 100 pagina's = 25.000 producten is ruim genoeg. */
const MAX_PAGES = 100;

/** Pagineert door /products.json tot een lege pagina en upsert alle producten. */
export async function crawlProducts(
  input: string,
  deps: CrawlerDeps,
): Promise<CrawlProductsResult> {
  const domain = normalizeDomain(input);
  const log = logOf(deps);
  const shop = await deps.repo.getShop(domain);
  if (!shop) throw new Error(`Shop ${domain} bestaat nog niet; draai eerst shop.detect`);
  if (shop.status !== "active" || shop.platform !== "shopify") {
    log("overgeslagen: geen actieve Shopify-store", { domain, status: shop.status });
    return { domain, products: 0, pages: 0, blocked: shop.status === "blocked" };
  }

  const seenAt = nowOf(deps).toISOString();
  let total = 0;
  let page = 1;
  try {
    for (; page <= MAX_PAGES; page++) {
      const json = await deps.fetcher.getJson(
        `https://${domain}/products.json?limit=250&page=${page}`,
      );
      const products = parseProductsPage(json);
      if (products.length === 0) break;
      total += await deps.repo.upsertProducts(shop.id, products.map(toProductRecord), seenAt);
      log("pagina opgeslagen", { domain, page, count: products.length });
    }
  } catch (err) {
    if (err instanceof BlockedError) {
      await deps.repo.upsertShop(domain, { status: "blocked" });
      log("geblokkeerd tijdens product-crawl", { domain, page });
      return { domain, products: total, pages: page - 1, blocked: true };
    }
    throw err;
  }

  await deps.repo.upsertShop(domain, { last_crawled_at: seenAt });
  return { domain, products: total, pages: page - 1, blocked: false };
}
