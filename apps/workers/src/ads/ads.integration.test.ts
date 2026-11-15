import { MetaAdLibraryClient } from "@trendtrack/core";
import { createServiceClient } from "@trendtrack/db";
import { afterAll, describe, expect, it } from "vitest";
import { SupabaseAdsRepo } from "../repo/ads-repo";
import { fixture } from "../test/helpers";
import { syncAdvertiser } from "./ingest";

// Echte Meta-client met nep-netwerk (opgeslagen API-responses) naar de echte lokale database.
// Seed-shop zilverzand.nl en adverteerder 100000000000001 bestaan al (supabase/seed.sql).
describe("Meta-ingest naar Supabase", () => {
  const db = createServiceClient();
  const ids = ["1200000000000001", "1200000000000002", "1200000000000003"];
  afterAll(async () => {
    await db.from("ads").delete().in("external_id", ids);
    await db.from("advertisers").delete().eq("page_id", "100000000000002");
  });

  it("slaat ads op, koppelt aan de seed-shop en schat spend", async () => {
    const pages = [fixture("meta-ads-page-1.json"), fixture("meta-ads-page-2.json")];
    let i = 0;
    const client = new MetaAdLibraryClient({
      accessToken: "TEST_TOKEN",
      fetch: async () => new Response(pages[i++] ?? '{"data":[]}', { status: 200 }),
      sleep: async () => undefined,
    });

    const r = await syncAdvertiser("100000000000001", ["NL", "BE"], {
      client,
      ads: new SupabaseAdsRepo(db),
    });
    expect(r.saved).toBe(3);

    const { data: shop } = await db
      .from("shops")
      .select("id")
      .eq("domain", "zilverzand.nl")
      .single();
    const { data: ads } = await db
      .from("ads")
      .select(
        "external_id, shop_id, is_active, est_spend_low, est_spend_high, snapshot_url, raw, countries",
      )
      .in("external_id", ids)
      .order("external_id");
    expect(ads!.map((a) => a.shop_id)).toEqual([shop!.id, shop!.id, null]);
    expect(ads!.map((a) => a.is_active)).toEqual([true, false, true]);
    expect(ads![0]!.est_spend_low).toBeGreaterThan(0);
    expect(ads![0]!.est_spend_high).toBeGreaterThan(ads![0]!.est_spend_low!);
    expect(ads![0]!.countries).toEqual(["BE", "NL"]);
    expect(JSON.stringify(ads)).not.toContain("GEHEIM_TOKEN");

    const { data: adv } = await db
      .from("advertisers")
      .select("last_synced_at")
      .eq("page_id", "100000000000001")
      .single();
    expect(adv!.last_synced_at).not.toBeNull();
  });
});
