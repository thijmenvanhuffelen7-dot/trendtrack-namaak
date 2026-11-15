import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  extractLandingDomain,
  mapMetaAd,
  MetaAdLibraryClient,
  MetaAdSchema,
  MetaApiError,
  MetaTokenError,
  readUsage,
} from "./meta-ad-library";

const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });

function client(responses: (() => Response)[], sleeps: number[] = []) {
  const urls: string[] = [];
  let i = 0;
  const c = new MetaAdLibraryClient({
    accessToken: "TEST_TOKEN",
    fetch: async (url) => {
      urls.push(url);
      const r = responses[Math.min(i++, responses.length - 1)]!;
      return r();
    },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  return { c, urls, sleeps };
}

async function collect(gen: AsyncGenerator<unknown[]>) {
  const out: unknown[] = [];
  for await (const page of gen) out.push(...page);
  return out;
}

describe("MetaAdLibraryClient", () => {
  it("pagineert via de after-cursor en stuurt de juiste parameters", async () => {
    const { c, urls } = client([
      () => json(JSON.parse(fixture("meta-ads-page-1.json"))),
      () => json(JSON.parse(fixture("meta-ads-page-2.json"))),
    ]);
    const ads = await collect(
      c.search({ countries: ["NL", "BE"], searchPageIds: ["100000000000001"] }),
    );
    expect(ads).toHaveLength(3);
    expect(urls).toHaveLength(2);
    const first = new URL(urls[0]!);
    expect(first.pathname).toBe("/v23.0/ads_archive");
    expect(first.searchParams.get("ad_type")).toBe("ALL");
    expect(first.searchParams.get("ad_reached_countries")).toBe('["NL","BE"]');
    expect(first.searchParams.get("search_page_ids")).toBe('["100000000000001"]');
    expect(first.searchParams.get("fields")).toContain("eu_total_reach");
    expect(new URL(urls[1]!).searchParams.get("after")).toBe("CURSOR_2");
  });

  it("gooit MetaTokenError bij een verlopen token, zonder retry", async () => {
    const { c, urls } = client([
      () =>
        json(
          { error: { message: "Error validating access token", code: 190, error_subcode: 463 } },
          { status: 400 },
        ),
    ]);
    await expect(
      collect(c.search({ countries: ["NL"], searchTerms: "korting" })),
    ).rejects.toBeInstanceOf(MetaTokenError);
    expect(urls).toHaveLength(1);
  });

  it("wacht bij een rate limit (code 613) en probeert opnieuw", async () => {
    const sleeps: number[] = [];
    const { c } = client(
      [
        () =>
          json(
            { error: { message: "Calls to this api have exceeded the rate limit.", code: 613 } },
            {
              status: 400,
              headers: {
                "x-business-use-case-usage": JSON.stringify({
                  "1": [
                    { type: "ads_archive", call_count: 100, estimated_time_to_regain_access: 3 },
                  ],
                }),
              },
            },
          ),
        () => json({ data: [] }),
      ],
      sleeps,
    );
    await collect(c.search({ countries: ["NL"], searchTerms: "korting" }));
    expect(sleeps).toEqual([180_000]);
  });

  it("wacht preventief als het gebruik boven 90% komt", async () => {
    const sleeps: number[] = [];
    const { c } = client(
      [
        () =>
          json({ data: [] }, { headers: { "x-app-usage": '{"call_count":95,"total_time":10}' } }),
      ],
      sleeps,
    );
    await collect(c.search({ countries: ["NL"], searchTerms: "x" }));
    expect(sleeps).toEqual([60_000]);
  });

  it("geeft na alle retries een MetaApiError zonder het token in de melding", async () => {
    const { c } = client([
      () => json({ error: { message: "Service unavailable", code: 2 } }, { status: 503 }),
    ]);
    const err = await collect(c.search({ countries: ["NL"], searchTerms: "x" })).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(MetaApiError);
    expect(String((err as Error).message)).not.toContain("TEST_TOKEN");
  });

  it("weigert zonder token", () => {
    expect(() => new MetaAdLibraryClient({ accessToken: "" })).toThrow();
  });
});

describe("readUsage", () => {
  it("neemt het hoogste percentage uit beide headers", () => {
    const h = new Headers({
      "x-app-usage": '{"call_count":20,"total_cputime":5,"total_time":30}',
      "x-business-use-case-usage":
        '{"123":[{"call_count":70,"estimated_time_to_regain_access":0}]}',
    });
    expect(readUsage(h)).toEqual({ maxPercent: 70, regainMinutes: 0 });
  });
});

describe("mapMetaAd", () => {
  const [a1, a2] = JSON.parse(fixture("meta-ads-page-1.json")).data.map((d: unknown) =>
    MetaAdSchema.parse(d),
  );
  const [a3] = JSON.parse(fixture("meta-ads-page-2.json")).data.map((d: unknown) =>
    MetaAdSchema.parse(d),
  );
  const now = new Date("2026-11-15T12:00:00Z");

  it("zet een actieve ad om met landingsdomein en spend-schatting", () => {
    const m = mapMetaAd(a1, ["NL"], now);
    expect(m).toMatchObject({
      external_id: "1200000000000001",
      page_id: "100000000000001",
      body: "Gratis verzending op alle zilveren kettingen! Bestel nu.",
      title: "Schakelketting zilver",
      landing_domain: "zilverzand.nl",
      landing_url: "https://zilverzand.nl/",
      is_active: true,
      ended_at: null,
      eu_total_reach: 412000,
      est_spend_low: 2966.4, // 412k × 1,2 / 1000 × 6
      est_spend_high: 12360, // 412k × 2,5 / 1000 × 12
      countries: ["NL"],
      languages: ["nl"],
    });
    expect(m.started_at).toBe("2026-09-10T00:00:00.000Z");
  });

  it("slaat nooit het access token op", () => {
    const m = mapMetaAd(a1, ["NL"], now);
    expect(JSON.stringify(m)).not.toContain("GEHEIM_TOKEN");
    expect(m.snapshot_url).toBe("https://www.facebook.com/ads/library/?id=1200000000000001");
  });

  it("markeert een ad met stopdatum in het verleden als inactief", () => {
    const m = mapMetaAd(a2, ["NL"], now);
    expect(m.is_active).toBe(false);
    expect(m.ended_at).toBe("2026-10-20T00:00:00.000Z");
    // instagram.com in de caption telt niet; het domein komt uit de tekst.
    expect(m.landing_domain).toBe("zilverzand.nl");
  });

  it("een stopdatum in de toekomst is nog actief", () => {
    expect(mapMetaAd(a3, ["BE"], now).is_active).toBe(true);
  });
});

describe("extractLandingDomain", () => {
  it("negeert linkdiensten en social", () => {
    expect(
      extractLandingDomain({
        ad_creative_link_captions: ["linktr.ee"],
        ad_creative_bodies: ["Volg ons!"],
      }),
    ).toBeNull();
    expect(extractLandingDomain({ ad_creative_link_captions: ["shop.merk.be"] })).toBe(
      "shop.merk.be",
    );
  });
});
