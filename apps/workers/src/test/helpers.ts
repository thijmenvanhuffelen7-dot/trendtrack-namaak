import { readFileSync } from "node:fs";
import type { DailySignal, ProductRecord, ProductState } from "@trendtrack/core";
import { summarizeAds, type ActiveAdRow } from "../repo/ad-stats";
import type {
  ProductSnapshotRow,
  ShopEstimateFields,
  ShopSnapshotRow,
  SnapshotRepo,
} from "../repo/snapshot-repo";
import type { SnapshotDeps } from "../snapshot/snapshot-shop";
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

/** In-memory SnapshotRepo, gekoppeld aan een MemoryShopRepo. */
export class MemorySnapshotRepo implements SnapshotRepo {
  productSnaps = new Map<string, ProductSnapshotRow>();
  shopSnaps = new Map<string, ShopSnapshotRow>();
  estimates = new Map<string, ShopEstimateFields>();
  activeAds: (ActiveAdRow & { shopId: string })[] = [];

  constructor(private readonly shops: MemoryShopRepo) {}

  async productIds(shopId: string) {
    const m = new Map<string, string>();
    for (const p of this.shops.products.values())
      if (p.shopId === shopId) m.set(p.external_id, `${shopId}:${p.external_id}`);
    return m;
  }
  async previousProductStates(shopId: string, beforeDate: string) {
    const prefix = `${shopId}:`;
    const rows = [...this.productSnaps.values()].filter(
      (r) => r.product_id.startsWith(prefix) && r.captured_on < beforeDate,
    );
    const date =
      rows
        .map((r) => r.captured_on)
        .sort()
        .at(-1) ?? null;
    const states: ProductState[] = rows
      .filter((r) => r.captured_on === date)
      .map((r) => ({
        external_id: r.product_id.slice(prefix.length),
        price: r.price,
        available_variants: r.available_variants,
        total_variants: r.inventory_signal.total_variants,
        position: r.position_in_bestsellers,
      }));
    return { date, states };
  }
  async saveProductSnapshots(rows: ProductSnapshotRow[]) {
    for (const r of rows) this.productSnaps.set(`${r.product_id}@${r.captured_on}`, r);
  }
  async shopHistory(shopId: string, sinceDate: string, untilDate: string): Promise<DailySignal[]> {
    return [...this.shopSnaps.values()]
      .filter(
        (r) => r.shop_id === shopId && r.captured_on >= sinceDate && r.captured_on < untilDate,
      )
      .sort((a, b) => a.captured_on.localeCompare(b.captured_on))
      .map((r) => ({
        date: r.captured_on,
        selloutValue: r.sellout_value,
        reviewCount: r.review_count,
        activeAds: r.active_ads_count,
        newProducts: r.new_products,
        productCount: r.product_count,
        estDailyRevenue: r.est_daily_revenue,
      }));
  }
  async adStats(shopId: string, asOf: Date) {
    return summarizeAds(
      this.activeAds.filter((a) => a.shopId === shopId),
      asOf,
    );
  }
  async saveShopSnapshot(row: ShopSnapshotRow) {
    this.shopSnaps.set(`${row.shop_id}@${row.captured_on}`, row);
  }
  async updateShopEstimate(shopId: string, fields: ShopEstimateFields) {
    this.estimates.set(shopId, fields);
  }
  async activeShopifyDomains(limit: number) {
    return [...this.shops.shops.values()]
      .filter((s) => s.status === "active" && s.platform === "shopify")
      .map((s) => s.domain)
      .slice(0, limit);
  }
}

export function deps(
  fetch: FetchLike,
  repo = new MemoryShopRepo(),
  now = new Date("2026-11-15T12:00:00Z"),
): SnapshotDeps & { repo: MemoryShopRepo; snapshots: MemorySnapshotRepo } {
  return {
    fetcher: testFetcher(fetch),
    repo,
    snapshots: new MemorySnapshotRepo(repo),
    now: () => now,
  };
}
