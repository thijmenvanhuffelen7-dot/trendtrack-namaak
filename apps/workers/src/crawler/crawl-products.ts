import {
  dominantProductType,
  normalizeDomain,
  parseProductsPage,
  toProductRecord,
  type ProductRecord,
} from "@trendtrack/core";
import { BlockedError } from "../http/errors";
import type { PoliteFetcher } from "../http/polite-fetcher";
import { logOf, nowOf, type CrawlerDeps } from "./deps";

export interface CrawlProductsResult {
  domain: string;
  products: number;
  pages: number;
  blocked: boolean;
}

/** Shopify geeft max 250 per pagina; 100 pagina's = 25.000 producten is ruim genoeg. */
const MAX_PAGES = 100;

export interface FetchAllProductsResult {
  records: ProductRecord[];
  pages: number;
  /** True als de shop ons halverwege blokkeerde; `records` is dan onvolledig. */
  blocked: boolean;
}

/** Pagineert door /products.json tot een lege pagina. Slaat niets op. */
export async function fetchAllProducts(
  domain: string,
  fetcher: PoliteFetcher,
  log: (msg: string, extra?: Record<string, unknown>) => void = () => undefined,
): Promise<FetchAllProductsResult> {
  const records: ProductRecord[] = [];
  let page = 1;
  try {
    for (; page <= MAX_PAGES; page++) {
      const products = parseProductsPage(
        await fetcher.getJson(`https://${domain}/products.json?limit=250&page=${page}`),
      );
      if (products.length === 0) break;
      records.push(...products.map(toProductRecord));
      log("pagina opgehaald", { domain, page, count: products.length });
    }
  } catch (err) {
    if (err instanceof BlockedError) return { records, pages: page - 1, blocked: true };
    throw err;
  }
  return { records, pages: page - 1, blocked: false };
}

/** Haalt alle producten op en upsert ze. */
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
  const { records, pages, blocked } = await fetchAllProducts(domain, deps.fetcher, log);
  const saved = await deps.repo.upsertProducts(shop.id, records, seenAt);
  if (blocked) {
    await deps.repo.upsertShop(domain, { status: "blocked" });
    log("geblokkeerd tijdens product-crawl", { domain, page: pages + 1 });
  } else {
    await deps.repo.upsertShop(domain, {
      last_crawled_at: seenAt,
      niche: dominantProductType(records),
    });
  }
  return { domain, products: saved, pages, blocked };
}
