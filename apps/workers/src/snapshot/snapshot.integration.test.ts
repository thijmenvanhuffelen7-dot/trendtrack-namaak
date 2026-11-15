import { createServiceClient, listShopEvents } from "@trendtrack/db";
import { afterAll, describe, expect, it } from "vitest";
import { detectShop } from "../crawler/detect-shop";
import { SupabaseShopRepo, SupabaseSnapshotRepo } from "../repo/supabase-shop-repo";
import { fakeNetwork, fixture, testFetcher } from "../test/helpers";
import { snapshotShop } from "./snapshot-shop";

const D = "integratietest-snapshot.nl";

function store(available: boolean[], price: string, reviews: number) {
  const products = [
    {
      id: 1,
      title: "Ketting",
      handle: "ketting",
      variants: available.map((a, i) => ({ id: 10 + i, price, available: a })),
      images: [],
    },
    {
      id: 2,
      title: "Ring",
      handle: "ring",
      variants: [{ id: 20, price: "25.00", available: true }],
      images: [],
    },
  ];
  return fakeNetwork({
    [`${D}/robots.txt`]: fixture("shopify-robots.txt"),
    [`${D}/`]: fixture("shopify-home.html").replace(
      "</body>",
      `<div data-number-of-reviews="${reviews}"></div></body>`,
    ),
    [`${D}/products.json?limit=250&page=1`]: JSON.stringify({ products }),
    [`${D}/products.json?limit=250&page=2`]: JSON.stringify({ products: [] }),
  });
}

describe("snapshot naar Supabase", () => {
  const db = createServiceClient();
  afterAll(async () => {
    await db.from("ads").delete().eq("landing_domain", D);
    await db.from("shops").delete().eq("domain", D);
  });

  it("na twee runs staan een omzetschatting met bandbreedte en een growth_score in de database", async () => {
    const repo = new SupabaseShopRepo(db);
    const snapshots = new SupabaseSnapshotRepo(db);
    const run = (net: ReturnType<typeof fakeNetwork>, now: string) =>
      snapshotShop(D, {
        fetcher: testFetcher(net.fetch),
        repo,
        snapshots,
        now: () => new Date(now),
      });

    await detectShop(D, { fetcher: testFetcher(store([true, true], "40.00", 300).fetch), repo });
    const { data: shop } = await db.from("shops").select("id").eq("domain", D).single();
    await db.from("ads").insert({
      platform: "meta",
      external_id: `it-snap-${Date.now()}`,
      shop_id: shop!.id,
      landing_domain: D,
      is_active: true,
      started_at: "2026-10-15T00:00:00Z",
      eu_total_reach: 150_000,
      est_spend_low: 900,
      est_spend_high: 1800,
    });

    await run(store([true, true], "40.00", 300), "2026-11-14T06:00:00Z");
    const r2 = await run(store([true, false], "42.00", 306), "2026-11-15T06:00:00Z");
    expect(r2.diff?.sellouts).toEqual([{ external_id: "1", variants: 1, price: 42 }]);

    const { data } = await db
      .from("shops")
      .select(
        "est_monthly_revenue, est_monthly_revenue_low, est_monthly_revenue_high, est_confidence, growth_score, est_signals",
      )
      .eq("id", shop!.id)
      .single();
    expect(data!.est_monthly_revenue_low).toBeLessThanOrEqual(data!.est_monthly_revenue!);
    expect(data!.est_monthly_revenue!).toBeLessThanOrEqual(data!.est_monthly_revenue_high!);
    expect(data!.est_confidence).toBeGreaterThan(0);
    expect(data!.growth_score).not.toBeNull();

    // De prijswijziging (40 → 42) staat als event klaar voor de Brandtracker-feed.
    const events = await listShopEvents(db, [shop!.id]);
    expect(events.map((e) => [e.type, e.payload])).toEqual([
      ["price_change", expect.objectContaining({ title: "Ketting", from: 40, to: 42 })],
    ]);

    const { data: snaps } = await db
      .from("shop_snapshots")
      .select("captured_on, sellout_value, review_count, est_daily_revenue")
      .eq("shop_id", shop!.id)
      .order("captured_on");
    expect(snaps).toHaveLength(2);
    expect(snaps![0]!.sellout_value).toBeNull();
    expect(snaps![1]).toMatchObject({
      captured_on: "2026-11-15",
      sellout_value: 42,
      review_count: 306,
    });
  });
});
