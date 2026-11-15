import type { Db } from "@trendtrack/db";
import type { DailySignal, ProductRecord, ProductState } from "@trendtrack/core";
import { summarizeAds } from "./ad-stats";
import type { ShopFields, ShopRepo, ShopRow } from "./shop-repo";
import type {
  AdStats,
  ProductSnapshotRow,
  ShopEstimateFields,
  ShopSnapshotRow,
  SnapshotRepo,
} from "./snapshot-repo";

const BATCH = 250;

export class SupabaseShopRepo implements ShopRepo {
  constructor(private readonly db: Db) {}

  async getShop(domain: string): Promise<ShopRow | null> {
    const { data, error } = await this.db
      .from("shops")
      .select("id, domain, status, platform")
      .eq("domain", domain)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async upsertShop(domain: string, fields: ShopFields): Promise<ShopRow> {
    const { data, error } = await this.db
      .from("shops")
      .upsert({ domain, ...fields }, { onConflict: "domain" })
      .select("id, domain, status, platform")
      .single();
    if (error) throw error;
    return data;
  }

  async upsertProducts(shopId: string, products: ProductRecord[], seenAt: string): Promise<number> {
    for (let i = 0; i < products.length; i += BATCH) {
      const rows = products.slice(i, i + BATCH).map((p) => ({
        shop_id: shopId,
        external_id: p.external_id,
        handle: p.handle,
        title: p.title,
        product_type: p.product_type,
        vendor: p.vendor,
        price_min: p.price_min,
        price_max: p.price_max,
        compare_at_price: p.compare_at_price,
        image_url: p.image_url,
        tags: p.tags,
        created_at_shop: p.created_at_shop,
        published_at: p.published_at,
        last_seen_at: seenAt,
      }));
      const { error } = await this.db
        .from("products")
        .upsert(rows, { onConflict: "shop_id,external_id" });
      if (error) throw error;
    }
    return products.length;
  }

  async saveBestsellerPositions(
    shopId: string,
    handles: string[],
    capturedOn: string,
  ): Promise<number> {
    if (handles.length === 0) return 0;
    const { data, error } = await this.db
      .from("products")
      .select("id, handle")
      .eq("shop_id", shopId)
      .in("handle", handles);
    if (error) throw error;
    const idByHandle = new Map(data.map((p) => [p.handle, p.id]));
    const rows = handles.flatMap((handle, i) => {
      const id = idByHandle.get(handle);
      return id
        ? [{ product_id: id, captured_on: capturedOn, position_in_bestsellers: i + 1 }]
        : [];
    });
    if (rows.length === 0) return 0;
    const { error: upsertError } = await this.db
      .from("product_snapshots")
      .upsert(rows, { onConflict: "product_id,captured_on" });
    if (upsertError) throw upsertError;
    return rows.length;
  }

  async linkAdsToShop(domain: string, shopId: string): Promise<number> {
    const { data, error } = await this.db
      .from("ads")
      .update({ shop_id: shopId })
      .eq("landing_domain", domain)
      .is("shop_id", null)
      .select("id");
    if (error) throw error;
    return data.length;
  }

  async unknownAdDomains(limit: number): Promise<string[]> {
    const { data, error } = await this.db
      .from("ads")
      .select("landing_domain")
      .is("shop_id", null)
      .not("landing_domain", "is", null)
      .limit(limit * 5);
    if (error) throw error;
    const domains = [...new Set(data.map((r) => r.landing_domain).filter((d): d is string => !!d))];
    const existing = await this.existingDomains(domains);
    return domains.filter((d) => !existing.has(d)).slice(0, limit);
  }

  async existingDomains(domains: string[]): Promise<Set<string>> {
    if (domains.length === 0) return new Set();
    const { data, error } = await this.db.from("shops").select("domain").in("domain", domains);
    if (error) throw error;
    return new Set(data.map((r) => r.domain));
  }
}

export class SupabaseSnapshotRepo implements SnapshotRepo {
  constructor(private readonly db: Db) {}

  async productIds(shopId: string) {
    const map = new Map<string, string>();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.db
        .from("products")
        .select("id, external_id")
        .eq("shop_id", shopId)
        .range(from, from + 999);
      if (error) throw error;
      for (const p of data) map.set(p.external_id, p.id);
      if (data.length < 1000) break;
    }
    return map;
  }

  async previousProductStates(shopId: string, beforeDate: string) {
    const { data: latest, error } = await this.db
      .from("product_snapshots")
      .select("captured_on, products!inner(shop_id)")
      .eq("products.shop_id", shopId)
      .lt("captured_on", beforeDate)
      .order("captured_on", { ascending: false })
      .limit(1);
    if (error) throw error;
    const date = latest[0]?.captured_on ?? null;
    if (!date) return { date: null, states: [] };

    const states: ProductState[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error: e } = await this.db
        .from("product_snapshots")
        .select(
          "price, available_variants, position_in_bestsellers, inventory_signal, products!inner(shop_id, external_id)",
        )
        .eq("products.shop_id", shopId)
        .eq("captured_on", date)
        .range(from, from + 999);
      if (e) throw e;
      for (const r of data) {
        const signal = (r.inventory_signal ?? {}) as { total_variants?: number };
        states.push({
          external_id: r.products.external_id,
          price: r.price,
          available_variants: r.available_variants ?? 0,
          total_variants: signal.total_variants ?? r.available_variants ?? 0,
          position: r.position_in_bestsellers,
        });
      }
      if (data.length < 1000) break;
    }
    return { date, states };
  }

  async saveProductSnapshots(rows: ProductSnapshotRow[]) {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await this.db
        .from("product_snapshots")
        .upsert(rows.slice(i, i + 500), { onConflict: "product_id,captured_on" });
      if (error) throw error;
    }
  }

  async shopHistory(shopId: string, sinceDate: string, untilDate: string): Promise<DailySignal[]> {
    const { data, error } = await this.db
      .from("shop_snapshots")
      .select(
        "captured_on, sellout_value, review_count, active_ads_count, new_products, product_count, est_daily_revenue",
      )
      .eq("shop_id", shopId)
      .gte("captured_on", sinceDate)
      .lt("captured_on", untilDate)
      .order("captured_on");
    if (error) throw error;
    return data.map((r) => ({
      date: r.captured_on,
      selloutValue: r.sellout_value,
      reviewCount: r.review_count,
      activeAds: r.active_ads_count,
      newProducts: r.new_products,
      productCount: r.product_count,
      estDailyRevenue: r.est_daily_revenue,
    }));
  }

  async adStats(shopId: string, asOf: Date): Promise<AdStats> {
    const { data, error } = await this.db
      .from("ads")
      .select("eu_total_reach, est_spend_low, est_spend_high, started_at")
      .eq("shop_id", shopId)
      .eq("is_active", true);
    if (error) throw error;
    return summarizeAds(data, asOf);
  }

  async saveShopSnapshot(row: ShopSnapshotRow) {
    const { error } = await this.db
      .from("shop_snapshots")
      .upsert(row, { onConflict: "shop_id,captured_on" });
    if (error) throw error;
  }

  async updateShopEstimate(shopId: string, fields: ShopEstimateFields) {
    const { error } = await this.db.from("shops").update(fields).eq("id", shopId);
    if (error) throw error;
  }

  async activeShopifyDomains(limit: number) {
    const { data, error } = await this.db
      .from("shops")
      .select("domain")
      .eq("status", "active")
      .eq("platform", "shopify")
      .order("last_crawled_at", { ascending: true, nullsFirst: true })
      .limit(limit);
    if (error) throw error;
    return data.map((r) => r.domain);
  }
}
