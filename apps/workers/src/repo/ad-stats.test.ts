import { describe, expect, it } from "vitest";
import { summarizeAds } from "./ad-stats";

describe("summarizeAds", () => {
  const asOf = new Date("2026-11-15T00:00:00Z");
  it("zet levenslange spend om naar een maandbedrag", () => {
    const s = summarizeAds(
      [
        {
          eu_total_reach: 100_000,
          est_spend_low: 600,
          est_spend_high: 1200,
          started_at: "2026-10-16T00:00:00Z",
        }, // 30 dagen
        { eu_total_reach: 5_000, est_spend_low: null, est_spend_high: null, started_at: null },
      ],
      asOf,
    );
    expect(s).toEqual({
      activeAds: 2,
      totalReach: 105_000,
      monthlySpendLow: 600,
      monthlySpendHigh: 1200,
    });
  });
  it("blaast ads van 1 dag niet op tot een maand", () => {
    const s = summarizeAds(
      [
        {
          eu_total_reach: 1,
          est_spend_low: 70,
          est_spend_high: 70,
          started_at: "2026-11-14T00:00:00Z",
        },
      ],
      asOf,
    );
    expect(s.monthlySpendLow).toBe(300); // 70 / 7 × 30
  });
  it("geeft null-spend zonder schattingen", () => {
    expect(summarizeAds([], asOf).monthlySpendLow).toBeNull();
  });
});
