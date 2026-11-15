import type { DailySignal, ProductState, ShopEventInput } from "@trendtrack/core";

export interface ProductSnapshotRow {
  product_id: string;
  captured_on: string;
  price: number | null;
  available_variants: number;
  position_in_bestsellers: number | null;
  inventory_signal: {
    total_variants: number;
    sold_out_variants: number;
    delta_available: number | null;
  };
}

export interface ShopSnapshotRow {
  shop_id: string;
  captured_on: string;
  product_count: number;
  new_products: number;
  removed_products: number | null;
  price_changes: number | null;
  sellouts: number | null;
  sellout_value: number | null;
  review_count: number | null;
  active_ads_count: number;
  total_reach: number;
  est_daily_revenue: number | null;
  est_daily_revenue_low: number | null;
  est_daily_revenue_high: number | null;
  est_confidence: number | null;
}

export interface ShopEstimateFields {
  est_monthly_revenue: number | null;
  est_monthly_revenue_low: number | null;
  est_monthly_revenue_high: number | null;
  est_monthly_orders: number | null;
  est_monthly_orders_low: number | null;
  est_monthly_orders_high: number | null;
  est_confidence: number | null;
  est_signals: Record<string, number> | null;
  est_updated_at: string;
  growth_score: number | null;
  last_crawled_at: string;
}

export interface AdStats {
  activeAds: number;
  totalReach: number;
  /** Geschatte ad spend per maand (som over actieve ads), of null als onbekend. */
  monthlySpendLow: number | null;
  monthlySpendHigh: number | null;
}

export interface SnapshotRepo {
  /** external_id => products.id */
  productIds(shopId: string): Promise<Map<string, string>>;
  /** Product-toestand van de laatste snapshotdag vóór `beforeDate`. */
  previousProductStates(
    shopId: string,
    beforeDate: string,
  ): Promise<{ date: string | null; states: ProductState[] }>;
  saveProductSnapshots(rows: ProductSnapshotRow[]): Promise<void>;
  /** Dagelijkse signalen vanaf `sinceDate` t/m de dag vóór `untilDate`. */
  shopHistory(shopId: string, sinceDate: string, untilDate: string): Promise<DailySignal[]>;
  adStats(shopId: string, asOf: Date): Promise<AdStats>;
  saveShopSnapshot(row: ShopSnapshotRow): Promise<void>;
  updateShopEstimate(shopId: string, fields: ShopEstimateFields): Promise<void>;
  activeShopifyDomains(limit: number): Promise<string[]>;
  /** Events voor de Brandtracker-feed; dubbelen (zelfde dedupe_key) worden genegeerd. */
  saveEvents(events: ShopEventInput[]): Promise<void>;
}
