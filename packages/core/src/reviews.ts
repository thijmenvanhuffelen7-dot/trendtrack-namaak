/**
 * Haalt het totale aantal reviews uit publieke HTML, als de review-app dat toont.
 * Ondersteunt schema.org AggregateRating (JSON-LD/microdata) en de badges van Judge.me en Loox.
 * Geeft het hoogste gevonden getal terug (shop-breed totaal > productbadge), of null.
 */
export function extractReviewCount(html: string): number | null {
  const patterns = [
    /"reviewCount"\s*:\s*"?(\d+)"?/gi,
    /itemprop=["']reviewCount["'][^>]*content=["'](\d+)["']/gi,
    /data-number-of-reviews=["'](\d+)["']/gi, // Judge.me all-reviews badge
    /data-raters=["'](\d+)["']/gi, // Loox
  ];
  let best: number | null = null;
  for (const re of patterns) {
    for (const m of html.matchAll(re)) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 0 && n < 10_000_000 && (best === null || n > best)) best = n;
    }
  }
  return best;
}
