import type { Db } from "@trendtrack/db";
import type { Json } from "@trendtrack/db";
import type { MappedAd } from "@trendtrack/core";

export interface AdRow extends Omit<MappedAd, "page_id" | "page_name"> {
  platform: "meta";
  advertiser_id: string;
  shop_id: string | null;
}

export interface AdsRepo {
  /** Upsert adverteerders; geeft page_id => advertisers.id en welke nieuw waren. */
  upsertAdvertisers(
    pages: { page_id: string; page_name: string | null }[],
  ): Promise<{ ids: Map<string, string>; created: string[] }>;
  existingAdCountries(externalIds: string[]): Promise<Map<string, string[]>>;
  upsertAds(rows: AdRow[]): Promise<number>;
  shopIdsByDomain(domains: string[]): Promise<Map<string, string>>;
  /** Koppelt een adverteerder aan een shop als hij nog geen shop heeft. */
  linkAdvertiserShop(advertiserId: string, shopId: string): Promise<void>;
  markAdvertiserSynced(pageId: string, at: string): Promise<void>;
  advertiserPageIds(limit: number): Promise<string[]>;
}

export class SupabaseAdsRepo implements AdsRepo {
  constructor(private readonly db: Db) {}

  async upsertAdvertisers(pages: { page_id: string; page_name: string | null }[]) {
    const unique = [...new Map(pages.map((p) => [p.page_id, p])).values()];
    const ids = new Map<string, string>();
    if (unique.length === 0) return { ids, created: [] };
    const { data: before, error: e1 } = await this.db
      .from("advertisers")
      .select("page_id")
      .eq("platform", "meta")
      .in(
        "page_id",
        unique.map((p) => p.page_id),
      );
    if (e1) throw e1;
    const existed = new Set(before.map((r) => r.page_id));
    const { data, error } = await this.db
      .from("advertisers")
      .upsert(
        unique.map((p) => ({
          platform: "meta" as const,
          page_id: p.page_id,
          page_name: p.page_name,
        })),
        {
          onConflict: "platform,page_id",
        },
      )
      .select("id, page_id");
    if (error) throw error;
    for (const r of data) ids.set(r.page_id, r.id);
    return { ids, created: unique.map((p) => p.page_id).filter((id) => !existed.has(id)) };
  }

  async existingAdCountries(externalIds: string[]) {
    const map = new Map<string, string[]>();
    if (externalIds.length === 0) return map;
    const { data, error } = await this.db
      .from("ads")
      .select("external_id, countries")
      .eq("platform", "meta")
      .in("external_id", externalIds);
    if (error) throw error;
    for (const r of data) map.set(r.external_id, r.countries);
    return map;
  }

  async upsertAds(rows: AdRow[]) {
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200).map((r) => ({ ...r, raw: r.raw as Json }));
      const { error } = await this.db
        .from("ads")
        .upsert(batch, { onConflict: "platform,external_id" });
      if (error) throw error;
    }
    return rows.length;
  }

  async shopIdsByDomain(domains: string[]) {
    const map = new Map<string, string>();
    if (domains.length === 0) return map;
    const { data, error } = await this.db.from("shops").select("id, domain").in("domain", domains);
    if (error) throw error;
    for (const r of data) map.set(r.domain, r.id);
    return map;
  }

  async linkAdvertiserShop(advertiserId: string, shopId: string) {
    const { error } = await this.db
      .from("advertisers")
      .update({ shop_id: shopId })
      .eq("id", advertiserId)
      .is("shop_id", null);
    if (error) throw error;
  }

  async markAdvertiserSynced(pageId: string, at: string) {
    const { error } = await this.db
      .from("advertisers")
      .update({ last_synced_at: at })
      .eq("platform", "meta")
      .eq("page_id", pageId);
    if (error) throw error;
  }

  async advertiserPageIds(limit: number) {
    const { data, error } = await this.db
      .from("advertisers")
      .select("page_id")
      .eq("platform", "meta")
      .order("last_synced_at", { ascending: true, nullsFirst: true })
      .limit(limit);
    if (error) throw error;
    return data.map((r) => r.page_id);
  }
}
