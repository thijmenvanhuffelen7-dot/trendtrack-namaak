import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRobots } from "./robots";

const shopifyRobots = readFileSync(
  new URL("./__fixtures__/shopify-robots.txt", import.meta.url),
  "utf8",
);

describe("parseRobots", () => {
  const rules = parseRobots(shopifyRobots, "TrendTrackBot");

  it("staat products.json en de homepage toe", () => {
    expect(rules.isAllowed("/")).toBe(true);
    expect(rules.isAllowed("/products.json?limit=250&page=2")).toBe(true);
    expect(rules.isAllowed("/meta.json")).toBe(true);
    expect(rules.isAllowed("/collections/bestsellers/products.json")).toBe(true);
  });

  it("blokkeert sort_by op collecties en /cart (standaard Shopify)", () => {
    expect(rules.isAllowed("/collections/all?sort_by=best-selling")).toBe(false);
    expect(rules.isAllowed("/cart.js")).toBe(false);
    expect(rules.isAllowed("/search?q=x")).toBe(false);
  });

  it("past Allow met $ correct toe", () => {
    expect(rules.isAllowed("/search/")).toBe(true);
    expect(rules.isAllowed("/search/x")).toBe(false);
  });

  it("gebruikt een specifieke groep als onze bot genoemd wordt", () => {
    const banned = parseRobots(shopifyRobots, "TrendTrackBot-Banned/1.0");
    expect(banned.isAllowed("/")).toBe(false);
    expect(banned.crawlDelaySeconds).toBe(10);
  });

  it("staat alles toe bij een lege robots.txt", () => {
    expect(parseRobots("", "TrendTrackBot").isAllowed("/admin")).toBe(true);
  });
});
