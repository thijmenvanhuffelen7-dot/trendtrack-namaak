import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseShopifyHomepage } from "./shopify-detect";

const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

describe("parseShopifyHomepage", () => {
  it("herkent een Shopify-store met thema, valuta, land en apps", () => {
    const info = parseShopifyHomepage(fixture("shopify-home.html"));
    expect(info).toMatchObject({
      isShopify: true,
      name: "Zilverzand Sieraden & Co",
      currency: "EUR",
      country: "NL",
      locale: "nl",
      themeName: "Dawn",
      myshopifyDomain: "zilverzand.myshopify.com",
    });
    expect(info.apps).toEqual(
      expect.arrayContaining([
        "klaviyo",
        "judge-me",
        "vitals",
        "google-tag-manager",
        "meta-pixel",
        "kiyoh",
      ]),
    );
    expect(info.apps).not.toContain("google-analytics");
  });

  it("herkent een niet-Shopify-site", () => {
    const info = parseShopifyHomepage(fixture("wordpress-home.html"));
    expect(info.isShopify).toBe(false);
    expect(info.name).toBe("Bakkerij de Korst");
    expect(info.themeName).toBeNull();
    expect(info.apps).toEqual(["google-analytics"]);
  });

  it("valt terug op theme.name als schema_name ontbreekt", () => {
    const html = `<script>Shopify.theme = {"name":"Mijn Thema","id":1};</script>`;
    expect(parseShopifyHomepage(html).themeName).toBe("Mijn Thema");
  });
});
