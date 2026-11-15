import { describe, expect, it } from "vitest";
import { fakeNetwork, fixture, testFetcher } from "../test/helpers";
import { BlockedError, RobotsDisallowedError, UnsafeTargetError } from "@trendtrack/core";
import { isPrivateIp } from "@trendtrack/core";

const robots = fixture("shopify-robots.txt");

describe("PoliteFetcher", () => {
  it("haalt robots.txt één keer op en respecteert disallow", async () => {
    const net = fakeNetwork({
      "shop.nl/robots.txt": robots,
      "shop.nl/": "home",
      "shop.nl/products.json": "{}",
    });
    const f = testFetcher(net.fetch);
    await f.get("https://shop.nl/");
    await f.get("https://shop.nl/products.json");
    await expect(
      f.get("https://shop.nl/collections/all?sort_by=best-selling"),
    ).rejects.toBeInstanceOf(RobotsDisallowedError);
    expect(net.calls.filter((c) => c.endsWith("/robots.txt"))).toHaveLength(1);
    expect(net.calls).not.toContain("https://shop.nl/collections/all?sort_by=best-selling");
  });

  it("houdt minimaal 1 seconde tussen requests op hetzelfde domein", async () => {
    let clock = 0;
    const waits: number[] = [];
    const net = fakeNetwork({ "shop.nl/robots.txt": "", "shop.nl/a": "a", "shop.nl/b": "b" });
    const f = testFetcher(net.fetch, {
      now: () => clock,
      sleep: async (ms) => {
        waits.push(ms);
        clock += ms;
      },
    });
    await Promise.all([f.get("https://shop.nl/a"), f.get("https://shop.nl/b")]);
    // robots, a, b => twee keer wachten van 1000 ms
    expect(waits).toEqual([1000, 1000]);
  });

  it("retryt bij 503 en geeft daarna de response terug", async () => {
    let n = 0;
    const f = testFetcher(async (url) => {
      if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
      n++;
      return n < 3 ? new Response("", { status: 503 }) : new Response("ok");
    });
    const { response } = await f.get("https://shop.nl/");
    expect(await response.text()).toBe("ok");
    expect(n).toBe(3);
  });

  it("geeft BlockedError bij 403 zonder te blijven proberen", async () => {
    let n = 0;
    const f = testFetcher(async (url) => {
      if (url.endsWith("/robots.txt")) return new Response("");
      n++;
      return new Response("", { status: 403 });
    });
    await expect(f.get("https://shop.nl/")).rejects.toBeInstanceOf(BlockedError);
    expect(n).toBe(1);
  });

  it("geeft BlockedError als 429 blijft terugkomen", async () => {
    const f = testFetcher(async (url) =>
      url.endsWith("/robots.txt")
        ? new Response("")
        : new Response("", { status: 429, headers: { "retry-after": "2" } }),
    );
    await expect(f.get("https://shop.nl/")).rejects.toBeInstanceOf(BlockedError);
  });

  it("weigert localhost, IP-adressen en hosts die naar privé-IP's resolven", async () => {
    const net = fakeNetwork({});
    const f = testFetcher(net.fetch, { resolveHost: async () => ["10.0.0.5"] });
    await expect(f.get("https://intern.shop.nl/")).rejects.toBeInstanceOf(UnsafeTargetError);
    await expect(testFetcher(net.fetch).get("http://localhost/")).rejects.toBeInstanceOf(
      UnsafeTargetError,
    );
    await expect(testFetcher(net.fetch).get("http://127.0.0.1/")).rejects.toBeInstanceOf(
      UnsafeTargetError,
    );
    await expect(testFetcher(net.fetch).get("https://shop.nl:8443/")).rejects.toBeInstanceOf(
      UnsafeTargetError,
    );
    expect(net.calls).toEqual([]);
  });

  it("volgt geen redirect naar een intern adres", async () => {
    const f = testFetcher(async (url) =>
      url.endsWith("/robots.txt")
        ? new Response("")
        : new Response("", {
            status: 302,
            headers: { location: "http://169.254.169.254/latest/meta-data" },
          }),
    );
    await expect(f.get("https://shop.nl/")).rejects.toBeInstanceOf(UnsafeTargetError);
  });

  it("geeft de eind-URL na redirects terug", async () => {
    const net = fakeNetwork({
      "shop.nl/robots.txt": "",
      "shop.nl/": { status: 302, headers: { location: "/password" } },
      "shop.nl/password": "wachtwoord",
    });
    const { url } = await testFetcher(net.fetch).get("https://shop.nl/");
    expect(url).toBe("https://shop.nl/password");
  });

  it("geeft UnreachableError als DNS faalt", async () => {
    const f = testFetcher(fakeNetwork({}).fetch, {
      resolveHost: async (host) => {
        if (host === "shopify.com") return ["23.227.38.65"];
        throw Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" });
      },
    });
    await expect(f.get("https://bestaatniet.nl/")).rejects.toMatchObject({
      name: "UnreachableError",
      kind: "dns",
    });
  });

  it("ziet een DNS-fout als netwerkprobleem als DNS helemaal niet werkt", async () => {
    const f = testFetcher(fakeNetwork({}).fetch, {
      resolveHost: async () => {
        throw Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" });
      },
    });
    await expect(f.get("https://bestaatwel.nl/")).rejects.toMatchObject({ kind: "network" });
  });
});

describe("isPrivateIp", () => {
  it.each([
    "10.1.2.3",
    "127.0.0.1",
    "192.168.0.1",
    "172.20.0.1",
    "169.254.169.254",
    "100.64.0.1",
    "::1",
    "fd00::1",
    "::ffff:10.0.0.1",
    "0.0.0.0",
  ])("%s is privé", (ip) => expect(isPrivateIp(ip)).toBe(true));
  it.each(["93.184.216.34", "23.227.38.65", "2606:4700::1111"])("%s is publiek", (ip) =>
    expect(isPrivateIp(ip)).toBe(false),
  );
});
