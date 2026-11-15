import { MetaAdSchema, type AdsArchiveQuery, type MetaAd } from "@trendtrack/core";
import { describe, expect, it } from "vitest";
import { JOBS } from "../jobs";
import type { AdRow, AdsRepo } from "../repo/ads-repo";
import { fixture } from "../test/helpers";
import { discoverAds, syncAdvertiser, type AdsDeps } from "./ingest";
import { parseKeywords } from "./keywords";

const page = (n: 1 | 2): MetaAd[] =>
  JSON.parse(fixture(`meta-ads-page-${n}.json`)).data.map((d: unknown) => MetaAdSchema.parse(d));

class MemoryAdsRepo implements AdsRepo {
  advertisers = new Map<
    string,
    { id: string; page_name: string | null; shop_id: string | null; synced?: string }
  >();
  ads = new Map<string, AdRow>();
  shops = new Map<string, string>([["zilverzand.nl", "shop-zz"]]);

  async upsertAdvertisers(pages: { page_id: string; page_name: string | null }[]) {
    const created: string[] = [];
    for (const p of pages) {
      if (!this.advertisers.has(p.page_id)) {
        created.push(p.page_id);
        this.advertisers.set(p.page_id, {
          id: `adv-${p.page_id}`,
          page_name: p.page_name,
          shop_id: null,
        });
      }
    }
    return {
      ids: new Map([...this.advertisers].map(([k, v]) => [k, v.id])),
      created: [...new Set(created)],
    };
  }
  async existingAdCountries(ids: string[]) {
    return new Map(
      ids.flatMap((id) =>
        this.ads.has(id) ? [[id, this.ads.get(id)!.countries] as [string, string[]]] : [],
      ),
    );
  }
  async upsertAds(rows: AdRow[]) {
    for (const r of rows) this.ads.set(r.external_id, r);
    return rows.length;
  }
  async shopIdsByDomain(domains: string[]) {
    return new Map(
      domains.flatMap((d) =>
        this.shops.has(d) ? [[d, this.shops.get(d)!] as [string, string]] : [],
      ),
    );
  }
  async linkAdvertiserShop(advertiserId: string, shopId: string) {
    for (const a of this.advertisers.values())
      if (a.id === advertiserId && !a.shop_id) a.shop_id = shopId;
  }
  async markAdvertiserSynced(pageId: string, at: string) {
    this.advertisers.get(pageId)!.synced = at;
  }
  async advertiserPageIds() {
    return [...this.advertisers.keys()];
  }
}

function fakeClient(pages: MetaAd[][]) {
  const queries: AdsArchiveQuery[] = [];
  return {
    queries,
    client: {
      async *search(q: AdsArchiveQuery) {
        queries.push(q);
        for (const p of pages) yield p;
      },
    },
  };
}

function fakeQueue() {
  const sent: { name: string; data: object }[] = [];
  return {
    sent,
    queue: { send: async (name: string, data: object) => (sent.push({ name, data }), "id") },
  };
}

const now = () => new Date("2026-11-15T12:00:00Z");

describe("syncAdvertiser", () => {
  it("slaat ads op, koppelt ze aan de shop en zet onbekende domeinen in de wachtrij", async () => {
    const repo = new MemoryAdsRepo();
    const { client, queries } = fakeClient([page(1), page(2)]);
    const { queue, sent } = fakeQueue();
    const deps: AdsDeps = { client, ads: repo, queue, now };

    const r = await syncAdvertiser("100000000000001", ["NL", "BE"], deps);

    expect(queries[0]).toMatchObject({
      countries: ["NL", "BE"],
      searchPageIds: ["100000000000001"],
      activeStatus: "ALL",
    });
    expect(r.saved).toBe(3);
    expect(r.linkedToShop).toBe(2);
    expect(r.unknownDomains).toEqual(["nieuwewinkel.be"]);
    expect(sent).toEqual([{ name: JOBS.shopDetect, data: { domain: "nieuwewinkel.be" } }]);
    expect(repo.ads.get("1200000000000001")).toMatchObject({
      shop_id: "shop-zz",
      is_active: true,
      platform: "meta",
    });
    expect(repo.ads.get("1200000000000002")?.is_active).toBe(false);
    expect(repo.advertisers.get("100000000000001")).toMatchObject({
      shop_id: "shop-zz",
      synced: "2026-11-15T12:00:00.000Z",
    });
    expect(r.spend.estimate).toBe(true);
    expect(r.spend.high).toBeGreaterThan(r.spend.low);
  });

  it("voegt landen samen als een ad in meerdere landen gevonden wordt", async () => {
    const repo = new MemoryAdsRepo();
    await discoverAds("korting", "NL", { client: fakeClient([page(1)]).client, ads: repo, now });
    const nlOnly = repo.ads.get("1200000000000001")!;
    await discoverAds("korting", "BE", { client: fakeClient([page(1)]).client, ads: repo, now });
    const both = repo.ads.get("1200000000000001")!;
    expect(nlOnly.countries).toEqual(["NL"]);
    expect(both.countries).toEqual(["BE", "NL"]);
    // BE-CPM is lager: spend-schatting wordt opnieuw berekend
    expect(both.est_spend_low).toBeLessThan(nlOnly.est_spend_low!);
  });
});

describe("discoverAds", () => {
  it("zoekt actieve ads en zet nieuwe adverteerders in de wachtrij voor een volledige sync", async () => {
    const repo = new MemoryAdsRepo();
    const { client, queries } = fakeClient([page(1), page(2)]);
    const { queue, sent } = fakeQueue();
    const r = await discoverAds("gratis verzending", "NL", { client, ads: repo, queue, now });
    expect(queries[0]).toMatchObject({
      countries: ["NL"],
      searchTerms: "gratis verzending",
      activeStatus: "ACTIVE",
    });
    expect(r.newAdvertisers.sort()).toEqual(["100000000000001", "100000000000002"]);
    expect(sent.filter((s) => s.name === JOBS.adsSyncAdvertiser).map((s) => s.data)).toEqual([
      { page_id: "100000000000001" },
      { page_id: "100000000000002" },
    ]);
  });
});

describe("parseKeywords", () => {
  it("ontdubbelt en negeert commentaar", () => {
    expect(parseKeywords("# x\nKorting\nkorting\n\nbestel nu # cta")).toEqual([
      "korting",
      "bestel nu",
    ]);
  });
});
