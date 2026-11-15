import {
  createApiKey,
  createServiceClient,
  getWorkspaceForUser,
  revokeApiKey,
} from "@trendtrack/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  Ad,
  Advertiser,
  Email,
  ErrorBody,
  ListEnvelope,
  Lookup,
  Product,
  Shop,
  ShopDetail,
} from "@/lib/api/schemas";
import { GET as getAd } from "./ads/[id]/route";
import { GET as listAds } from "./ads/route";
import { GET as getAdvertiser } from "./advertisers/[id]/route";
import { GET as listAdvertisers } from "./advertisers/route";
import { GET as listEmails } from "./emails/route";
import { POST as postLookup } from "./lookups/route";
import { GET as openapi } from "./openapi.json/route";
import { GET as getProducts } from "./shops/[domain]/products/route";
import { GET as getShop } from "./shops/[domain]/route";
import { GET as listShops } from "./shops/route";

// Echte route-handlers, echte API-keys, echte (lokale) database met de seed-data.
const db = createServiceClient();
const BASE = "http://localhost:3000/api/v1";
type Handler<P> = (req: Request, ctx: { params: Promise<P> }) => Promise<Response>;

// Pro staat 5 requests per seconde toe; de tests zelf blijven daar netjes onder.
let last = 0;
async function throttle() {
  const wait = last + 220 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
}

async function call<P = Record<string, string>>(
  h: Handler<P>,
  path: string,
  key: string | null,
  params?: P,
  init: RequestInit = {},
) {
  await throttle();
  const headers = new Headers(init.headers);
  if (key) headers.set("authorization", `Bearer ${key}`);
  const res = await h(new Request(BASE + path, { ...init, headers }), {
    params: Promise.resolve((params ?? {}) as P),
  });
  return { res, body: (await res.json()) as Record<string, unknown> };
}

async function workspace(plan: "pro" | "free") {
  const { data, error } = await db.auth.admin.createUser({
    email: `api-${crypto.randomUUID()}@test.local`,
    email_confirm: true,
  });
  if (error) throw error;
  const ws = (await getWorkspaceForUser(db, data.user.id))!.id;
  if (plan === "free") await db.from("subscriptions").delete().eq("workspace_id", ws); // nieuwe gebruikers hebben een Pro-proef
  const { key, id } = await createApiKey(db, ws, data.user.id, "test");
  return { userId: data.user.id, ws, key, keyId: id };
}

describe("REST API v1", () => {
  let pro: Awaited<ReturnType<typeof workspace>>;
  const users: string[] = [];
  beforeAll(async () => {
    pro = await workspace("pro");
    users.push(pro.userId);
  });
  afterAll(async () => {
    await db.from("lookup_requests").delete().eq("domain", "nieuwe-api-shop.nl");
    for (const u of users) await db.auth.admin.deleteUser(u);
  });

  describe("authenticatie en plan", () => {
    it("401 zonder, met een verkeerde en met een ingetrokken key", async () => {
      expect((await call(listShops, "/shops", null)).res.status).toBe(401);
      const bad = await call(listShops, "/shops", "tt_live_" + "x".repeat(32));
      expect(bad.res.status).toBe(401);
      expect(ErrorBody.parse(bad.body).error.code).toBe("unauthorized");
      const w = await workspace("pro");
      users.push(w.userId);
      expect((await call(listShops, "/shops", w.key)).res.status).toBe(200);
      await revokeApiKey(db, w.ws, w.keyId);
      expect((await call(listShops, "/shops", w.key)).res.status).toBe(401);
    });

    it("accepteert ook de X-API-Key-header", async () => {
      const r = await listShops(
        new Request(BASE + "/shops", { headers: { "x-api-key": pro.key } }),
        { params: Promise.resolve({}) },
      );
      expect(r.status).toBe(200);
    });

    it("402 op het gratis plan, met uitleg en upgrade-link", async () => {
      const free = await workspace("free");
      users.push(free.userId);
      const { res, body } = await call(listShops, "/shops", free.key);
      expect(res.status).toBe(402);
      expect(ErrorBody.parse(body).error).toMatchObject({
        code: "payment_required",
        details: { plan: "free", upgrade_url: expect.stringContaining("/app/settings/billing") },
      });
    });
  });

  describe("shops", () => {
    it("lijst met filters, schattingen als bandbreedte en paginering via cursor", async () => {
      const { res, body } = await call(listShops, "/shops?country=NL&sort=revenue", pro.key);
      expect(res.status).toBe(200);
      const list = ListEnvelope(Shop).parse(body);
      expect(list.data.map((s) => s.domain)).toEqual(["fietsfabriekje.nl", "zilverzand.nl"]);
      expect(list.data[0]!.monthly_revenue).toMatchObject({
        low: 40000,
        high: 80000,
        currency: "EUR",
        estimate: true,
      });
      expect(res.headers.get("x-quota-remaining")).toMatch(/^\d+$/);
      expect(res.headers.get("x-ratelimit-remaining")).toMatch(/^\d+$/);

      const p1 = ListEnvelope(Shop).parse(
        (await call(listShops, "/shops?limit=2&sort=name", pro.key)).body,
      );
      expect(p1.data).toHaveLength(2);
      expect(p1.next_cursor).not.toBeNull();
      const p2 = ListEnvelope(Shop).parse(
        (await call(listShops, `/shops?cursor=${p1.next_cursor}`, pro.key)).body,
      );
      expect(p2.data[0]!.domain).not.toBe(p1.data[0]!.domain);
      expect(p1.total).toBe(p2.total);
    });

    it("400 bij ongeldige parameters, met details", async () => {
      const { res, body } = await call(listShops, "/shops?limit=500&growth_min=9", pro.key);
      expect(res.status).toBe(400);
      expect(ErrorBody.parse(body).error.details).toHaveProperty("limit");
    });

    it("detail met tech, ads- en e-mailsamenvatting en historie", async () => {
      const { res, body } = await call(getShop, "/shops/zilverzand.nl", pro.key, {
        domain: "zilverzand.nl",
      });
      expect(res.status).toBe(200);
      const s = ShopDetail.parse(body);
      expect(s).toMatchObject({
        domain: "zilverzand.nl",
        theme: "Dawn",
        apps: expect.arrayContaining(["klaviyo"]),
        products: { count: 3 },
      });
      expect(s.ads).toMatchObject({
        active: 3,
        total: 4,
        total_eu_reach: 672000,
        spend: { estimate: true },
      });
      expect(s.emails.by_type).toEqual({ welcome: 2, flow: 1, campaign: 1 });
      expect(s.monthly_orders).toMatchObject({ estimate: true });
      expect(s.history.length).toBeGreaterThan(20);
      expect(s.history[0]!.daily_revenue).toMatchObject({ estimate: true });
    });

    it("404 voor een onbekende shop, 400 voor een ongeldig domein", async () => {
      expect(
        (await call(getShop, "/shops/onbekend.nl", pro.key, { domain: "onbekend.nl" })).res.status,
      ).toBe(404);
      expect(
        (await call(getShop, "/shops/localhost", pro.key, { domain: "localhost" })).res.status,
      ).toBe(400);
    });

    it("producten", async () => {
      const { body } = await call(
        getProducts,
        "/shops/zilverzand.nl/products?sort=price",
        pro.key,
        { domain: "zilverzand.nl" },
      );
      const list = ListEnvelope(Product).parse(body);
      expect(list.data[0]).toMatchObject({
        title: "Naamring goud vergulden",
        url: "https://zilverzand.nl/products/naamring-goud",
      });
    });
  });

  describe("ads en adverteerders", () => {
    it("full-text zoeken en filters; detail per id", async () => {
      const list = ListEnvelope(Ad).parse(
        (await call(listAds, "/ads?q=gratis%20verzending&active=true", pro.key)).body,
      );
      expect(list.data.map((a) => a.external_id)).toEqual(["800001"]);
      const ad = list.data[0]!;
      expect(ad).toMatchObject({
        shop_domain: "zilverzand.nl",
        advertiser: { name: "Zilverzand Sieraden" },
        spend: { estimate: true },
      });
      expect(ad.days_running).toBeGreaterThan(60);

      const one = await call(getAd, `/ads/${ad.id}`, pro.key, { id: ad.id });
      expect(Ad.parse(one.body).id).toBe(ad.id);
      expect((await call(getAd, "/ads/x", pro.key, { id: "x" })).res.status).toBe(400);
      expect(
        (await call(getAd, `/ads/${crypto.randomUUID()}`, pro.key, { id: crypto.randomUUID() })).res
          .status,
      ).toBe(404);
    });

    it("adverteerders gesorteerd op bereik; detail", async () => {
      const list = ListEnvelope(Advertiser).parse(
        (await call(listAdvertisers, "/advertisers?sort=reach", pro.key)).body,
      );
      const top = list.data.find((a) => a.page_id === "100000000000002")!;
      expect(top).toMatchObject({
        name: "Bosbad",
        total_eu_reach: 883000,
        spend: { estimate: true },
      });
      const one = await call(getAdvertiser, `/advertisers/${top.id}`, pro.key, { id: top.id });
      expect(Advertiser.parse(one.body).name).toBe("Bosbad");
    });
  });

  it("e-mails met filters", async () => {
    const list = ListEnvelope(Email).parse(
      (await call(listEmails, "/emails?domain=zilverzand.nl&type=welcome", pro.key)).body,
    );
    expect(list.data.map((e) => e.subject)).toEqual([
      "Dit is ons verhaal",
      "Welkom bij Zilverzand ✨",
    ]);
    expect(list.data[0]!.url).toContain("/app/emails/");
  });

  it("lookups: bekend, nieuw (202), ongeldig", async () => {
    const post = (body: unknown) =>
      call(
        postLookup,
        "/lookups",
        pro.key,
        {},
        {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        },
      );
    expect(Lookup.parse((await post({ domain: "https://www.zilverzand.nl/" })).body)).toMatchObject(
      { domain: "zilverzand.nl", status: "known" },
    );
    const fresh = await post({ domain: "nieuwe-api-shop.nl" });
    expect(fresh.res.status).toBe(202);
    expect(Lookup.parse(fresh.body)).toMatchObject({
      status: "queued",
      shop_url: `${BASE}/shops/nieuwe-api-shop.nl`,
    });
    const { data } = await db
      .from("lookup_requests")
      .select("source, status")
      .eq("domain", "nieuwe-api-shop.nl")
      .single();
    expect(data).toEqual({ source: "api", status: "queued" });
    expect((await post({ domain: "localhost" })).res.status).toBe(400);
    expect(
      (await call(postLookup, "/lookups", pro.key, {}, { method: "POST", body: "geen json" })).res
        .status,
    ).toBe(400);
  });

  describe("limieten", () => {
    it("telt elke call mee in het maandquotum (gedeeld met MCP)", async () => {
      const a = Number(
        (await call(listShops, "/shops", pro.key)).res.headers.get("x-quota-remaining"),
      );
      const b = Number(
        (await call(listShops, "/shops", pro.key)).res.headers.get("x-quota-remaining"),
      );
      expect(a - b).toBe(1);
      const { count } = await db
        .from("usage_events")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", pro.ws)
        .eq("action", "api_call")
        .eq("source", "api");
      expect(count).toBeGreaterThan(10);
    });

    it("429 boven 5 requests per seconde, met retry-after", async () => {
      const w = await workspace("pro");
      users.push(w.userId);
      const burst = () =>
        listShops(
          new Request(BASE + "/shops?limit=1", { headers: { authorization: `Bearer ${w.key}` } }),
          { params: Promise.resolve({}) },
        );
      const results = await Promise.all(
        Array.from({ length: 12 }, async () => {
          const res = await burst();
          return { res, body: (await res.json()) as Record<string, unknown> };
        }),
      );
      const limited = results.filter((r) => r.res.status === 429);
      expect(limited.length).toBeGreaterThan(0);
      expect(results.filter((r) => r.res.status === 200).length).toBeLessThanOrEqual(10); // hooguit 2 secondevensters
      expect(limited[0]!.res.headers.get("retry-after")).toBe("1");
      expect(ErrorBody.parse(limited[0]!.body).error.code).toBe("rate_limited");
    });

    it("402 als het maandquotum op is", async () => {
      const w = await workspace("pro");
      users.push(w.userId);
      await db
        .from("usage_events")
        .insert({ workspace_id: w.ws, action: "api_call", source: "mcp", quantity: 10_000 });
      const { res, body } = await call(listShops, "/shops", w.key);
      expect(res.status).toBe(402);
      expect(ErrorBody.parse(body).error).toMatchObject({
        code: "payment_required",
        details: { limit: 10_000, used: 10_000 },
      });
    });
  });

  it("openapi.json beschrijft alle endpoints", async () => {
    const spec = (await openapi(new Request(BASE + "/openapi.json")).json()) as {
      openapi: string;
      paths: Record<string, Record<string, { parameters: { name: string }[] }>>;
    };
    expect(spec.openapi).toBe("3.1.0");
    expect(Object.keys(spec.paths).sort()).toEqual([
      "/ads",
      "/ads/{id}",
      "/advertisers",
      "/advertisers/{id}",
      "/emails",
      "/lookups",
      "/shops",
      "/shops/{domain}",
      "/shops/{domain}/products",
    ]);
    expect(spec.paths["/ads"]!.get!.parameters.map((p) => p.name)).toEqual(
      expect.arrayContaining(["q", "country", "active", "min_days", "limit", "cursor"]),
    );
    expect(z.object({ openapi: z.string() }).safeParse(spec).success).toBe(true);
  });
});
