import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractProductHandles, parseProductsPage, toProductRecord } from "./shopify-products";

const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

describe("products.json", () => {
  const products = parseProductsPage(JSON.parse(fixture("products-page-1.json")));

  it("parseert producten en berekent prijzen en voorraad", () => {
    expect(toProductRecord(products[0]!)).toEqual({
      external_id: "9001",
      handle: "schakelketting-zilver",
      title: "Schakelketting zilver",
      product_type: "Kettingen",
      vendor: "Zilverzand",
      price_min: 39.95,
      price_max: 49.95,
      compare_at_price: 59.95,
      image_url: "https://cdn.shopify.com/s/files/1/ketting.jpg",
      tags: ["zilver", "ketting"],
      created_at_shop: "2026-09-01T10:00:00+02:00",
      published_at: "2026-09-02T10:00:00+02:00",
      available_variants: 1,
      total_variants: 2,
    });
  });

  it("gaat om met tags als string, lege product_type en compare_at 0", () => {
    const r = toProductRecord(products[1]!);
    expect(r.tags).toEqual(["parel", "oorbellen"]);
    expect(r.product_type).toBeNull();
    expect(r.compare_at_price).toBeNull();
    expect(r.image_url).toBeNull();
  });

  it("weigert een ongeldige response", () => {
    expect(() => parseProductsPage({ items: [] })).toThrow();
  });
});

describe("extractProductHandles", () => {
  it("geeft handles in volgorde, zonder dubbelen", () => {
    expect(extractProductHandles(fixture("collection-bestsellers.html"))).toEqual([
      "naamring-goud",
      "schakelketting-zilver",
      "oorbellen-parel",
    ]);
  });
});
