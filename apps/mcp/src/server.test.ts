import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Db } from "@trendtrack/db";
import { describe, expect, it } from "vitest";
import { buildServer } from "./server";

describe("MCP-server (zonder database)", () => {
  it("biedt alle tools aan, met readOnlyHint waar het klopt en duidelijke beschrijvingen", async () => {
    const [c, s] = InMemoryTransport.createLinkedPair();
    await buildServer({
      db: {} as Db,
      workspaceId: "ws",
      userId: null,
      webOrigin: "http://x",
    }).connect(s);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(c);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_ad",
      "get_advertiser",
      "get_brand_changes",
      "get_shop",
      "get_shop_products",
      "list_filters",
      "lookup_domain",
      "search_ads",
      "search_advertisers",
      "search_emails",
      "search_shops",
      "track_brand",
    ]);
    for (const t of tools) {
      expect(t.description!.length, t.name).toBeGreaterThan(40);
      expect(t.annotations?.readOnlyHint, t.name).toBe(
        !["lookup_domain", "track_brand"].includes(t.name),
      );
    }
    const ads = tools.find((t) => t.name === "search_ads")!;
    expect(Object.keys(ads.inputSchema.properties ?? {})).toEqual(
      expect.arrayContaining([
        "q",
        "country",
        "active",
        "min_days_running",
        "min_reach",
        "group_by",
        "limit",
        "cursor",
      ]),
    );
    expect(client.getInstructions()).toContain("schattingen");
  });
});
