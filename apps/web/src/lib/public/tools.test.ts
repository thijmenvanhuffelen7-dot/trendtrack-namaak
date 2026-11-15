import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  detectPublic,
  exportProductsPublic,
  ipHash,
  parseDomain,
  productsToCsv,
  ToolError,
} from "./tools";

const home = readFileSync(new URL("./__fixtures__/shopify-home.html", import.meta.url), "utf8");
const net = (routes: Record<string, string | number>) => ({
  resolveHost: async () => ["93.184.216.34"],
  sleep: async () => undefined,
  fetch: async (url: string) => {
    const r = routes[url.replace(/^https:\/\//, "")];
    if (r === undefined) return new Response("", { status: 404 });
    return typeof r === "number" ? new Response("", { status: r }) : new Response(r);
  },
});

describe("gratis tools", () => {
  it("detecteert thema en apps", async () => {
    const r = await detectPublic(
      "zilverzand.nl",
      net({ "zilverzand.nl/robots.txt": "", "zilverzand.nl/": home }),
    );
    expect(r).toMatchObject({ isShopify: true, theme: "Dawn", country: "NL", currency: "EUR" });
    expect(r.apps.map((a) => a.name)).toEqual(expect.arrayContaining(["Klaviyo", "Judge.me"]));
  });

  it("respecteert robots.txt en blokkades met een duidelijke melding", async () => {
    await expect(
      detectPublic("nee.nl", net({ "nee.nl/robots.txt": "User-agent: *\nDisallow: /" })),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      detectPublic("dicht.nl", net({ "dicht.nl/robots.txt": "", "dicht.nl/": 403 })),
    ).rejects.toThrow(/niet toe/);
  });

  it("weigert interne adressen", () => {
    expect(() => parseDomain("localhost")).toThrow(ToolError);
    expect(() => parseDomain("http://192.168.1.1")).toThrow(ToolError);
    expect(parseDomain("https://www.Zilverzand.nl/x")).toBe("zilverzand.nl");
  });

  it("exporteert producten als CSV, met bescherming tegen formule-injectie", async () => {
    const products = {
      products: [
        {
          id: 1,
          title: '=HYPERLINK("evil")',
          handle: "x",
          vendor: "Merk, B.V.",
          product_type: "Ringen",
          tags: ["a", "b"],
          variants: [{ id: 1, price: "10.00", available: true }],
          images: [],
        },
      ],
    };
    const rows = await exportProductsPublic(
      "shop.nl",
      net({
        "shop.nl/robots.txt": "",
        "shop.nl/products.json?limit=250&page=1": JSON.stringify(products),
      }),
    );
    const csv = productsToCsv("shop.nl", rows);
    expect(csv.startsWith("﻿titel,handle,url")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""evil"")"`);
    expect(csv).toContain('"Merk, B.V."');
    expect(csv).toContain("https://shop.nl/products/x");
  });

  it("hasht het IP-adres (nooit het adres zelf)", () => {
    const h = ipHash(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }));
    expect(h).toMatch(/^[0-9a-f]{32}$/);
    expect(h).not.toContain("203");
    expect(ipHash(new Headers({ "x-forwarded-for": "203.0.113.7" }))).toBe(h);
  });
});
