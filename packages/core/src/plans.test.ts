import { describe, expect, it } from "vitest";
import { parseLookupKey, PLANS, priceCents, priceLookupKey, quote } from "./plans";
import { limitFor, periodBounds, resolvePlan, type SubscriptionLike } from "./usage";

describe("prijzen", () => {
  it("kwartaal -15%, jaar -30%", () => {
    expect(priceCents(29, "month")).toBe(2900);
    expect(priceCents(29, "quarter")).toBe(7395); // 29 × 3 × 0,85
    expect(priceCents(59, "year")).toBe(49560); // 59 × 12 × 0,7
    expect(priceCents(119, "quarter")).toBe(30345);
  });

  it("Agency: 3 seats inbegrepen, +€20 per extra seat", () => {
    expect(quote("agency", "month")).toMatchObject({ extraSeats: 0, totalCents: 11900 });
    expect(quote("agency", "month", 5)).toMatchObject({
      extraSeats: 2,
      totalCents: 11900 + 2 * 2000,
    });
    expect(quote("agency", "year", 4).totalCents).toBe(99960 + 16800);
    expect(quote("pro", "year").perMonthCents).toBe(4130);
    expect(() => quote("pro", "month", 3)).toThrow();
  });

  it("lookup keys heen en terug", () => {
    expect(priceLookupKey("agency", "quarter", true)).toBe("agency_seat_quarter");
    expect(parseLookupKey("pro_year")).toEqual({ plan: "pro", interval: "year", seat: false });
    expect(parseLookupKey("agency_seat_month")).toEqual({
      plan: "agency",
      interval: "month",
      seat: true,
    });
    expect(parseLookupKey("free_month")).toBeNull();
    expect(parseLookupKey(null)).toBeNull();
  });

  it("limieten volgens het plan", () => {
    expect(limitFor("free", "shop_lookup")).toBe(5);
    expect(limitFor("free", "ad_search")).toBe(20);
    expect(limitFor("free", "folder")).toBe(1);
    expect(limitFor("free", "api_call")).toBe(0);
    expect(limitFor("starter", "ad_search")).toBeNull();
    expect(limitFor("starter", "tracked_brand")).toBe(3);
    expect(limitFor("pro", "api_call")).toBe(10_000);
    expect(limitFor("agency", "tracked_brand")).toBe(40);
    expect(PLANS.agency.limits.apiCallsPerMonth).toBe(50_000);
  });
});

describe("periodBounds (Europe/Amsterdam)", () => {
  it("dag begint om middernacht Nederlandse tijd", () => {
    const { start, end } = periodBounds("day", new Date("2026-11-15T22:30:00Z")); // 23:30 in NL
    expect(start.toISOString()).toBe("2026-11-14T23:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-15T23:00:00.000Z");
    // 00:30 NL op 16 november hoort al bij de volgende dag
    expect(periodBounds("day", new Date("2026-11-15T23:30:00Z")).start.toISOString()).toBe(
      "2026-11-15T23:00:00.000Z",
    );
  });
  it("week begint op maandag, maand op de 1e (ook met zomertijd)", () => {
    expect(periodBounds("week", new Date("2026-11-15T12:00:00Z")).start.toISOString()).toBe(
      "2026-11-08T23:00:00.000Z",
    ); // ma 9 nov
    expect(periodBounds("month", new Date("2026-07-15T12:00:00Z")).start.toISOString()).toBe(
      "2026-06-30T22:00:00.000Z",
    ); // 1 juli, zomertijd
    expect(periodBounds("month", new Date("2026-07-15T12:00:00Z")).end.toISOString()).toBe(
      "2026-07-31T22:00:00.000Z",
    );
  });
});

describe("resolvePlan", () => {
  const now = new Date("2026-11-15T12:00:00Z");
  const sub = (o: Partial<SubscriptionLike>): SubscriptionLike => ({
    plan_id: "pro",
    status: "active",
    provider: "stripe",
    trial_ends_at: null,
    current_period_end: null,
    seats: 1,
    ...o,
  });

  it("gratis zonder abonnement", () => {
    expect(resolvePlan([], now).plan).toBe("free");
  });
  it("lopende proef geeft Pro, verlopen proef niet", () => {
    const trial = sub({
      provider: "manual",
      status: "trialing",
      trial_ends_at: "2026-11-20T00:00:00Z",
    });
    expect(resolvePlan([trial], now).plan).toBe("pro");
    expect(resolvePlan([{ ...trial, trial_ends_at: "2026-11-10T00:00:00Z" }], now).plan).toBe(
      "free",
    );
  });
  it("betaald abonnement gaat voor de proef, ook als dat een lager plan is", () => {
    const trial = sub({
      provider: "manual",
      status: "trialing",
      trial_ends_at: "2026-11-20T00:00:00Z",
    });
    expect(resolvePlan([trial, sub({ plan_id: "starter" })], now).plan).toBe("starter");
  });
  it("mislukte betaling houdt het plan in de herkansing; opgezegd wordt gratis", () => {
    expect(resolvePlan([sub({ status: "past_due" })], now).plan).toBe("pro");
    expect(resolvePlan([sub({ status: "canceled" })], now).plan).toBe("free");
    expect(resolvePlan([sub({ status: "unpaid" })], now).plan).toBe("free");
  });
});

describe("plans-tabel in de database", () => {
  it("de migratie bevat dezelfde limieten als plans.ts", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(
      new URL("../../../supabase/migrations/20261115050000_billing.sql", import.meta.url),
      "utf8",
    );
    for (const plan of Object.values(PLANS)) {
      const row = sql.match(
        new RegExp(`\\('${plan.id}',\\s*'([^']+)',\\s*(\\d+),\\s*\\d+,\\s*'(\\{[^']+\\})'\\)`),
      );
      expect(row, plan.id).not.toBeNull();
      expect(row![1]).toBe(plan.name);
      expect(Number(row![2])).toBe(plan.monthlyEur * 100);
      expect(JSON.parse(row![3]!)).toEqual(plan.limits);
    }
  });
});
