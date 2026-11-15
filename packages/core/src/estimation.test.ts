import { describe, expect, it } from "vitest";
import {
  adsSignal,
  estimateAov,
  estimateRevenue,
  growthScore,
  reviewSignal,
  selloutSignal,
  type DailySignal,
} from "./estimation";

/** Maakt een reeks van `n` dagen eindigend op 2026-11-15. */
function series(n: number, f: (i: number) => Partial<DailySignal>): DailySignal[] {
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(Date.UTC(2026, 10, 15 - (n - 1 - i))).toISOString().slice(0, 10);
    return {
      date,
      selloutValue: i === 0 ? null : 0,
      reviewCount: null,
      activeAds: 0,
      newProducts: 0,
      productCount: 100,
      estDailyRevenue: null,
      ...f(i),
    };
  });
}

// Groeiende shop: meer ads, meer nieuwe producten, meer uitverkopen en reviews.
const growing = series(35, (i) => ({
  selloutValue: i === 0 ? null : 50 + i * 10,
  reviewCount: 400 + i * (i > 27 ? 6 : 2),
  activeAds: i > 27 ? 12 : 3,
  newProducts: i > 27 ? 4 : 1,
  estDailyRevenue: 500 + i * 40,
}));

// Stabiele shop: alles vlak.
const stable = series(35, (i) => ({
  selloutValue: i === 0 ? null : 120,
  reviewCount: 1000 + i * 3,
  activeAds: 5,
  newProducts: 1,
  estDailyRevenue: 900,
}));

// Dode shop: geen ads, geen uitverkopen, geen nieuwe reviews, producten verdwijnen.
const dead = series(35, (i) => ({
  selloutValue: i === 0 ? null : 0,
  reviewCount: 250,
  activeAds: i < 20 ? 2 : 0,
  newProducts: 0,
  productCount: Math.max(0, 40 - i * 2),
  estDailyRevenue: i < 20 ? 100 : 0,
}));

describe("estimateRevenue", () => {
  it("geeft een bandbreedte met low <= mid <= high en estimate: true", () => {
    const r = estimateRevenue({
      days: stable,
      aov: 45,
      ads: { monthlyLow: 3000, monthlyHigh: 6000 },
    })!;
    const { low, mid, high, confidence, estimate } = r.monthlyRevenue;
    expect(estimate).toBe(true);
    expect(low).toBeLessThanOrEqual(mid);
    expect(mid).toBeLessThanOrEqual(high);
    expect(confidence).toBeGreaterThan(0);
    expect(confidence).toBeLessThanOrEqual(0.85);
    expect(r.signals.map((s) => s.name).sort()).toEqual(["ads", "reviews", "sellouts"]);
    expect(r.monthlyOrders!.mid).toBe(Math.round(mid / 45));
  });

  it("een groeiende shop krijgt een hogere schatting dan een kleinere stabiele shop", () => {
    const small = series(35, (i) => ({ selloutValue: i === 0 ? null : 20, reviewCount: 100 + i }));
    const a = estimateRevenue({
      days: growing,
      aov: 40,
      ads: { monthlyLow: 4000, monthlyHigh: 8000 },
    })!;
    const b = estimateRevenue({ days: small, aov: 40, ads: null })!;
    expect(a.monthlyRevenue.mid).toBeGreaterThan(b.monthlyRevenue.mid);
  });

  it("geeft null voor een dode shop zonder signalen", () => {
    expect(estimateRevenue({ days: dead, aov: 30, ads: null })).toBeNull();
  });

  it("meer signalen die het eens zijn => hogere confidence", () => {
    // Alle drie de signalen komen uit op ~€3.750/mnd.
    const agreeing = series(29, (i) => ({
      selloutValue: i === 0 ? null : 25,
      reviewCount: 100 + (i * 3.125) / 30,
    }));
    const ads = { monthlyLow: 1000, monthlyHigh: 2000 };
    const one = estimateRevenue({ days: [], aov: 40, ads })!;
    const many = estimateRevenue({ days: agreeing, aov: 40, ads })!;
    expect(many.signals).toHaveLength(3);
    expect(many.monthlyRevenue.confidence).toBeGreaterThan(one.monthlyRevenue.confidence);
    expect(many.monthlyRevenue.mid).toBeGreaterThan(3000);
    expect(many.monthlyRevenue.mid).toBeLessThan(4500);
  });

  it("signalen die het oneens zijn => lagere confidence", () => {
    const ads = { monthlyLow: 1000, monthlyHigh: 2000 };
    const agree = series(29, (i) => ({ selloutValue: i === 0 ? null : 25 }));
    const disagree = series(29, (i) => ({ selloutValue: i === 0 ? null : 2500 }));
    expect(
      estimateRevenue({ days: disagree, aov: 40, ads })!.monthlyRevenue.confidence,
    ).toBeLessThan(estimateRevenue({ days: agree, aov: 40, ads })!.monthlyRevenue.confidence);
  });

  it("verbreedt de band als signalen het oneens zijn", () => {
    const days = series(20, (i) => ({ selloutValue: i === 0 ? null : 10 }));
    const r = estimateRevenue({
      days,
      aov: 40,
      ads: { monthlyLow: 50_000, monthlyHigh: 100_000 },
    })!;
    for (const s of r.signals) {
      expect(r.monthlyRevenue.low).toBeLessThanOrEqual(s.mid);
      expect(r.monthlyRevenue.high).toBeGreaterThanOrEqual(s.mid);
    }
  });
});

describe("signalen", () => {
  it("ads: spend × ROAS", () => {
    expect(adsSignal({ monthlyLow: 1000, monthlyHigh: 2000 })).toMatchObject({
      low: 1500,
      mid: 3750,
      high: 8000,
    });
    expect(adsSignal(null)).toBeNull();
  });

  it("sellouts: pas vanaf 3 vergeleken dagen, nul telt niet", () => {
    expect(selloutSignal(series(3, (i) => ({ selloutValue: i === 0 ? null : 100 })))).toBeNull();
    expect(selloutSignal(series(4, (i) => ({ selloutValue: i === 0 ? null : 100 })))!.mid).toBe(
      100 * 30 * 5,
    );
    expect(selloutSignal(series(10, () => ({ selloutValue: 0 })))).toBeNull();
  });

  it("reviews: pas na 7 dagen en alleen bij groei", () => {
    expect(
      reviewSignal(
        series(5, (i) => ({ reviewCount: 100 + i })),
        40,
      ),
    ).toBeNull();
    expect(
      reviewSignal(
        series(10, () => ({ reviewCount: 100 })),
        40,
      ),
    ).toBeNull();
    const s = reviewSignal(
      series(31, (i) => ({ reviewCount: 100 + i })),
      40,
    )!;
    expect(s.mid).toBeCloseTo(30 * 30 * 40, 0); // 30 reviews/mnd × 30 orders × €40
  });
});

describe("growthScore", () => {
  it("groeiend > 0.3, stabiel ~0, dood < -0.3", () => {
    expect(growthScore(growing)!).toBeGreaterThan(0.3);
    expect(Math.abs(growthScore(stable)!)).toBeLessThan(0.05);
    expect(growthScore(dead)!).toBeLessThan(-0.3);
  });

  it("blijft tussen -1 en 1", () => {
    const extreme = series(35, (i) => ({
      activeAds: i > 27 ? 10_000 : 0,
      newProducts: i > 27 ? 500 : 0,
    }));
    const g = growthScore(extreme)!;
    expect(g).toBeLessThanOrEqual(1);
    expect(g).toBeGreaterThan(0.9);
  });

  it("werkt al met 2 dagen data, en geeft null bij 1 dag", () => {
    expect(growthScore(series(1, () => ({})))).toBeNull();
    expect(growthScore(series(2, (i) => ({ activeAds: i === 0 ? 2 : 4 })))!).toBeGreaterThan(0);
  });
});

describe("estimateAov", () => {
  it("mediaan × 1,2, negeert lege en nulprijzen", () => {
    expect(estimateAov([10, 30, 20, null, 0])).toBe(24);
    expect(estimateAov([10, 20])).toBe(18);
    expect(estimateAov([])).toBeNull();
  });
});
