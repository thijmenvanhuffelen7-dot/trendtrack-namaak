import type { Db } from "@trendtrack/db";
import type { ProductRecord } from "@trendtrack/core";
import type { ShopFields, ShopRepo, ShopRow } from "./shop-repo";

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
