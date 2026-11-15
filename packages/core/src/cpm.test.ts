import { describe, expect, it } from "vitest";
import { estimateAdSpend } from "./cpm";

describe("estimateAdSpend", () => {
  it("bereik × frequentie / 1000 × CPM-band (NL €6-12)", () => {
    // 100k bereik: low 100k×1,2/1000×6 = 720, high 100k×2,5/1000×12 = 3000
    expect(estimateAdSpend(100_000, ["NL"])).toEqual({ low: 720, high: 3000, estimate: true });
  });
  it("middelt de CPM over landen en valt terug op een default", () => {
    expect(estimateAdSpend(1000, ["NL", "BE"])).toEqual({ low: 6.6, high: 27.5, estimate: true });
    expect(estimateAdSpend(1000, ["XX"])!.low).toBe(6);
  });
  it("geeft null zonder bereik", () => {
    expect(estimateAdSpend(null, ["NL"])).toBeNull();
    expect(estimateAdSpend(0, ["NL"])).toBeNull();
  });
});
