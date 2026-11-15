/**
 * CPM-bandbreedtes (EUR per 1000 impressies) per land voor Meta-ads in e-commerce.
 * Startwaarden, niet gekalibreerd. Aanpassen = ook docs/estimation.md bijwerken.
 */
export const CPM_EUR: Record<string, { low: number; high: number }> = {
  NL: { low: 6, high: 12 },
  BE: { low: 5, high: 10 },
  DE: { low: 7, high: 13 },
  FR: { low: 5, high: 10 },
};
export const DEFAULT_CPM = { low: 5, high: 12 };

/**
 * Meta geeft bereik (unieke personen), geen impressies. Iemand ziet een ad gemiddeld vaker dan
 * één keer: impressies = bereik × frequentie.
 */
export const FREQUENCY = { low: 1.2, high: 2.5 };

export interface SpendEstimate {
  low: number;
  high: number;
  estimate: true;
}

/**
 * Schat de totale spend van een ad uit het EU-bereik:
 * bereik × frequentie / 1000 × CPM (gemiddelde CPM van de landen waar de ad liep).
 */
export function estimateAdSpend(
  euTotalReach: number | null | undefined,
  countries: string[],
): SpendEstimate | null {
  if (euTotalReach === null || euTotalReach === undefined || euTotalReach <= 0) return null;
  const bands = (countries.length ? countries : ["_"]).map(
    (c) => CPM_EUR[c.toUpperCase()] ?? DEFAULT_CPM,
  );
  const cpmLow = bands.reduce((s, b) => s + b.low, 0) / bands.length;
  const cpmHigh = bands.reduce((s, b) => s + b.high, 0) / bands.length;
  return {
    low: round2(((euTotalReach * FREQUENCY.low) / 1000) * cpmLow),
    high: round2(((euTotalReach * FREQUENCY.high) / 1000) * cpmHigh),
    estimate: true,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
