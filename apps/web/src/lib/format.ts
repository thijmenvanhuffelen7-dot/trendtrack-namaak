/** Opmaak van getallen, bedragen en datums voor NL en EN. Puur, dus overal te gebruiken. */

const tag = (locale: string) => (locale === "en" ? "en-GB" : "nl-NL");

export function formatMoney(
  value: number | null | undefined,
  locale: string,
  opts: { compact?: boolean; currency?: string } = {},
): string {
  if (value === null || value === undefined) return "–";
  return new Intl.NumberFormat(tag(locale), {
    style: "currency",
    currency: opts.currency ?? "EUR",
    notation: opts.compact ? "compact" : "standard",
    minimumFractionDigits: opts.compact || value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: opts.compact ? 1 : value % 1 === 0 ? 0 : 2,
  }).format(value);
}

/** Bandbreedte van een schatting, bv. "€ 18K – € 37K". Null als er geen schatting is. */
export function formatMoneyRange(
  low: number | null | undefined,
  high: number | null | undefined,
  locale: string,
): string | null {
  if (low === null || low === undefined || high === null || high === undefined) return null;
  return `${formatMoney(low, locale, { compact: true })} – ${formatMoney(high, locale, { compact: true })}`;
}

export function formatNumber(
  value: number | null | undefined,
  locale: string,
  compact = false,
): string {
  if (value === null || value === undefined) return "–";
  return new Intl.NumberFormat(tag(locale), {
    notation: compact ? "compact" : "standard",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatNumberRange(
  low: number | null | undefined,
  high: number | null | undefined,
  locale: string,
): string | null {
  if (low === null || low === undefined || high === null || high === undefined) return null;
  return `${formatNumber(low, locale, true)} – ${formatNumber(high, locale, true)}`;
}

export function formatDate(
  iso: string | null | undefined,
  locale: string,
  style: "short" | "long" = "short",
): string {
  if (!iso) return "–";
  return new Intl.DateTimeFormat(tag(locale), {
    day: "numeric",
    month: style === "long" ? "long" : "short",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return "–";
  return new Intl.DateTimeFormat(tag(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(iso));
}

/** Growth score (−1…1) als getal met teken, bv. "+0,72". */
export function formatGrowth(score: number | null | undefined, locale: string): string {
  if (score === null || score === undefined) return "–";
  return new Intl.NumberFormat(tag(locale), {
    signDisplay: "exceptZero",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(score);
}

export function growthTrend(score: number | null | undefined): "up" | "down" | "flat" | null {
  if (score === null || score === undefined) return null;
  return score > 0.05 ? "up" : score < -0.05 ? "down" : "flat";
}

/** Hele dagen tussen een datum en nu. */
export function daysSince(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000));
}
