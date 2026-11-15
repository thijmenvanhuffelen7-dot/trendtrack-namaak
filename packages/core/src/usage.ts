import { PLANS, type PlanId, type PlanLimits } from "./plans";

/**
 * Acties met een limiet. Alles wat telt, loopt via checkAndRecordUsage (packages/db) zodat web,
 * API en MCP dezelfde limieten hebben.
 */
export type UsageAction = "shop_lookup" | "ad_search" | "api_call" | "folder" | "tracked_brand";
export type UsagePeriod = "day" | "week" | "month";

/** Acties die per periode tellen (usage_events). folder/tracked_brand tellen bestaande rijen. */
export const METERED: Record<
  "shop_lookup" | "ad_search" | "api_call",
  { period: UsagePeriod; limit: (l: PlanLimits) => number | null }
> = {
  shop_lookup: { period: "week", limit: (l) => l.shopLookupsPerWeek },
  ad_search: { period: "day", limit: (l) => l.adSearchesPerDay },
  api_call: { period: "month", limit: (l) => (l.api ? l.apiCallsPerMonth : 0) },
};

export function isMetered(a: UsageAction): a is keyof typeof METERED {
  return a in METERED;
}

export function limitFor(plan: PlanId, action: UsageAction): number | null {
  const l = PLANS[plan].limits;
  if (isMetered(action)) return METERED[action].limit(l);
  return action === "folder" ? l.folders : l.trackedBrands;
}

export interface UsageResult {
  allowed: boolean;
  action: UsageAction;
  plan: PlanId;
  /** null = onbeperkt */
  limit: number | null;
  used: number;
  remaining: number | null;
  /** Wanneer de teller weer op 0 gaat (ISO), of null voor niet-periodieke limieten. */
  resetsAt: string | null;
  /** "not_in_plan" als het plan deze functie niet heeft (limiet 0). */
  reason?: "limit" | "not_in_plan";
}

export function buildResult(args: {
  action: UsageAction;
  plan: PlanId;
  limit: number | null;
  used: number;
  allowed: boolean;
  resetsAt: string | null;
}): UsageResult {
  const { limit, used, allowed } = args;
  return {
    ...args,
    remaining: limit === null ? null : Math.max(0, limit - used),
    reason: allowed ? undefined : limit === 0 ? "not_in_plan" : "limit",
  };
}

// --- Periodes in Europe/Amsterdam --------------------------------------------------------------

/** Offset van een tijdzone op een moment, in minuten (bv. +60 in de winter in Amsterdam). */
function tzOffsetMinutes(date: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    +parts.year!,
    +parts.month! - 1,
    +parts.day!,
    +parts.hour!,
    +parts.minute!,
    +parts.second!,
  );
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** UTC-moment van een lokale datum + tijd in de tijdzone. */
function zonedToUtc(y: number, m: number, d: number, timeZone: string): Date {
  const guess = new Date(Date.UTC(y, m, d));
  const offset = tzOffsetMinutes(guess, timeZone);
  const first = new Date(guess.getTime() - offset * 60_000);
  // Nog eens met de offset op het echte moment (rond zomertijdwissels).
  const offset2 = tzOffsetMinutes(first, timeZone);
  return new Date(guess.getTime() - offset2 * 60_000);
}

/**
 * Begin en einde van de huidige periode: kalenderdag, week (vanaf maandag) of kalendermaand,
 * in Nederlandse tijd. Zo betekent "20 per dag" wat een gebruiker verwacht.
 */
export function periodBounds(
  period: UsagePeriod,
  now = new Date(),
  timeZone = "Europe/Amsterdam",
): { start: Date; end: Date } {
  const local = new Date(now.getTime() + tzOffsetMinutes(now, timeZone) * 60_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  if (period === "day")
    return { start: zonedToUtc(y, m, d, timeZone), end: zonedToUtc(y, m, d + 1, timeZone) };
  if (period === "month")
    return { start: zonedToUtc(y, m, 1, timeZone), end: zonedToUtc(y, m + 1, 1, timeZone) };
  const sinceMonday = (local.getUTCDay() + 6) % 7;
  return {
    start: zonedToUtc(y, m, d - sinceMonday, timeZone),
    end: zonedToUtc(y, m, d - sinceMonday + 7, timeZone),
  };
}

// --- Abonnement → plan ------------------------------------------------------------------------

export interface SubscriptionLike {
  plan_id: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "unpaid";
  provider: "stripe" | "mollie" | "manual";
  trial_ends_at: string | null;
  current_period_end: string | null;
  seats: number;
}

/**
 * Welk plan geldt nu voor een workspace?
 * - Betaald abonnement (actief, in proef of betaling mislukt maar nog in de herkansing) gaat voor.
 * - Anders de gratis Pro-proef zolang die loopt.
 * - Anders gratis.
 */
export function resolvePlan(
  subs: SubscriptionLike[],
  now = new Date(),
): { plan: PlanId; subscription: SubscriptionLike | null } {
  const rank: Record<PlanId, number> = { free: 0, starter: 1, pro: 2, agency: 3 };
  const live = subs.filter((s) => {
    if (!(s.plan_id in PLANS)) return false;
    if (s.provider === "manual" && s.status === "trialing")
      return !!s.trial_ends_at && Date.parse(s.trial_ends_at) > now.getTime();
    return s.status === "active" || s.status === "trialing" || s.status === "past_due";
  });
  const paid = live.filter((s) => s.provider !== "manual");
  const pool = paid.length ? paid : live;
  const best = pool.sort((a, b) => rank[b.plan_id as PlanId] - rank[a.plan_id as PlanId])[0];
  return best
    ? { plan: best.plan_id as PlanId, subscription: best }
    : { plan: "free", subscription: null };
}
