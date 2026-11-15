import { describe, expect, it } from "vitest";
import { bucketOf, dueThisHour, rotatingBatch } from "./buckets";

describe("buckets", () => {
  it("is stabiel en spreidt redelijk over 24 uur", () => {
    expect(bucketOf("zilverzand.nl")).toBe(bucketOf("zilverzand.nl"));
    const keys = Array.from({ length: 2400 }, (_, i) => `shop-${i}.nl`);
    const perHour = Array.from({ length: 24 }, (_, h) => dueThisHour(keys, h).length);
    expect(perHour.reduce((a, b) => a + b, 0)).toBe(2400); // elke shop precies één keer per dag
    expect(Math.min(...perHour)).toBeGreaterThan(60);
    expect(Math.max(...perHour)).toBeLessThan(140);
  });

  it("roteert zoekwoorden en loopt rond", () => {
    const kw = ["a", "b", "c", "d", "e"];
    expect(rotatingBatch(kw, 0, 2)).toEqual(["a", "b"]);
    expect(rotatingBatch(kw, 1, 2)).toEqual(["c", "d"]);
    expect(rotatingBatch(kw, 2, 2)).toEqual(["e", "a"]);
    expect(rotatingBatch(kw, 7, 10)).toEqual(kw);
    expect(rotatingBatch([], 3, 2)).toEqual([]);
  });
});
