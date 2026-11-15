/**
 * RLS-audit (Prompt 14). Legt per tabel vast wie mag lezen en dwingt af dat niemand behalve de
 * service role schrijft. Een nieuwe tabel laat deze test falen tot je hem bewust indeelt.
 */
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "./client";
import type { Database } from "./database.gen";

type Client = SupabaseClient<Database>;
type Table = keyof Database["public"]["Tables"];
type Access = "public" | "anon" | "workspace" | "own" | "admin" | "service";

/** Wie mag een tabel lezen. Schrijven gaat voor alle tabellen alleen via de service role. */
const MATRIX: Record<Table, Access> = {
  // Openbare marktdata: elke ingelogde gebruiker
  ads: "public",
  advertisers: "public",
  emails: "public",
  products: "public",
  product_snapshots: "public",
  shops: "public",
  shop_events: "public",
  shop_snapshots: "public",
  // Ook zonder login (prijzen)
  plans: "anon",
  // Alleen leden van de workspace
  api_keys: "workspace",
  folders: "workspace",
  folder_items: "workspace",
  lookup_requests: "workspace",
  subscriptions: "workspace",
  tracked_brands: "workspace",
  usage_events: "workspace",
  workspace_members: "workspace",
  workspaces: "workspace",
  // Alleen je eigen rij
  affiliates: "own",
  profiles: "own",
  // Alleen admins
  job_runs: "admin",
  // Niemand behalve de service role
  api_rate_counters: "service",
  billing_events: "service",
  inbound_rejects: "service",
  oauth_clients: "service",
  oauth_codes: "service",
  oauth_tokens: "service",
  opted_out_domains: "service",
  optout_requests: "service",
  public_rate_counters: "service",
  seed_inboxes: "service",
  system_alerts: "service",
};
const TABLES = Object.keys(MATRIX) as Table[];

/** Functies die anon of ingelogde gebruikers via /rpc mogen aanroepen. */
const CALLABLE = ["is_admin", "is_workspace_member", "shop_facets"];

const anonClient = (): Client =>
  createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });

describe("RLS-audit", () => {
  const service = createServiceClient();
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  const users: string[] = [];
  let alice: { id: string; ws: string; client: Client };
  let bob: { id: string; ws: string; client: Client };

  async function user() {
    const email = `audit-${randomUUID()}@test.local`;
    const password = `pw-${randomUUID()}`;
    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    users.push(data.user.id);
    const client = anonClient();
    await client.auth.signInWithPassword({ email, password });
    const { data: ws } = await service
      .from("workspaces")
      .select("id")
      .eq("owner_id", data.user.id)
      .single();
    return { id: data.user.id, ws: ws!.id, client };
  }

  beforeAll(async () => {
    alice = await user();
    bob = await user();
    // Bob krijgt eigen data in tabellen die per workspace of per gebruiker zijn afgeschermd.
    await service
      .from("folders")
      .insert({ workspace_id: bob.ws, name: "Bob", created_by: bob.id })
      .throwOnError();
    await service
      .from("lookup_requests")
      .insert({ workspace_id: bob.ws, domain: "bob-audit.nl" })
      .throwOnError();
    await service
      .from("affiliates")
      .insert({ code: `bob-${randomUUID().slice(0, 8)}`, user_id: bob.id })
      .throwOnError();
  });

  afterAll(async () => {
    for (const u of users) await service.auth.admin.deleteUser(u);
    await pool.end();
  });

  it("elke tabel staat in de matrix en heeft RLS aan", async () => {
    const { rows } = await pool.query<{ relname: string; rls: boolean }>(
      `select c.relname, c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') order by 1`,
    );
    expect(rows.map((r) => r.relname).sort()).toEqual([...TABLES].sort());
    expect(rows.filter((r) => !r.rls).map((r) => r.relname)).toEqual([]);
  });

  it("er zijn alleen SELECT-policies, en anon alleen op plans", async () => {
    const { rows } = await pool.query<{ tablename: string; cmd: string; roles: string[] }>(
      "select tablename, cmd, roles::text[] as roles from pg_policies where schemaname = 'public'",
    );
    expect(rows.filter((p) => p.cmd !== "SELECT")).toEqual([]);
    expect(
      rows
        .filter((p) => p.roles.includes("anon") || p.roles.includes("public"))
        .map((p) => p.tablename),
    ).toEqual(["plans"]);
    const withPolicy = new Set(rows.map((r) => r.tablename));
    for (const t of TABLES) expect([t, withPolicy.has(t)]).toEqual([t, MATRIX[t] !== "service"]);
  });

  it("anon en ingelogde gebruikers kunnen alleen de toegestane functies aanroepen", async () => {
    const { rows } = await pool.query<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
        order by 1`,
    );
    expect(rows.map((r) => r.proname)).toEqual(CALLABLE);
    const { error } = await alice.client.rpc("record_usage" as never, {} as never);
    expect(error).not.toBeNull();
  });

  it("anon leest niets behalve de openbare plannen", async () => {
    const anon = anonClient();
    for (const t of TABLES) {
      const { data } = await anon.from(t).select("*").limit(5);
      if (MATRIX[t] === "anon") expect(data?.length, t).toBeGreaterThan(0);
      else expect([t, data?.length ?? 0]).toEqual([t, 0]);
    }
  });

  it("ingelogd: geen inserts of deletes op welke tabel dan ook", async () => {
    for (const t of TABLES) {
      const before = (await service.from(t).select("*", { count: "exact", head: true })).count;
      const ins = await alice.client.from(t).insert({} as never);
      expect([t, ins.error !== null]).toEqual([t, true]);
      await alice.client.from(t).delete();
      const after = (await service.from(t).select("*", { count: "exact", head: true })).count;
      expect([t, after]).toEqual([t, before]);
    }
  });

  it("ingelogd: data van een andere workspace of gebruiker blijft onzichtbaar", async () => {
    const own = await alice.client.from("workspaces").select("id");
    expect(own.data?.map((w) => w.id)).toEqual([alice.ws]);
    for (const t of [
      "folders",
      "lookup_requests",
      "subscriptions",
      "workspace_members",
      "usage_events",
      "api_keys",
      "tracked_brands",
    ] as const) {
      const { data } = await alice.client.from(t).select("workspace_id").eq("workspace_id", bob.ws);
      expect([t, data?.length ?? 0]).toEqual([t, 0]);
    }
    expect((await alice.client.from("profiles").select("id").eq("id", bob.id)).data).toEqual([]);
    expect(
      (await alice.client.from("affiliates").select("code").eq("user_id", bob.id)).data,
    ).toEqual([]);
    expect((await bob.client.from("affiliates").select("code")).data).toHaveLength(1);
    expect((await alice.client.from("job_runs").select("id").limit(1)).data).toEqual([]);
  });

  it("openbare marktdata is voor ingelogde gebruikers leesbaar", async () => {
    const { data, error } = await alice.client.from("shops").select("id").limit(1);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });
});
