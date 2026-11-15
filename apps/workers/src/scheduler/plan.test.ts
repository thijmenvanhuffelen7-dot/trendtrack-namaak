import { describe, expect, it } from "vitest";
import { bucketOf } from "./buckets";
import { planAdvertiserSyncs, planShopSnapshots, PRIORITY_TRACKED } from "./plan";

const shops = Array.from({ length: 500 }, (_, i) => `shop-${i}.nl`);

describe("planShopSnapshots", () => {
  it("plant elke shop één keer per dag", () => {
    const all = Array.from({ length: 24 }, (_, h) => planShopSnapshots(shops, [], h)).flat();
    expect(all).toHaveLength(500);
    expect(new Set(all.map((j) => j.key)).size).toBe(500);
  });

  it("gevolgde shops van betalende klanten: twee keer per dag en met voorrang", () => {
    const tracked = ["shop-7.nl"];
    const runs = Array.from({ length: 24 }, (_, h) => planShopSnapshots(shops, tracked, h))
      .flat()
      .filter((j) => j.key === "shop-7.nl");
    expect(runs.length).toBeGreaterThanOrEqual(2);
    expect(runs.every((r) => r.priority === PRIORITY_TRACKED)).toBe(true);
    const hour = bucketOf("shop-7.nl", 12);
    expect(planShopSnapshots(shops, tracked, hour)[0]).toEqual({
      key: "shop-7.nl",
      priority: PRIORITY_TRACKED,
    });
  });
});

describe("planAdvertiserSyncs", () => {
  it("gevolgde adverteerders eerst", () => {
    const pages = Array.from({ length: 200 }, (_, i) => String(1e14 + i));
    const h = bucketOf(pages[3]!);
    const plan = planAdvertiserSyncs(pages, [pages[3]!], h);
    expect(plan[0]).toEqual({ key: pages[3], priority: PRIORITY_TRACKED });
  });
});
