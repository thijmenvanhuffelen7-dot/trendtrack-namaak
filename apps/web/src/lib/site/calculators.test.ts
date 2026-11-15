import { describe, expect, it } from "vitest";
import { breakEvenRoas, clv, margin } from "./calculators";

describe("calculators", () => {
  const base = {
    priceInclVat: 60.5,
    vatRate: 0.21,
    costPrice: 15,
    shippingCost: 5,
    paymentFeePct: 0.02,
    otherCost: 2,
  };

  it("winstmarge", () => {
    const m = margin(base); // ex btw 50, kosten 15+5+1,21+2 = 23,21
    expect(m).toEqual({
      priceExVat: 50,
      totalCost: 23.21,
      profit: 26.79,
      marginPct: 53.58,
      markupPct: 178.6,
    });
  });

  it("break-even ROAS = prijs incl btw / max CPA", () => {
    const r = breakEvenRoas(base);
    expect(r.maxCpa).toBe(26.79);
    expect(r.roas).toBe(2.26); // 60,5 / 26,79
  });

  it("geen break-even als er geen winst is", () => {
    expect(breakEvenRoas({ ...base, costPrice: 60 }).roas).toBeNull();
  });

  it("klantwaarde (CLV) en maximale acquisitiekosten", () => {
    expect(
      clv({ aov: 60.5, ordersPerYear: 3, years: 2, grossMarginPct: 50, vatRate: 0.21 }),
    ).toEqual({ revenue: 363, profit: 150, maxCac: 50 });
  });
});
