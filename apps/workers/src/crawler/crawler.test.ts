import { describe, expect, it } from "vitest";
import { deps, fakeNetwork, fixture, MemoryShopRepo, testFetcher } from "../test/helpers";
import { crawlBestsellers } from "./crawl-bestsellers";
import { crawlProducts } from "./crawl-products";
import { detectShop } from "./detect-shop";

const robots = fixture("shopify-robots.txt");

function shopifyStore(
  extra: Record<
    string,
    string | { status: number; body?: string; headers?: Record<string, string> }
  > = {},
) {
  return fakeNetwork({
    "zilverzand.nl/robots.txt": robots,
    "zilverzand.nl/": fixture("shopify-home.html"),
    "zilverzand.nl/meta.json": JSON.stringify({
      name: "Zilverzand",
      country: "NL",
      currency: "EUR",
    }),
    "zilverzand.nl/products.json?limit=250&page=1": fixture("products-1.json"),
    "zilverzand.nl/products.json?limit=250&page=2": fixture("products-2.json"),
    "zilverzand.nl/products.json?limit=250&page=3": fixture("products-empty.json"),
    ...extra,
  });
}

describe("detectShop", () => {
  it("slaat een Shopify-store op met thema, apps en koppelt ads", async () => {
    const repo = new MemoryShopRepo();
    repo.ads.push({ landing_domain: "zilverzand.nl", shop_id: null });
    const d = deps(shopifyStore().fetch, repo);

    const result = await detectShop("https://www.ZilverZand.nl/products/x", d);
    expect(result).toMatchObject({
      domain: "zilverzand.nl",
      status: "active",
      isShopify: true,
      linkedAds: 1,
    });
    expect(repo.shops.get("zilverzand.nl")).toMatchObject({
      platform: "shopify",
      theme_name: "Dawn",
      country: "NL",
      currency: "EUR",
      status: "active",
      last_crawled_at: "2026-11-15T12:00:00.000Z",
    });
    expect(repo.shops.get("zilverzand.nl")?.apps).toContain("klaviyo");
  });

  it("markeert een niet-Shopify-site als platform other", async () => {
    const net = fakeNetwork({
      "bakker.nl/robots.txt": "",
      "bakker.nl/": fixture("wordpress-home.html"),
    });
    const d = deps(net.fetch);
    const r = await detectShop("bakker.nl", d);
    expect(r.isShopify).toBe(false);
    expect(d.repo.shops.get("bakker.nl")?.platform).toBe("other");
    expect(net.calls).not.toContain("https://bakker.nl/meta.json");
  });

  it("markeert een shop die 403 geeft als blocked", async () => {
    const net = fakeNetwork({ "dicht.nl/robots.txt": "", "dicht.nl/": { status: 403 } });
    const d = deps(net.fetch);
    expect((await detectShop("dicht.nl", d)).status).toBe("blocked");
    expect(d.repo.shops.get("dicht.nl")?.status).toBe("blocked");
  });

  it("markeert een shop die ons in robots.txt weert als blocked", async () => {
    const net = fakeNetwork({
      "nee.nl/robots.txt": "User-agent: TrendTrackBot\nDisallow: /",
      "nee.nl/": "home",
    });
    const d = deps(net.fetch);
    expect((await detectShop("nee.nl", d)).status).toBe("blocked");
    expect(net.calls).not.toContain("https://nee.nl/");
  });

  it("markeert een niet-bestaand domein als dead, maar een netwerkstoring niet", async () => {
    const dns = deps(fakeNetwork({}).fetch);
    dns.fetcher = testFetcher(fakeNetwork({}).fetch, {
      resolveHost: async (host) => {
        if (host === "shopify.com") return ["23.227.38.65"];
        throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
      },
    });
    expect((await detectShop("weg.nl", dns)).status).toBe("dead");

    const flaky = deps(async () => {
      throw new TypeError("fetch failed");
    });
    await flaky.repo.upsertShop("wankel.nl", { status: "active" });
    await expect(detectShop("wankel.nl", flaky)).rejects.toMatchObject({ kind: "network" });
    expect(flaky.repo.shops.get("wankel.nl")?.status).toBe("active");
  });

  it("markeert een gesloten store (wachtwoordpagina) als dead", async () => {
    const net = fakeNetwork({
      "dicht.nl/robots.txt": "",
      "dicht.nl/": { status: 302, headers: { location: "/password" } },
      "dicht.nl/password": fixture("shopify-home.html"),
    });
    expect((await detectShop("dicht.nl", deps(net.fetch))).status).toBe("dead");
  });
});

describe("crawlProducts", () => {
  it("pagineert tot een lege pagina en slaat alle producten op", async () => {
    const net = shopifyStore();
    const d = deps(net.fetch);
    await detectShop("zilverzand.nl", d);
    const r = await crawlProducts("zilverzand.nl", d);
    expect(r).toEqual({ domain: "zilverzand.nl", products: 3, pages: 2, blocked: false });
    expect([...d.repo.products.values()].map((p) => p.handle).sort()).toEqual([
      "naamring-goud",
      "oorbellen-parel",
      "schakelketting-zilver",
    ]);
  });

  it("stopt en markeert blocked bij een 430 halverwege", async () => {
    const net = shopifyStore({ "zilverzand.nl/products.json?limit=250&page=2": { status: 430 } });
    const d = deps(net.fetch);
    await detectShop("zilverzand.nl", d);
    const r = await crawlProducts("zilverzand.nl", d);
    expect(r.blocked).toBe(true);
    expect(r.products).toBe(2);
    expect(d.repo.shops.get("zilverzand.nl")?.status).toBe("blocked");
  });
});

describe("crawlBestsellers", () => {
  it("gebruikt geen sort_by als robots.txt dat verbiedt en valt terug op een bestseller-collectie", async () => {
    const net = shopifyStore({
      "zilverzand.nl/collections/best-sellers/products.json?limit=250": fixture(
        "bestsellers-collection.json",
      ),
    });
    const d = deps(net.fetch);
    await detectShop("zilverzand.nl", d);
    await crawlProducts("zilverzand.nl", d);
    const r = await crawlBestsellers("zilverzand.nl", d);

    expect(r).toMatchObject({ source: "collection", saved: 2 });
    expect(net.calls.some((c) => c.includes("sort_by"))).toBe(false);
    expect(d.repo.positions.map((p) => [p.handle, p.position])).toEqual([
      ["naamring-goud", 1],
      ["schakelketting-zilver", 2],
    ]);
  });

  it("gebruikt sort_by=best-selling als robots.txt het toestaat", async () => {
    const net = shopifyStore({
      "zilverzand.nl/robots.txt": "User-agent: *\nDisallow: /admin",
      "zilverzand.nl/collections/all?sort_by=best-selling": fixture("bestsellers.html"),
    });
    const d = deps(net.fetch);
    await detectShop("zilverzand.nl", d);
    await crawlProducts("zilverzand.nl", d);
    const r = await crawlBestsellers("zilverzand.nl", d);
    expect(r).toMatchObject({ source: "sort_by", saved: 3 });
    expect(d.repo.positions[0]).toMatchObject({
      handle: "naamring-goud",
      position: 1,
      capturedOn: "2026-11-15",
    });
  });
});
