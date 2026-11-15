import { bucketOf, dueThisHour } from "./buckets";

export const PRIORITY_TRACKED = 10;
export const PRIORITY_NORMAL = 0;

export interface PlannedJob {
  key: string;
  priority: number;
}

/**
 * Welke shops krijgen dit uur een snapshot?
 * - Elke actieve shop één keer per dag, gespreid over 24 uur (hash van het domein).
 * - Shops in de Brandtracker van een betalende workspace twee keer per dag, met voorrang.
 */
export function planShopSnapshots(
  activeDomains: string[],
  paidTracked: string[],
  hour: number,
): PlannedJob[] {
  const tracked = new Set(paidTracked);
  const out = new Map<string, PlannedJob>();
  for (const d of dueThisHour(activeDomains, hour))
    out.set(d, { key: d, priority: tracked.has(d) ? PRIORITY_TRACKED : PRIORITY_NORMAL });
  for (const d of paidTracked) {
    if (bucketOf(d, 12) === hour % 12) out.set(d, { key: d, priority: PRIORITY_TRACKED });
  }
  return [...out.values()].sort((a, b) => b.priority - a.priority);
}

/** Adverteerders: één keer per dag gespreid; die van gevolgde shops met voorrang. */
export function planAdvertiserSyncs(
  pageIds: string[],
  trackedPageIds: string[],
  hour: number,
): PlannedJob[] {
  const tracked = new Set(trackedPageIds);
  return dueThisHour(pageIds, hour)
    .map((p) => ({ key: p, priority: tracked.has(p) ? PRIORITY_TRACKED : PRIORITY_NORMAL }))
    .sort((a, b) => b.priority - a.priority);
}
