import type { Estimate } from "./types";

/**
 * Omzetschatting voor een shop. Zie docs/estimation.md voor de uitleg en aannames.
 * Elk signaal levert een bandbreedte + betrouwbaarheid; die worden gewogen gecombineerd.
 * Uitkomst is altijd een bandbreedte met confidence, nooit één hard getal.
 */

/** Aannames: allemaal op één plek zodat ze in docs en UI uit te leggen zijn. */
export const ASSUMPTIONS = {
  /** Omzet per € ad spend (ROAS) voor e-commerce in de Benelux. */
  roas: { low: 1.5, mid: 2.5, high: 4 },
  /**
   * Een uitverkochte variant is minimaal 1 verkocht stuk, en we zien alleen varianten die
   * op 0 komen. Totale omzet ligt daarom een factor hoger dan de "sellout value".
   */
  selloutToRevenue: { low: 2, mid: 5, high: 15 },
  /** Bestellingen per geschreven review (1,5–7% van de klanten laat een review achter). */
  ordersPerReview: { low: 15, mid: 30, high: 60 },
  /** Gemiddelde orderwaarde = mediaanprijs × deze factor (meerdere items per order). */
  aovMultiplier: 1.2,
  /** Minimale datareeks voor de signalen. */
  minSelloutDays: 3,
  minReviewSpanDays: 7,
  maxConfidence: 0.85,
} as const;

export interface DailySignal {
  date: string; // YYYY-MM-DD
  selloutValue: number | null;
  reviewCount: number | null;
  activeAds: number | null;
  newProducts: number | null;
  productCount: number | null;
  estDailyRevenue?: number | null;
}

export interface AdSpendBand {
  /** Geschatte ad spend per maand (EUR), uit eu_total_reach × CPM. */
  monthlyLow: number;
  monthlyHigh: number;
}

export interface EstimationInput {
  days: DailySignal[];
  /** Gemiddelde orderwaarde in EUR, of null als onbekend. */
  aov: number | null;
  ads: AdSpendBand | null;
}

export type SignalName = "ads" | "sellouts" | "reviews";

export interface SignalEstimate {
  name: SignalName;
  low: number;
  mid: number;
  high: number;
  reliability: number; // 0-1
}

export interface RevenueEstimate {
  monthlyRevenue: Estimate;
  monthlyOrders: Estimate | null;
  signals: SignalEstimate[];
}

export function adsSignal(ads: AdSpendBand | null): SignalEstimate | null {
  if (!ads || ads.monthlyHigh <= 0) return null;
  const { roas } = ASSUMPTIONS;
  const midSpend = (ads.monthlyLow + ads.monthlyHigh) / 2;
  return {
    name: "ads",
    low: ads.monthlyLow * roas.low,
    mid: midSpend * roas.mid,
    high: ads.monthlyHigh * roas.high,
    reliability: 0.35,
  };
}

export function selloutSignal(days: DailySignal[]): SignalEstimate | null {
  // De eerste snapshot heeft geen vorige dag om mee te vergelijken; die telt niet.
  const observed = days.filter((d) => d.selloutValue !== null);
  if (observed.length < ASSUMPTIONS.minSelloutDays) return null;
  const total = observed.reduce((s, d) => s + (d.selloutValue ?? 0), 0);
  // Nul uitverkopen is geen bewijs van nul omzet (diepe voorraad): dan geen signaal.
  if (total <= 0) return null;
  const monthly = (total / observed.length) * 30;
  const f = ASSUMPTIONS.selloutToRevenue;
  return {
    name: "sellouts",
    low: monthly * f.low,
    mid: monthly * f.mid,
    high: monthly * f.high,
    reliability: 0.3 * Math.min(1, observed.length / 14),
  };
}

export function reviewSignal(days: DailySignal[], aov: number | null): SignalEstimate | null {
  if (!aov || aov <= 0) return null;
  const withCount = days.filter((d) => d.reviewCount !== null);
  const first = withCount[0];
  const last = withCount[withCount.length - 1];
  if (!first || !last) return null;
  const span = daysBetween(first.date, last.date);
  if (span < ASSUMPTIONS.minReviewSpanDays) return null;
  const delta = (last.reviewCount ?? 0) - (first.reviewCount ?? 0);
  if (delta <= 0) return null;
  const reviewsPerMonth = (delta / span) * 30;
  const o = ASSUMPTIONS.ordersPerReview;
  return {
    name: "reviews",
    low: reviewsPerMonth * o.low * aov * 0.75,
    mid: reviewsPerMonth * o.mid * aov,
    high: reviewsPerMonth * o.high * aov * 1.25,
    reliability: 0.25 * Math.min(1, span / 28),
  };
}

/** Combineert de signalen. Geeft null als er geen enkel bruikbaar signaal is. */
export function estimateRevenue(input: EstimationInput): RevenueEstimate | null {
  const signals = [
    adsSignal(input.ads),
    selloutSignal(input.days),
    reviewSignal(input.days, input.aov),
  ].filter((s): s is SignalEstimate => s !== null && s.mid > 0);
  if (signals.length === 0) return null;

  const wSum = signals.reduce((s, x) => s + x.reliability, 0);
  const geo = (pick: (s: SignalEstimate) => number) =>
    Math.exp(
      signals.reduce((s, x) => s + x.reliability * Math.log(Math.max(pick(x), 1)), 0) / wSum,
    );

  const mids = signals.map((s) => s.mid);
  let low = geo((s) => s.low);
  let high = geo((s) => s.high);
  const mid = geo((s) => s.mid);
  // Signalen die het oneens zijn: band verbreden tot alle midden-schattingen erin vallen.
  low = Math.min(low, ...mids);
  high = Math.max(high, ...mids);

  const spread = signals.length > 1 ? Math.log(Math.max(...mids) / Math.min(...mids)) : 0;
  const agreement = 1 / (1 + spread / Math.log(4)); // 4× verschil => halvering
  const combined = 1 - signals.reduce((p, s) => p * (1 - s.reliability), 1);
  const confidence = round(Math.min(ASSUMPTIONS.maxConfidence, combined * agreement), 2);

  const monthlyRevenue: Estimate = {
    low: round(low, 0),
    mid: round(mid, 0),
    high: round(high, 0),
    confidence,
    estimate: true,
  };
  const monthlyOrders: Estimate | null =
    input.aov && input.aov > 0
      ? {
          low: Math.round(low / (input.aov * 1.25)),
          mid: Math.round(mid / input.aov),
          high: Math.round(high / (input.aov * 0.75)),
          confidence,
          estimate: true,
        }
      : null;

  return { monthlyRevenue, monthlyOrders, signals };
}

/** Gemiddelde orderwaarde uit productprijzen (bij voorkeur de bestsellers). */
export function estimateAov(prices: (number | null)[]): number | null {
  const valid = prices
    .filter((p): p is number => p !== null && Number.isFinite(p) && p > 0)
    .sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const m = Math.floor(valid.length / 2);
  const median = valid.length % 2 ? valid[m]! : (valid[m - 1]! + valid[m]!) / 2;
  return round(median * ASSUMPTIONS.aovMultiplier, 2);
}

/**
 * Groeiscore tussen -1 (krimp) en 1 (sterke groei): de laatste 7 dagen vergeleken met de 28
 * dagen daarvoor, op nieuwe producten, actieve ads en geschatte omzet.
 * Zijn er nog geen 28 eerdere dagen, dan vergelijken we met de oudste beschikbare dagen.
 * Null als er minder dan 2 dagen data zijn.
 */
export function growthScore(days: DailySignal[]): number | null {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1];
  if (!last || sorted.length < 2) return null;

  let recent = sorted.filter((d) => daysBetween(d.date, last.date) < 7);
  let prior = sorted.filter((d) => {
    const ago = daysBetween(d.date, last.date);
    return ago >= 7 && ago < 35;
  });
  if (prior.length === 0) {
    // Te weinig historie: eerste helft tegenover tweede helft.
    const half = Math.floor(sorted.length / 2);
    prior = sorted.slice(0, half);
    recent = sorted.slice(half);
  }

  const metrics: [keyof DailySignal, number][] = [
    ["newProducts", 0.3],
    ["activeAds", 0.35],
    ["estDailyRevenue", 0.35],
  ];
  let score = 0;
  let weight = 0;
  for (const [key, w] of metrics) {
    const r = avg(recent, key);
    const p = avg(prior, key);
    if (r === null || p === null) continue;
    score += w * Math.tanh(Math.log((r + 1) / (p + 1)));
    weight += w;
  }
  return weight === 0 ? null : round(score / weight, 3);
}

function avg(days: DailySignal[], key: keyof DailySignal): number | null {
  const vals = days.map((d) => d[key]).filter((v): v is number => typeof v === "number");
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

function round(n: number, decimals: number) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
