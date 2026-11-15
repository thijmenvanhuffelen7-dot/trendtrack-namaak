import type { ProductRecord } from "./shopify-products";

export type ShopEventType =
  "new_ad" | "stopped_ad" | "new_product" | "removed_product" | "price_change" | "new_email";

/** Eén verandering bij een shop. `dedupe_key` voorkomt dubbelen als een job opnieuw draait. */
export interface ShopEventInput {
  shop_id: string;
  type: ShopEventType;
  occurred_at: string;
  ref_id: string | null;
  payload: Record<string, string | number | boolean | null>;
  dedupe_key: string;
}

/** Events ouder dan dit zijn geen nieuws meer (bv. bij de eerste sync van een oude adverteerder). */
export const EVENT_MAX_AGE_DAYS = 3;

export function isRecent(iso: string | null, now: Date, maxDays = EVENT_MAX_AGE_DAYS): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && now.getTime() - t <= maxDays * 86_400_000;
}

/** Meest voorkomende product_type = de niche van de shop. */
export function dominantProductType(records: Pick<ProductRecord, "product_type">[]): string | null {
  const counts = new Map<string, number>();
  for (const r of records) {
    const t = r.product_type?.trim();
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  let best: string | null = null;
  let max = 0;
  for (const [type, n] of [...counts].sort(([a], [b]) => a.localeCompare(b))) {
    if (n > max) {
      best = type;
      max = n;
    }
  }
  return best;
}
