import type { AdStats } from "./snapshot-repo";

export interface ActiveAdRow {
  eu_total_reach: number | null;
  est_spend_low: number | null;
  est_spend_high: number | null;
  started_at: string | null;
}

/**
 * Telt actieve ads en zet de levenslange spend-schatting per ad om naar een maandbedrag:
 * spend / dagen actief × 30. Ads zonder spend-schatting tellen niet mee in de spend.
 */
export function summarizeAds(ads: ActiveAdRow[], asOf: Date): AdStats {
  let low = 0;
  let high = 0;
  let withSpend = 0;
  let reach = 0;
  for (const ad of ads) {
    reach += ad.eu_total_reach ?? 0;
    if (ad.est_spend_low === null || ad.est_spend_high === null) continue;
    const started = ad.started_at ? Date.parse(ad.started_at) : NaN;
    const days = Number.isFinite(started)
      ? Math.max(1, (asOf.getTime() - started) / 86_400_000)
      : 30;
    const factor = 30 / Math.max(days, 7); // jonge ads niet opblazen: minimaal 7 dagen
    low += ad.est_spend_low * factor;
    high += ad.est_spend_high * factor;
    withSpend++;
  }
  return {
    activeAds: ads.length,
    totalReach: reach,
    monthlySpendLow: withSpend ? Math.round(low) : null,
    monthlySpendHigh: withSpend ? Math.round(high) : null,
  };
}
