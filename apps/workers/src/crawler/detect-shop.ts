import {
  normalizeDomain,
  parseShopifyHomepage,
  ShopifyMetaSchema,
  type ShopifyPageInfo,
  type ShopStatus,
} from "@trendtrack/core";
import { BlockedError, RobotsDisallowedError, UnreachableError } from "@trendtrack/core";
import { logOf, nowOf, type CrawlerDeps } from "./deps";

export interface DetectResult {
  domain: string;
  shopId: string;
  status: ShopStatus;
  isShopify: boolean;
  info: ShopifyPageInfo | null;
  linkedAds: number;
}

/**
 * Haalt de homepage op en bepaalt of het een Shopify-store is, plus naam, valuta, land,
 * thema en apps. Blokkeert de shop ons, dan markeren we hem als `blocked`.
 */
export async function detectShop(input: string, deps: CrawlerDeps): Promise<DetectResult> {
  const domain = normalizeDomain(input);
  const log = logOf(deps);
  const crawledAt = nowOf(deps).toISOString();

  let html: string;
  let finalUrl: string;
  try {
    const { response, url } = await deps.fetcher.get(`https://${domain}/`, { accept: "text/html" });
    if (response.status === 404 || response.status === 410) {
      return finish(domain, "dead", null, deps, crawledAt);
    }
    html = await response.text();
    finalUrl = url;
  } catch (err) {
    if (err instanceof BlockedError || err instanceof RobotsDisallowedError) {
      log("shop blokkeert crawler", { domain, reason: err.message });
      return finish(domain, "blocked", null, deps, crawledAt);
    }
    if (err instanceof UnreachableError && err.kind === "dns") {
      log("domein bestaat niet", { domain });
      return finish(domain, "dead", null, deps, crawledAt);
    }
    // Tijdelijke netwerkfout: status niet aanpassen, de job wordt opnieuw geprobeerd.
    throw err;
  }

  const info = parseShopifyHomepage(html);
  // Gesloten Shopify-store (wachtwoordpagina) telt als niet actief.
  if (new URL(finalUrl).pathname.startsWith("/password")) {
    return finish(domain, "dead", { ...info, isShopify: true }, deps, crawledAt);
  }

  if (info.isShopify) await enrichFromMetaJson(domain, info, deps);
  return finish(domain, "active", info, deps, crawledAt);
}

/** /meta.json vult ontbrekende velden aan (naam, land, valuta). Fouten zijn niet erg. */
async function enrichFromMetaJson(domain: string, info: ShopifyPageInfo, deps: CrawlerDeps) {
  const url = `https://${domain}/meta.json`;
  try {
    if (!(await deps.fetcher.isAllowed(url))) return;
    const meta = ShopifyMetaSchema.safeParse(await deps.fetcher.getJson(url));
    if (!meta.success) return;
    info.name ??= meta.data.name ?? null;
    info.country ??= meta.data.country?.toUpperCase() ?? null;
    info.currency ??= meta.data.currency?.toUpperCase() ?? null;
    info.myshopifyDomain ??= meta.data.myshopify_domain ?? null;
  } catch {
    // optioneel
  }
}

async function finish(
  domain: string,
  status: ShopStatus,
  info: ShopifyPageInfo | null,
  deps: CrawlerDeps,
  crawledAt: string,
): Promise<DetectResult> {
  const fields = info
    ? {
        status,
        name: info.name,
        country: validOrNull(info.country, /^[A-Z]{2}$/),
        currency: validOrNull(info.currency, /^[A-Z]{3}$/),
        platform: info.isShopify ? "shopify" : "other",
        theme_name: info.themeName,
        apps: info.apps,
        last_crawled_at: crawledAt,
      }
    : { status, last_crawled_at: crawledAt };

  const shop = await deps.repo.upsertShop(domain, fields);
  const linkedAds = status === "active" ? await deps.repo.linkAdsToShop(domain, shop.id) : 0;
  return { domain, shopId: shop.id, status, isShopify: info?.isShopify ?? false, info, linkedAds };
}

function validOrNull(v: string | null, re: RegExp): string | null {
  return v && re.test(v) ? v : null;
}
