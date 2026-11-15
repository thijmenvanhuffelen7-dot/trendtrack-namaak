/** Stabiele 32-bit FNV-1a hash: dezelfde key valt altijd in hetzelfde uur. */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** In welk van de `buckets` uurvakken hoort deze key? Spreidt het werk over de dag. */
export function bucketOf(key: string, buckets = 24): number {
  return fnv1a(key) % buckets;
}

/** Keys die in dit uur aan de beurt zijn. */
export function dueThisHour(keys: string[], hour: number, buckets = 24): string[] {
  return keys.filter((k) => bucketOf(k, buckets) === hour % buckets);
}

/** Roterende batch zoekwoorden: elk uur de volgende `perHour`, rond na de laatste. */
export function rotatingBatch<T>(items: T[], hourIndex: number, perHour: number): T[] {
  if (items.length === 0 || perHour <= 0) return [];
  const n = Math.min(perHour, items.length);
  const start = (hourIndex * n) % items.length;
  return Array.from({ length: n }, (_, i) => items[(start + i) % items.length]!);
}

/** Uren sinds epoch, voor de rotatie. */
export function hourIndex(d: Date): number {
  return Math.floor(d.getTime() / 3_600_000);
}
