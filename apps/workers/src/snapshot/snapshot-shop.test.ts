import { describe, expect, it } from "vitest";
import { detectShop } from "../crawler/detect-shop";
import { deps, fakeNetwork, fixture, MemoryShopRepo } from "../test/helpers";
import { snapshotShop } from "./snapshot-shop";

const D = "zilverzand.nl";
const product = (id: number, handle: string, price: string, available: boolean[]) => ({
  id,
  title: handle,
  handle,
  published_at: "2026-01-01T00:00:00Z",
  variants: available.map((a, i) => ({ id: id * 10 + i, price, available: a })),
  images: [],
});

function store(products: object[], reviews: number) {
  const home = fixture("shopify-home.html").replace(
    "</body>",
    `<div class="jdgm-all-reviews-rating-wrapper" data-number-of-reviews="${reviews}"></div></body>`,
  );
  return fakeNetwork({
    [`${D}/robots.txt`]: fixture("shopify-robots.txt"),
    [`${D}/`]: home,
    [`${D}/products.json?limit=250&page=1`]: JSON.stringify({ products }),
    [`${D}/products.json?limit=250&page=2`]: JSON.stringify({ products: [] }),
    [`${D}/collections/bestsellers/products.json?limit=250`]: JSON.stringify({
      products: products.slice(0, 2),
    }),
  });
}

describe("snapshotShop", () => {
  it("legt na twee runs verschillen vast en schrijft een schatting met bandbreedte en growth_score", async () => {
    const repo = new MemoryShopRepo();
    const day1 = deps(
      store(
        [product(1, "ketting", "40.00", [true, true, true]), product(2, "ring", "30.00", [true])],
        500,
      ).fetch,
      repo,
      new Date("2026-11-14T06:00:00Z"),
    );
    await detectShop(D, day1);
    const shopId = repo.shops.get(D)!.id;
    day1.snapshots.activeAds.push({
      shopId,
      eu_total_reach: 200_000,
      est_spend_low: 1200,
      est_spend_high: 2400,
      started_at: "2026-10-15T00:00:00Z",
    });

    const r1 = await snapshotShop(D, day1);
    expect(r1.products).toBe(2);
    // Eerste dag: geen vergelijking => geen sellout-signaal, wel ads.
    expect(day1.snapshots.shopSnaps.get(`${shopId}@2026-11-14`)?.sellout_value).toBeNull();
    expect(r1.estimate).not.toBeNull();

    // Dag 2: ketting 2 varianten uitverkocht, ring duurder, nieuw product, meer reviews.
    const day2 = deps(
      store(
        [
          product(1, "ketting", "40.00", [true, false, false]),
          product(2, "ring", "35.00", [true]),
          product(3, "oorbel", "20.00", [true]),
        ],
        512,
      ).fetch,
      repo,
      new Date("2026-11-15T06:00:00Z"),
    );
    day2.snapshots = day1.snapshots;
    const r2 = await snapshotShop(D, day2);

    expect(r2.diff).toMatchObject({
      newProducts: ["3"],
      removedProducts: [],
      priceChanges: [{ external_id: "2", from: 30, to: 35 }],
      sellouts: [{ external_id: "1", variants: 2, price: 40 }],
      selloutValue: 80,
    });
    const snap2 = day2.snapshots.shopSnaps.get(`${shopId}@2026-11-15`)!;
    expect(snap2).toMatchObject({
      product_count: 3,
      new_products: 1,
      sellouts: 1,
      sellout_value: 80,
      review_count: 512,
      active_ads_count: 1,
    });

    const est = day2.snapshots.estimates.get(shopId)!;
    expect(est.est_monthly_revenue_low!).toBeLessThanOrEqual(est.est_monthly_revenue!);
    expect(est.est_monthly_revenue!).toBeLessThanOrEqual(est.est_monthly_revenue_high!);
    expect(est.est_confidence!).toBeGreaterThan(0);
    expect(est.growth_score).not.toBeNull();
    expect(est.est_signals).toHaveProperty("ads");

    // Bestsellerposities staan in de product-snapshots.
    const ketting = day2.snapshots.productSnaps.get(`${shopId}:1@2026-11-15`)!;
    expect(ketting).toMatchObject({ position_in_bestsellers: 1, available_variants: 1 });
    expect(ketting.inventory_signal).toEqual({
      total_variants: 3,
      sold_out_variants: 2,
      delta_available: -2,
    });
  });

  it("slaat een geblokkeerde shop over", async () => {
    const repo = new MemoryShopRepo();
    await repo.upsertShop(D, { status: "blocked", platform: "shopify" });
    expect((await snapshotShop(D, deps(fakeNetwork({}).fetch, repo))).skipped).toBe("not_active");
  });
});
