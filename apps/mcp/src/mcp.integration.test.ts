import { createHash, randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  createApiKey,
  createAuthorizationCode,
  createServiceClient,
  exchangeCode,
  getWorkspaceForUser,
  refreshTokens,
  registerClient,
} from "@trendtrack/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { buildServer } from "./server";

// Echte tools tegen de lokale database met de seed-data (3 shops, 10 ads, 5 e-mails).
const db = createServiceClient();
// Tool-antwoorden zijn vrije JSON; in tests lezen we ze losjes uit.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
type Text = { content: { type: string; text: string }[]; isError?: boolean };

async function newWorkspace(plan: "pro" | "free") {
  const { data, error } = await db.auth.admin.createUser({
    email: `mcp-${crypto.randomUUID()}@test.local`,
    email_confirm: true,
  });
  if (error) throw error;
  const ws = (await getWorkspaceForUser(db, data.user.id))!.id;
  if (plan === "free") await db.from("subscriptions").delete().eq("workspace_id", ws);
  return { userId: data.user.id, ws };
}

async function connect(ws: string, userId: string | null) {
  const [c, s] = InMemoryTransport.createLinkedPair();
  await buildServer({ db, workspaceId: ws, userId, webOrigin: "http://localhost:3000" }).connect(s);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(c);
  return async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as Text;
    const text = r.content[0]!.text;
    return {
      isError: Boolean(r.isError),
      text,
      json: r.isError ? null : (JSON.parse(text) as Json),
    };
  };
}

describe("MCP-tools", () => {
  const users: string[] = [];
  let call: Awaited<ReturnType<typeof connect>>;
  let pro: { userId: string; ws: string };
  beforeAll(async () => {
    pro = await newWorkspace("pro");
    users.push(pro.userId);
    call = await connect(pro.ws, pro.userId);
  });
  afterAll(async () => {
    await db.from("lookup_requests").delete().eq("domain", "mcp-nieuwe-shop.nl");
    for (const u of users) await db.auth.admin.deleteUser(u);
  });

  it("list_filters", async () => {
    const r = await call("list_filters");
    expect(r.json!.niches).toEqual(expect.arrayContaining(["Kettingen", "Haar", "Accessoires"]));
  });

  it("search_shops met filters en schattingen", async () => {
    const r = await call("search_shops", { country: "NL", sort: "revenue" });
    expect(r.json!.shops.map((s: { domain: string }) => s.domain)).toEqual([
      "fietsfabriekje.nl",
      "zilverzand.nl",
    ]);
    expect(r.json!.shops[0].monthly_revenue).toMatchObject({
      estimate: true,
      low: 40000,
      high: 80000,
    });
    expect(r.json!.note).toContain("schattingen");
  });

  it("get_shop en get_shop_products", async () => {
    const s = await call("get_shop", { domain: "https://www.zilverzand.nl" });
    expect(s.json).toMatchObject({
      domain: "zilverzand.nl",
      theme: "Dawn",
      ads: { active: 3, total: 4 },
      emails: { count: 4 },
    });
    expect((await call("get_shop", { domain: "onbekend-xyz.nl" })).isError).toBe(true);
    const p = await call("get_shop_products", { domain: "zilverzand.nl", sort: "price", limit: 2 });
    expect(p.json!.products).toHaveLength(2);
    expect(p.json!.next_cursor).not.toBeNull();
    const p2 = await call("get_shop_products", {
      domain: "zilverzand.nl",
      sort: "price",
      cursor: p.json!.next_cursor,
    });
    expect(p2.json!.products.map((x: { title: string }) => x.title)).toEqual(["Parel oorbellen"]);
  });

  it("search_ads, get_ad en de voorbeeldvraag (NL-sieradenshops met ads > 30 dagen)", async () => {
    const r = await call("search_ads", { q: "gratis verzending", active: true });
    expect(r.json!.ads.map((a: { external_id: string }) => a.external_id)).toEqual(["800001"]);
    const one = await call("get_ad", { id: r.json!.ads[0].id });
    expect(one.json).toMatchObject({ external_id: "800001", spend: { estimate: true } });

    // "Welke NL-webshops in sieraden draaien de meeste ads die langer dan 30 dagen lopen?"
    const niches = (await call("list_filters")).json!.niches as string[];
    const jewelry = niches.filter((n) => ["Kettingen", "Oorbellen", "Ringen"].includes(n));
    const g = await call("search_ads", {
      country: "NL",
      min_days_running: 30,
      niches: jewelry,
      group_by: "shop",
    });
    expect(g.json!.shops[0]).toMatchObject({ shop_domain: "zilverzand.nl", ads: 2 }); // 800001 (64 d) en 800003 (32 d)
    const all = await call("search_ads", { country: "NL", min_days_running: 30, group_by: "shop" });
    expect(all.json!.shops.map((s: { shop_domain: string }) => s.shop_domain)).toEqual(
      expect.arrayContaining(["zilverzand.nl", "bosbad.be", "fietsfabriekje.nl"]),
    );
  });

  it("search_advertisers en get_advertiser", async () => {
    const r = await call("search_advertisers", { sort: "reach" });
    const bosbad = r.json!.advertisers.find((a: { name: string }) => a.name === "Bosbad");
    expect(bosbad).toMatchObject({ total_eu_reach: 883000 });
    expect((await call("get_advertiser", { id: bosbad.id })).json).toMatchObject({
      name: "Bosbad",
    });
  });

  it("search_emails", async () => {
    const r = await call("search_emails", { shop_domain: "zilverzand.nl", type: "welcome" });
    expect(r.json!.emails.map((e: { subject: string }) => e.subject)).toEqual([
      "Dit is ons verhaal",
      "Welkom bij Zilverzand ✨",
    ]);
  });

  it("lookup_domain", async () => {
    expect((await call("lookup_domain", { domain: "zilverzand.nl" })).json).toMatchObject({
      status: "known",
    });
    expect((await call("lookup_domain", { domain: "mcp-nieuwe-shop.nl" })).json).toMatchObject({
      status: "queued",
    });
    const { data } = await db
      .from("lookup_requests")
      .select("source")
      .eq("domain", "mcp-nieuwe-shop.nl")
      .single();
    expect(data!.source).toBe("mcp");
    expect((await call("lookup_domain", { domain: "localhost" })).isError).toBe(true);
  });

  it("track_brand en get_brand_changes", async () => {
    expect((await call("get_brand_changes")).json).toMatchObject({ tracked: [] });
    expect((await call("track_brand", { domain: "zilverzand.nl" })).json).toMatchObject({
      tracked: true,
    });
    const r = await call("get_brand_changes", { since: "2026-01-01" });
    expect(r.json!.tracked).toEqual(["zilverzand.nl"]);
    expect(r.json!.changes.map((c: { type: string }) => c.type)).toEqual(
      expect.arrayContaining(["price_change", "new_ad", "stopped_ad"]),
    );
    const onlyPrice = await call("get_brand_changes", {
      since: "2026-01-01",
      types: ["price_change"],
    });
    expect(onlyPrice.json!.changes).toHaveLength(1);
  });

  it("elke tool-call telt mee in het quotum (source mcp)", async () => {
    const { count } = await db
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", pro.ws)
      .eq("action", "api_call")
      .eq("source", "mcp");
    expect(count).toBeGreaterThan(15);
  });

  it("gratis plan: nette uitleg in plaats van data", async () => {
    const free = await newWorkspace("free");
    users.push(free.userId);
    const c = await connect(free.ws, free.userId);
    const r = await c("search_shops");
    expect(r.isError).toBe(true);
    expect(r.text).toContain("Pro of Agency");
  });
});

describe("MCP over HTTP", () => {
  const users: string[] = [];
  let url = "";
  let close: () => void;
  let ws = "";
  let userId = "";
  beforeAll(async () => {
    const w = await newWorkspace("pro");
    ws = w.ws;
    userId = w.userId;
    users.push(userId);
    const app = createApp({
      db,
      publicUrl: "http://127.0.0.1",
      webOrigin: "http://localhost:3000",
    });
    const server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    close = () => server.close();
  });
  afterAll(async () => {
    close();
    for (const u of users) await db.auth.admin.deleteUser(u);
  });

  const clientWith = async (token: string) => {
    const client = new Client({ name: "http-test", version: "0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${url}/mcp`), {
        requestInit: { headers: { authorization: `Bearer ${token}` } },
      }),
    );
    return client;
  };

  it("401 zonder token, met verwijzing naar de OAuth-metadata", async () => {
    const res = await fetch(`${url}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain(
      'resource_metadata="http://127.0.0.1/.well-known/oauth-protected-resource"',
    );
    const meta = await (await fetch(`${url}/.well-known/oauth-protected-resource`)).json();
    expect(meta).toMatchObject({
      resource: "http://127.0.0.1/mcp",
      authorization_servers: ["http://localhost:3000"],
    });
  });

  it("werkt met een API-key", async () => {
    const { key } = await createApiKey(db, ws, userId, "mcp-test");
    const client = await clientWith(key);
    expect((await client.listTools()).tools).toHaveLength(12);
    const r = (await client.callTool({
      name: "search_shops",
      arguments: { country: "BE" },
    })) as Text;
    expect(JSON.parse(r.content[0]!.text).shops[0].domain).toBe("bosbad.be");
  });

  it("werkt met OAuth: registreren, code met PKCE, token, refresh", async () => {
    const reg = await registerClient(db, {
      client_name: "Claude",
      redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
    });
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const code = await createAuthorizationCode(db, {
      clientId: reg.client_id,
      workspaceId: ws,
      userId,
      redirectUri: reg.redirect_uris[0]!,
      codeChallenge: challenge,
    });

    await expect(
      exchangeCode(db, {
        code,
        clientId: reg.client_id,
        redirectUri: reg.redirect_uris[0]!,
        codeVerifier: "x".repeat(43),
      }),
    ).rejects.toThrow(/PKCE|gebruikt/);
    const code2 = await createAuthorizationCode(db, {
      clientId: reg.client_id,
      workspaceId: ws,
      userId,
      redirectUri: reg.redirect_uris[0]!,
      codeChallenge: challenge,
    });
    const tokens = await exchangeCode(db, {
      code: code2,
      clientId: reg.client_id,
      redirectUri: reg.redirect_uris[0]!,
      codeVerifier: verifier,
    });
    await expect(
      exchangeCode(db, {
        code: code2,
        clientId: reg.client_id,
        redirectUri: reg.redirect_uris[0]!,
        codeVerifier: verifier,
      }),
    ).rejects.toThrow(); // eenmalig

    const client = await clientWith(tokens.access_token);
    const r = (await client.callTool({
      name: "get_shop",
      arguments: { domain: "bosbad.be" },
    })) as Text;
    expect(JSON.parse(r.content[0]!.text).domain).toBe("bosbad.be");

    const rotated = await refreshTokens(db, {
      refreshToken: tokens.refresh_token,
      clientId: reg.client_id,
    });
    expect(rotated.access_token).not.toBe(tokens.access_token);
    await expect(
      refreshTokens(db, { refreshToken: tokens.refresh_token, clientId: reg.client_id }),
    ).rejects.toThrow(); // oud refresh-token vervalt
    await expect(
      registerClient(db, { redirect_uris: ["http://evil.example/cb"] }),
    ).rejects.toThrow();
  });
});
