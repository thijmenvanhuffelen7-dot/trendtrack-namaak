import { createServiceClient } from "@trendtrack/db";
import { afterAll, describe, expect, it } from "vitest";
import { crawlBestsellers } from "../crawler/crawl-bestsellers";
import { crawlProducts } from "../crawler/crawl-products";
import { detectShop } from "../crawler/detect-shop";
import { fakeNetwork, fixture, testFetcher } from "../test/helpers";
import { SupabaseShopRepo } from "./supabase-shop-repo";

// Volledige crawl met een nep-netwerk, maar met de echte database.
const DOMAIN = "integratietest-zilver.nl";

describe("crawl naar Supabase", () => {
  const db = createServiceClient();
  const repo = new SupabaseShopRepo(db);

  afterAll(async () => {
    await db.from("ads").delete().eq("landing_domain", DOMAIN);
    await db.from("shops").delete().eq("domain", DOMAIN);
  });

  it("zet shop, thema, apps, producten en bestsellers in de database", async () => {
    await db
      .from("ads")
      .insert({ platform: "meta", external_id: `it-${Date.now()}`, landing_domain: DOMAIN });
    const net = fakeNetwork({
      [`${DOMAIN}/robots.txt`]: fixture("shopify-robots.txt"),
      [`${DOMAIN}/`]: fixture("shopify-home.html"),
      [`${DOMAIN}/products.json?limit=250&page=1`]: fixture("products-1.json"),
      [`${DOMAIN}/products.json?limit=250&page=2`]: fixture("products-2.json"),
      [`${DOMAIN}/products.json?limit=250&page=3`]: fixture("products-empty.json"),
      [`${DOMAIN}/collections/bestsellers/products.json?limit=250`]: fixture(
        "bestsellers-collection.json",
      ),
    });
    const deps = { fetcher: testFetcher(net.fetch), repo };

    const detected = await detectShop(DOMAIN, deps);
    expect(detected.linkedAds).toBe(1);
    expect((await crawlProducts(DOMAIN, deps)).products).toBe(3);
    // Twee keer crawlen mag geen dubbele producten geven.
    expect((await crawlProducts(DOMAIN, deps)).products).toBe(3);
    expect((await crawlBestsellers(DOMAIN, deps)).saved).toBe(2);

    const { data: shop } = await db.from("shops").select("*").eq("domain", DOMAIN).single();
    expect(shop).toMatchObject({
      platform: "shopify",
      theme_name: "Dawn",
      country: "NL",
      currency: "EUR",
    });
    expect(shop?.apps).toEqual(expect.arrayContaining(["klaviyo", "judge-me"]));

    const { data: products } = await db
      .from("products")
      .select("handle, price_min")
      .eq("shop_id", shop!.id);
    expect(products).toHaveLength(3);

    const { data: snaps } = await db
      .from("product_snapshots")
      .select("position_in_bestsellers, products!inner(handle, shop_id)")
      .eq("products.shop_id", shop!.id)
      .order("position_in_bestsellers");
    expect(snaps?.map((s) => s.products.handle)).toEqual([
      "naamring-goud",
      "schakelketting-zilver",
    ]);
  });
});
