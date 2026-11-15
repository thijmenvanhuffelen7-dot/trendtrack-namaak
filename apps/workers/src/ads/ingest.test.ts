import {
  MetaAdSchema,
  type AdsArchiveQuery,
  type MetaAd,
  type ShopEventInput,
} from "@trendtrack/core";
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
  events: ShopEventInput[] = [];
  async existingAds(ids: string[]) {
    return new Map(
      ids.flatMap((id) => {
        const a = this.ads.get(id);
        return a ? [[id, { countries: a.countries, is_active: a.is_active }] as const] : [];
      }),
    );
  }
  async upsertAds(rows: AdRow[]) {
    for (const r of rows) this.ads.set(r.external_id, r);
    return new Map(rows.map((r) => [r.external_id, `ad-${r.external_id}`]));
  }
  async saveEvents(events: ShopEventInput[]) {
    this.events.push(...events);
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

describe("feed-events", () => {
  it("meldt een ad die net gestopt is één keer, en oude ads niet als nieuw", async () => {
    const repo = new MemoryAdsRepo();
    const [active, stopped] = page(1);
    // Eerste sync: ad 1 loopt al sinds september (geen nieuws), ad 2 stopte 20 okt (te oud).
    await syncAdvertiser("100000000000001", ["NL"], {
      client: fakeClient([[active!, stopped!]]).client,
      ads: repo,
      now,
    });
    expect(repo.events).toEqual([]);

    // Ad 1 stopt gisteren => stopped_ad
    const justStopped = { ...active!, ad_delivery_stop_time: "2026-11-14" };
    await syncAdvertiser("100000000000001", ["NL"], {
      client: fakeClient([[justStopped]]).client,
      ads: repo,
      now,
    });
    expect(repo.events.map((e) => [e.type, e.dedupe_key, e.shop_id])).toEqual([
      ["stopped_ad", "stopped_ad:1200000000000001", "shop-zz"],
    ]);
    expect(repo.events[0]?.payload.run_days).toBe(65);

    // Een gloednieuwe ad => new_ad
    const fresh = { ...active!, id: "1200000000000099", ad_delivery_start_time: "2026-11-14" };
    await syncAdvertiser("100000000000001", ["NL"], {
      client: fakeClient([[fresh]]).client,
      ads: repo,
      now,
    });
    expect(repo.events.at(-1)).toMatchObject({ type: "new_ad", ref_id: "ad-1200000000000099" });
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
