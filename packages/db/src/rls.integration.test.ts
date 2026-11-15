import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "./database.gen";
import { createServiceClient } from "./client";

type Client = SupabaseClient<Database>;

const url = () => process.env.SUPABASE_URL!;
const anonKey = () => process.env.SUPABASE_ANON_KEY!;

function anonClient(): Client {
  return createClient<Database>(url(), anonKey(), { auth: { persistSession: false } });
}

async function createUser(admin: Client) {
  const email = `rls-${randomUUID()}@test.local`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  // De trigger handle_new_user maakt een persoonlijke workspace aan.
  const { data: ws, error: wsError } = await admin
    .from("workspaces")
    .select("id")
    .eq("owner_id", data.user.id)
    .single();
  if (wsError) throw wsError;
  return { userId: data.user.id, workspaceId: ws.id, client };
}

describe("Row Level Security", () => {
  let admin: Client;
  let alice: Awaited<ReturnType<typeof createUser>>;
  let bob: Awaited<ReturnType<typeof createUser>>;
  let aliceFolderId: string;

  beforeAll(async () => {
    admin = createServiceClient();
    alice = await createUser(admin);
    bob = await createUser(admin);

    const { data, error } = await admin
      .from("folders")
      .insert({ workspace_id: alice.workspaceId, created_by: alice.userId, name: "Winnende ads" })
      .select("id")
      .single();
    if (error) throw error;
    aliceFolderId = data.id;

    const { error: keyError } = await admin.from("api_keys").insert({
      workspace_id: alice.workspaceId,
      name: "test",
      prefix: "tt_live_test",
      key_hash: `hash-${randomUUID()}`,
    });
    if (keyError) throw keyError;
  });

  afterAll(async () => {
    for (const u of [alice, bob]) if (u) await admin.auth.admin.deleteUser(u.userId);
  });

  it("een gebruiker ziet de eigen folders", async () => {
    const { data, error } = await alice.client.from("folders").select("id");
    expect(error).toBeNull();
    expect(data?.map((f) => f.id)).toContain(aliceFolderId);
  });

  it("een gebruiker kan andermans folders niet lezen", async () => {
    const { data, error } = await bob.client.from("folders").select("id").eq("id", aliceFolderId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("een gebruiker ziet andermans workspace en api-keys niet", async () => {
    const ws = await bob.client.from("workspaces").select("id").eq("id", alice.workspaceId);
    expect(ws.data).toEqual([]);
    const keys = await bob.client
      .from("api_keys")
      .select("id")
      .eq("workspace_id", alice.workspaceId);
    expect(keys.data).toEqual([]);
  });

  it("de key_hash van een API-key is niet leesbaar, ook niet voor de eigenaar", async () => {
    const { error } = await alice.client.from("api_keys").select("key_hash");
    expect(error).not.toBeNull();
    const ok = await alice.client.from("api_keys").select("id, prefix");
    expect(ok.data).toHaveLength(1);
  });

  it("ingelogde gebruikers lezen openbare data, anoniem niet", async () => {
    const authed = await alice.client.from("shops").select("domain");
    expect(authed.data?.length).toBeGreaterThanOrEqual(3);
    const anon = await anonClient().from("shops").select("domain");
    expect(anon.data ?? []).toEqual([]);
  });

  it("gebruikers kunnen niet schrijven; alleen de service role", async () => {
    const shopInsert = await alice.client.from("shops").insert({ domain: "hack.nl" });
    expect(shopInsert.error).not.toBeNull();

    const folderInsert = await alice.client
      .from("folders")
      .insert({ workspace_id: alice.workspaceId, name: "direct" });
    expect(folderInsert.error).not.toBeNull();

    const update = await alice.client
      .from("folders")
      .update({ name: "gewijzigd" })
      .eq("id", aliceFolderId)
      .select();
    expect(update.data ?? []).toEqual([]);
  });

  it("plannen zijn publiek leesbaar", async () => {
    const { data } = await anonClient().from("plans").select("id").order("sort_order");
    expect(data?.map((p) => p.id)).toEqual(["free", "starter", "pro", "agency"]);
  });
});
