/**
 * Plannen, prijzen en limieten. Bron van waarheid voor web, API, MCP en de Stripe-setup.
 * Wijzig je hier iets, draai dan `pnpm --filter web stripe:setup` opnieuw (nieuwe prijzen)
 * en pas de migratie met de `plans`-tabel aan (de test plans.test.ts bewaakt dat).
 */

export type PlanId = "free" | "starter" | "pro" | "agency";
export type BillingInterval = "month" | "quarter" | "year";
export const PAID_PLANS = ["starter", "pro", "agency"] as const satisfies readonly PlanId[];
export const INTERVALS = ["month", "quarter", "year"] as const satisfies readonly BillingInterval[];

/** null = onbeperkt. */
export interface PlanLimits {
  /** Shop-detailpagina's of lookups van onbekende domeinen per week (zelfde shop telt één keer). */
  shopLookupsPerWeek: number | null;
  /** Ad-zoekopdrachten per dag (zelfde zoekopdracht telt één keer). */
  adSearchesPerDay: number | null;
  folders: number | null;
  trackedBrands: number;
  /** Hoe ver terug de e-mail library gaat, in dagen. null = alles. */
  emailHistoryDays: number | null;
  /** Toegang tot de REST API en de MCP-server. */
  api: boolean;
  /** API- en MCP-calls samen per kalendermaand. */
  apiCallsPerMonth: number | null;
  /** Inbegrepen gebruikers. */
  seats: number;
  /** Prijs per extra gebruiker per maand (EUR), of null als extra seats niet kunnen. */
  extraSeatMonthlyEur: number | null;
}

export interface Plan {
  id: PlanId;
  name: string;
  monthlyEur: number;
  limits: PlanLimits;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Gratis",
    monthlyEur: 0,
    limits: {
      shopLookupsPerWeek: 5,
      adSearchesPerDay: 20,
      folders: 1,
      trackedBrands: 0,
      emailHistoryDays: 7,
      api: false,
      apiCallsPerMonth: 0,
      seats: 1,
      extraSeatMonthlyEur: null,
    },
  },
  starter: {
    id: "starter",
    name: "Starter",
    monthlyEur: 29,
    limits: {
      shopLookupsPerWeek: 50,
      adSearchesPerDay: null,
      folders: null,
      trackedBrands: 3,
      emailHistoryDays: 30,
      api: false,
      apiCallsPerMonth: 0,
      seats: 1,
      extraSeatMonthlyEur: null,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    monthlyEur: 59,
    limits: {
      shopLookupsPerWeek: null,
      adSearchesPerDay: null,
      folders: null,
      trackedBrands: 15,
      emailHistoryDays: null,
      api: true,
      apiCallsPerMonth: 10_000,
      seats: 1,
      extraSeatMonthlyEur: null,
    },
  },
  agency: {
    id: "agency",
    name: "Agency",
    monthlyEur: 119,
    limits: {
      shopLookupsPerWeek: null,
      adSearchesPerDay: null,
      folders: null,
      trackedBrands: 40,
      emailHistoryDays: null,
      api: true,
      apiCallsPerMonth: 50_000,
      seats: 3,
      extraSeatMonthlyEur: 20,
    },
  },
};

/** Korting per betaalperiode t.o.v. maandelijks. */
export const INTERVAL_DISCOUNT: Record<BillingInterval, number> = {
  month: 0,
  quarter: 0.15,
  year: 0.3,
};
export const INTERVAL_MONTHS: Record<BillingInterval, number> = { month: 1, quarter: 3, year: 12 };

export const TRIAL_DAYS = 7;
export const TRIAL_PLAN: PlanId = "pro";

const cents = (eur: number) => Math.round(eur * 100);

/** Prijs in centen voor één periode (bv. een kwartaal), na korting. */
export function priceCents(monthlyEur: number, interval: BillingInterval): number {
  return cents(monthlyEur * INTERVAL_MONTHS[interval] * (1 - INTERVAL_DISCOUNT[interval]));
}

/** Wat een klant per periode betaalt, inclusief extra seats (alleen Agency). */
export function quote(planId: PlanId, interval: BillingInterval, seats?: number) {
  const plan = PLANS[planId];
  const extraSeats = Math.max(0, (seats ?? plan.limits.seats) - plan.limits.seats);
  if (extraSeats > 0 && plan.limits.extraSeatMonthlyEur === null)
    throw new Error(`${plan.name} heeft geen extra seats`);
  const base = priceCents(plan.monthlyEur, interval);
  const seat = plan.limits.extraSeatMonthlyEur
    ? priceCents(plan.limits.extraSeatMonthlyEur, interval)
    : 0;
  const total = base + seat * extraSeats;
  return {
    plan: planId,
    interval,
    extraSeats,
    baseCents: base,
    seatCents: seat,
    totalCents: total,
    /** Omgerekend per maand, voor op de prijzenpagina. */
    perMonthCents: Math.round(total / INTERVAL_MONTHS[interval]),
  };
}

/** Stripe lookup keys: `pro_month`, `agency_seat_year`, ... (zie scripts/stripe-setup.ts). */
export function priceLookupKey(planId: PlanId, interval: BillingInterval, seat = false): string {
  return `${planId}${seat ? "_seat" : ""}_${interval}`;
}

export function parseLookupKey(
  key: string | null | undefined,
): { plan: PlanId; interval: BillingInterval; seat: boolean } | null {
  const m = key?.match(/^(starter|pro|agency)(_seat)?_(month|quarter|year)$/);
  return m
    ? { plan: m[1] as PlanId, seat: Boolean(m[2]), interval: m[3] as BillingInterval }
    : null;
}

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === "string" && v in PLANS;
}

/** Rate limits per API-key (bovenop het maandquotum). Bescherming tegen pieken en lussen. */
export const API_RATE_LIMITS: Record<PlanId, { perSecond: number; perDay: number }> = {
  free: { perSecond: 0, perDay: 0 },
  starter: { perSecond: 0, perDay: 0 },
  pro: { perSecond: 5, perDay: 2_000 },
  agency: { perSecond: 10, perDay: 10_000 },
};

/** Max aantal actieve API-keys per workspace. */
export const MAX_API_KEYS = 10;
