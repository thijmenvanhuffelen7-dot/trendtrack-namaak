import { describe, expect, it } from "vitest";
import {
  daysSince,
  formatDate,
  formatGrowth,
  formatMoneyRange,
  formatNumber,
  growthTrend,
} from "./format";

const nbsp = (s: string) => s.replace(/[  ]/g, " ");

describe("format", () => {
  it("toont een schatting altijd als bandbreedte", () => {
    expect(nbsp(formatMoneyRange(18000, 37000, "nl")!)).toBe("€ 18K – € 37K");
    expect(nbsp(formatMoneyRange(18000, 37000, "en")!)).toBe("€18k – €37k");
    expect(formatMoneyRange(null, 37000, "nl")).toBeNull();
  });
  it("getallen, groei en datums per taal", () => {
    expect(formatNumber(412000, "nl", true)).toMatch(/412/);
    expect(formatGrowth(0.72, "nl")).toBe("+0,72");
    expect(formatGrowth(-0.12, "en")).toBe("-0.12");
    expect(formatGrowth(null, "nl")).toBe("–");
    expect(formatDate("2026-11-15T10:00:00Z", "nl")).toBe("15 nov 2026");
    expect(formatDate("2026-11-15T10:00:00Z", "en")).toBe("15 Nov 2026");
  });
  it("trend en dagen", () => {
    expect([growthTrend(0.5), growthTrend(-0.5), growthTrend(0.01), growthTrend(null)]).toEqual([
      "up",
      "down",
      "flat",
      null,
    ]);
    expect(daysSince("2026-11-01T00:00:00Z", new Date("2026-11-15T12:00:00Z"))).toBe(14);
  });
});
