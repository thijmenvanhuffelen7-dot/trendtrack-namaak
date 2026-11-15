import type { ProductRecord, ShopStatus } from "@trendtrack/core";

export interface ShopFields {
  name?: string | null;
  country?: string | null;
  currency?: string | null;
  platform?: string | null;
  theme_name?: string | null;
  apps?: string[];
  status?: ShopStatus;
  niche?: string | null;
  last_crawled_at?: string;
}

export interface ShopRow {
  id: string;
  domain: string;
  status: ShopStatus;
  platform: string | null;
}

/** Alles wat de crawlers aan opslag nodig hebben. Echte implementatie: supabase-shop-repo.ts. */
export interface ShopRepo {
  getShop(domain: string): Promise<ShopRow | null>;
  upsertShop(domain: string, fields: ShopFields): Promise<ShopRow>;
  upsertProducts(shopId: string, products: ProductRecord[], seenAt: string): Promise<number>;
  /** Sla bestsellerposities op voor `capturedOn` (YYYY-MM-DD). Geeft aantal gekoppelde producten. */
  saveBestsellerPositions(shopId: string, handles: string[], capturedOn: string): Promise<number>;
  /** Koppel ads met dit landingsdomein (nog zonder shop) aan de shop. */
  linkAdsToShop(domain: string, shopId: string): Promise<number>;
  /** Landingsdomeinen van ads waarvoor nog geen shop bestaat. */
  unknownAdDomains(limit: number): Promise<string[]>;
  /** Welke van deze domeinen staan al in shops? */
  existingDomains(domains: string[]): Promise<Set<string>>;
}
