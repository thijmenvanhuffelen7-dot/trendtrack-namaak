import { readFileSync } from "node:fs";
import type { ProductRecord } from "@trendtrack/core";
import type { CrawlerDeps } from "../crawler/deps";
import { PoliteFetcher, type FetchLike } from "../http/polite-fetcher";
import type { ShopFields, ShopRepo, ShopRow } from "../repo/shop-repo";

export const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

type Route = string | { status: number; body?: string; headers?: Record<string, string> };

/** Nep-netwerk: map van URL (zonder https://) naar body of response. Logt alle requests. */
export function fakeNetwork(routes: Record<string, Route>) {
  const calls: string[] = [];
  const fetch: FetchLike = async (url) => {
    calls.push(url);
    const key = url.replace(/^https?:\/\//, "");
    const route = routes[key];
    if (route === undefined) return new Response("not found", { status: 404 });
    if (typeof route === "string") return new Response(route, { status: 200 });
    return new Response(route.body ?? "", { status: route.status, headers: route.headers });
  };
  return { fetch, calls };
}

export function testFetcher(
  fetch: FetchLike,
  overrides: Partial<ConstructorParameters<typeof PoliteFetcher>[0]> = {},
) {
  return new PoliteFetcher({
    userAgent: "TrendTrackBot/test",
    robotsToken: "TrendTrackBot",
    fetch,
    resolveHost: async () => ["93.184.216.34"],
    sleep: async () => undefined,
    ...overrides,
  });
}

/** In-memory ShopRepo voor tests. */
export class MemoryShopRepo implements ShopRepo {
  shops = new Map<string, ShopRow & ShopFields>();
  products = new Map<string, ProductRecord & { shopId: string; seenAt: string }>();
  positions: { shopId: string; handle: string; position: number; capturedOn: string }[] = [];
  ads: { landing_domain: string; shop_id: string | null }[] = [];

  async getShop(domain: string) {
    return this.shops.get(domain) ?? null;
  }
  async upsertShop(domain: string, fields: ShopFields) {
    const prev = this.shops.get(domain);
    const row = {
      id: prev?.id ?? `shop-${this.shops.size + 1}`,
      domain,
      status: "active" as const,
      platform: null,
      ...prev,
      ...fields,
    };
    this.shops.set(domain, row);
    return row;
  }
  async upsertProducts(shopId: string, products: ProductRecord[], seenAt: string) {
    for (const p of products)
      this.products.set(`${shopId}:${p.external_id}`, { ...p, shopId, seenAt });
    return products.length;
  }
  async saveBestsellerPositions(shopId: string, handles: string[], capturedOn: string) {
    const known = new Set(
      [...this.products.values()].filter((p) => p.shopId === shopId).map((p) => p.handle),
    );
    const rows = handles
      .map((handle, i) => ({ shopId, handle, position: i + 1, capturedOn }))
      .filter((r) => known.has(r.handle));
    this.positions.push(...rows);
    return rows.length;
  }
  async linkAdsToShop(domain: string, shopId: string) {
    let n = 0;
    for (const ad of this.ads)
      if (ad.landing_domain === domain && !ad.shop_id) {
        ad.shop_id = shopId;
        n++;
      }
    return n;
  }
  async unknownAdDomains(limit: number) {
    const ds = [...new Set(this.ads.filter((a) => !a.shop_id).map((a) => a.landing_domain))];
    return ds.filter((d) => !this.shops.has(d)).slice(0, limit);
  }
  async existingDomains(domains: string[]) {
    return new Set(domains.filter((d) => this.shops.has(d)));
  }
}

export function deps(
  fetch: FetchLike,
  repo = new MemoryShopRepo(),
): CrawlerDeps & { repo: MemoryShopRepo } {
  return { fetcher: testFetcher(fetch), repo, now: () => new Date("2026-11-15T12:00:00Z") };
}
