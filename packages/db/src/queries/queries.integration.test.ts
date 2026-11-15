import {
  AdFiltersSchema,
  AdvertiserFiltersSchema,
  EmailFiltersSchema,
  parseFilters,
  ShopFiltersSchema,
} from "@trendtrack/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "../client";
import { getAd, listAds, listAdvertisers } from "./ads";
import { listEmails } from "./emails";
import {
  getShopByDomain,
  getShopFacets,
  getShopSnapshots,
  listShopEvents,
  listShopProducts,
  listShops,
} from "./shops";
import {
  addFolderItem,
  createFolder,
  getFolder,
  getSharedFolder,
  getWorkspaceForUser,
  isTracked,
  listFolders,
  listTrackedBrands,
  requestLookup,
  setFolderSharing,
  trackBrand,
  untrackBrand,
} from "./workspace";

// Draait tegen de seed (supabase/seed.sql): 3 shops, 10 ads, 5 e-mails.
const db = createServiceClient();
const shops = (raw: Record<string, string>) => listShops(db, parseFilters(ShopFiltersSchema, raw));
const ads = (raw: Record<string, string>) => listAds(db, parseFilters(AdFiltersSchema, raw));

describe("shops", () => {
  it("sorteert standaard op groei en filtert op land, niche, app, omzet en ads", async () => {
    const all = await shops({});
    expect(all.total).toBeGreaterThanOrEqual(3);
    const seed = all.rows.filter((r) =>
      ["zilverzand.nl", "bosbad.be", "fietsfabriekje.nl"].includes(r.domain),
    );
    expect(seed.map((r) => r.domain)).toEqual(["zilverzand.nl", "bosbad.be", "fietsfabriekje.nl"]);

    expect((await shops({ country: "BE" })).rows.map((r) => r.domain)).toEqual(["bosbad.be"]);
    expect((await shops({ niche: "Kettingen" })).rows.map((r) => r.domain)).toEqual([
      "zilverzand.nl",
    ]);
    expect((await shops({ app: "recharge" })).rows.map((r) => r.domain)).toEqual(["bosbad.be"]);
    expect((await shops({ revenue_min: "50000" })).rows.map((r) => r.domain)).toEqual([
      "fietsfabriekje.nl",
    ]);
    expect((await shops({ ads_min: "3" })).rows.map((r) => r.domain)).toEqual(["zilverzand.nl"]);
    expect((await shops({ q: "fiets" })).rows.map((r) => r.domain)).toEqual(["fietsfabriekje.nl"]);
    expect((await shops({ q: "%_,(" })).total).toBeGreaterThanOrEqual(3); // rommel breekt de query niet
  });

  it("pagineert aan de serverkant", async () => {
    const p1 = await shops({ per_page: "2", sort: "name" });
    const p2 = await shops({ per_page: "2", sort: "name", page: "2" });
    expect(p1.rows).toHaveLength(2);
    expect(p1.total).toBe(p2.total);
    expect(p2.rows[0]?.domain).not.toBe(p1.rows[0]?.domain);
  });

  it("geeft detail, snapshots, producten, events en facets", async () => {
    const shop = (await getShopByDomain(db, "https://www.zilverzand.nl/x"))!;
    expect(shop).toMatchObject({
      domain: "zilverzand.nl",
      theme_name: "Dawn",
      active_ads_count: 3,
    });
    expect((await getShopSnapshots(db, shop.id)).length).toBeGreaterThan(20);
    expect((await listShopProducts(db, shop.id)).rows[0]?.title).toBe("Naamring goud vergulden");
    const events = await listShopEvents(db, [shop.id], { types: ["price_change"] });
    expect(events[0]).toMatchObject({ type: "price_change", payload: { from: 44.95, to: 39.95 } });
    const facets = await getShopFacets(db);
    expect(facets.countries).toEqual(expect.arrayContaining(["BE", "NL"]));
    expect(facets.niches).toContain("Kettingen");
  });
});

describe("ads", () => {
  it("filtert op actief, land, taal, bereik en full-text", async () => {
    expect((await ads({ active: "false" })).total).toBe(3);
    expect((await ads({ language: "fr" })).rows.map((a) => a.external_id)).toEqual(["800006"]);
    expect((await ads({ min_reach: "400000" })).rows.map((a) => a.external_id).sort()).toEqual([
      "800001",
      "800005",
    ]);
    expect((await ads({ q: "gratis verzending" })).rows.map((a) => a.external_id)).toEqual([
      "800001",
    ]);
    expect((await ads({ q: "baardolie OR barbe", country: "BE" })).total).toBe(2);
    expect((await ads({ domain: "bosbad.be" })).total).toBe(3);
  });

  it("filtert op looptijd: lopende én gestopte ads", async () => {
    const long = await ads({ min_days: "60" });
    // Loopt ≥ 60 dagen: 800001 (64), 800005 (120), 800006 (90). 800010 liep 50 dagen en stopte.
    expect(long.rows.map((a) => a.external_id).sort()).toEqual(["800001", "800005", "800006"]);
    const month = await ads({ min_days: "30", active: "false" });
    expect(month.rows.map((a) => a.external_id).sort()).toEqual(["800003", "800010"]);
  });

  it("sorteert op langst lopend en geeft adverteerder en shop mee", async () => {
    const r = await ads({ sort: "longest", active: "true" });
    expect(r.rows[0]).toMatchObject({
      external_id: "800005",
      advertisers: { page_name: "Bosbad" },
      shops: { domain: "bosbad.be" },
    });
    expect((await getAd(db, r.rows[0]!.id))?.external_id).toBe("800005");
  });
});

describe("adverteerders en e-mails", () => {
  it("sorteert adverteerders op actieve ads", async () => {
    const r = await listAdvertisers(db, parseFilters(AdvertiserFiltersSchema, {}));
    const seed = r.rows.filter((a) => a.page_id?.startsWith("10000000000000"));
    expect(seed[0]).toMatchObject({
      page_name: "Zilverzand Sieraden",
      active_ads: 3,
      total_ads: 4,
      shop_domain: "zilverzand.nl",
    });
    expect(Number(seed[0]!.total_reach)).toBe(672000);
  });

  it("filtert e-mails op type, shop en niche", async () => {
    const f = (raw: Record<string, string>) =>
      listEmails(db, parseFilters(EmailFiltersSchema, raw));
    expect((await f({ type: "welcome" })).total).toBe(3);
    expect((await f({ domain: "bosbad.be" })).rows.map((e) => e.subject)).toEqual([
      "Welkom bij Bosbad 🌲",
    ]);
    expect((await f({ niche: "Kettingen", type: "campaign" })).rows[0]?.subject).toContain(
      "Black Friday",
    );
    expect((await f({ q: "korting" })).total).toBeGreaterThanOrEqual(2);
  });
});

describe("workspace: folders, brandtracker, lookups", () => {
  let userId = "";
  let ws = "";
  beforeAll(async () => {
    const { data, error } = await db.auth.admin.createUser({
      email: `q-${Date.now()}@test.local`,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    ws = (await getWorkspaceForUser(db, userId))!.id;
  });
  afterAll(async () => {
    await db.auth.admin.deleteUser(userId);
  });

  it("maakt een folder, slaat items op en deelt via een link", async () => {
    const shop = (await getShopByDomain(db, "bosbad.be"))!;
    const ad = (await ads({ domain: "bosbad.be" })).rows[0]!;
    const folder = await createFolder(db, ws, userId, "  Winnende ads  ");
    await addFolderItem(db, ws, userId, folder.id, { type: "ad", id: ad.id });
    await addFolderItem(db, ws, userId, folder.id, { type: "ad", id: ad.id }); // dubbel = geen fout
    await addFolderItem(db, ws, userId, folder.id, { type: "shop", id: shop.id });

    expect(await listFolders(db, ws)).toMatchObject([{ name: "Winnende ads", itemCount: 2 }]);
    const full = (await getFolder(db, ws, folder.id))!;
    expect(full.ads.map((a) => a.id)).toEqual([ad.id]);
    expect(full.shops.map((s) => s.domain)).toEqual(["bosbad.be"]);

    expect(await getSharedFolder(db, "nietbestaandtoken123")).toBeNull();
    const token = (await setFolderSharing(db, ws, folder.id, true))!;
    expect((await getSharedFolder(db, token))?.folder.name).toBe("Winnende ads");
    await setFolderSharing(db, ws, folder.id, false);
    expect(await getSharedFolder(db, token)).toBeNull();

    // Een andere workspace kan niets in deze folder zetten.
    await expect(
      addFolderItem(db, "00000000-0000-0000-0000-000000000000", userId, folder.id, {
        type: "shop",
        id: shop.id,
      }),
    ).rejects.toThrow();
  });

  it("volgt en ontvolgt een shop", async () => {
    const shop = (await getShopByDomain(db, "zilverzand.nl"))!;
    await trackBrand(db, ws, userId, shop.id);
    await trackBrand(db, ws, userId, shop.id);
    expect(await isTracked(db, ws, shop.id)).toBe(true);
    expect((await listTrackedBrands(db, ws)).map((t) => t.shops.domain)).toEqual(["zilverzand.nl"]);
    await untrackBrand(db, ws, shop.id);
    expect(await isTracked(db, ws, shop.id)).toBe(false);
  });

  it("maakt één lookup per domein zolang die openstaat", async () => {
    const a = await requestLookup(db, ws, userId, "https://www.Nieuwe-Shop.nl/");
    const b = await requestLookup(db, ws, userId, "nieuwe-shop.nl");
    expect(a).toMatchObject({ domain: "nieuwe-shop.nl", status: "queued" });
    expect(b.id).toBe(a.id);
    await expect(requestLookup(db, ws, userId, "localhost")).rejects.toThrow();
  });
});
