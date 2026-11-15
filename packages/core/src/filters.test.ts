import { describe, expect, it } from "vitest";
import {
  AdFiltersSchema,
  confidenceLevel,
  escapeLike,
  parseFilters,
  ShopFiltersSchema,
  toQueryString,
} from "./filters";

describe("parseFilters", () => {
  it("parseert en normaliseert shop-filters", () => {
    const f = parseFilters(ShopFiltersSchema, {
      country: "nl",
      revenue_min: "5000",
      ads_min: "2",
      sort: "revenue",
      page: "3",
      q: " zilver ",
    });
    expect(f).toMatchObject({
      country: "NL",
      revenue_min: 5000,
      ads_min: 2,
      sort: "revenue",
      page: 3,
      per_page: 25,
      q: "zilver",
    });
  });

  it("gooit ongeldige waarden weg in plaats van te falen", () => {
    const f = parseFilters(ShopFiltersSchema, {
      country: "Nederland",
      growth_min: "9",
      sort: "hack",
      page: "-1",
      niche: "Kettingen",
    });
    expect(f).toEqual({ niche: "Kettingen", sort: "growth", page: 1, per_page: 25 });
  });

  it("neemt de eerste waarde bij dubbele parameters en negeert lege", () => {
    expect(
      parseFilters(AdFiltersSchema, { active: ["true", "false"], q: "", min_days: "30" }),
    ).toMatchObject({ active: true, min_days: 30 });
  });
});

describe("helpers", () => {
  it("toQueryString laat defaults weg", () => {
    expect(
      toQueryString(
        { country: "NL", sort: "growth", page: 1, q: undefined },
        { sort: "growth", page: 1 },
      ),
    ).toBe("?country=NL");
    expect(toQueryString({ sort: "growth" }, { sort: "growth" })).toBe("");
  });
  it("escapeLike haalt jokers en scheidingstekens weg", () => {
    expect(escapeLike("50%_korting,(x)")).toBe("50  korting  x");
  });
  it("confidenceLevel", () => {
    expect([
      confidenceLevel(0.1),
      confidenceLevel(0.45),
      confidenceLevel(0.8),
      confidenceLevel(null),
    ]).toEqual(["rough", "fair", "strong", null]);
  });
});
