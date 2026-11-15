import { afterAll, describe, expect, it } from "vitest";
import { createServiceClient } from "./client";
import { approveOptout, createOptoutRequest, isOptedOut, rejectOptout } from "./optout";
import { getWorkspaceForUser, requestLookup } from "./queries/workspace";

const db = createServiceClient();
const users: string[] = [];

afterAll(async () => {
  for (const u of users) await db.auth.admin.deleteUser(u);
});

describe("opt-out", () => {
  it("goedkeuren verwijdert de shop en blokkeert het domein overal", async () => {
    const domain = `optout-${crypto.randomUUID().slice(0, 8)}.nl`;
    const { data: shop } = await db.from("shops").insert({ domain }).select("id").single();
    await db
      .from("products")
      .insert({ shop_id: shop!.id, external_id: "1", handle: "x", title: "X" });
    const { data: admin } = await db.auth.admin.createUser({
      email: `admin-${crypto.randomUUID()}@test.local`,
      email_confirm: true,
    });
    users.push(admin.user!.id);

    const req = await createOptoutRequest(db, {
      domain: `https://www.${domain}/`,
      email: `info@${domain}`,
    });
    expect(req.domain).toBe(domain);
    expect((await createOptoutRequest(db, { domain, email: `x@${domain}` })).existing).toBe(true);
    expect(await isOptedOut(db, domain)).toBe(false);

    expect(await approveOptout(db, req.id, admin.user!.id, "geverifieerd")).toBe(1);
    expect(await isOptedOut(db, domain)).toBe(true);
    const { count } = await db
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop!.id);
    expect(count).toBe(0);

    // Vangnet in de database: opnieuw toevoegen kan niet.
    const { error } = await db.from("shops").insert({ domain });
    expect(error?.message).toMatch(/opt-out/);
    // Een nieuwe lookup is meteen afgesloten.
    const ws = (await getWorkspaceForUser(db, admin.user!.id))!;
    expect((await requestLookup(db, ws.id, admin.user!.id, domain)).status).toBe("blocked");
    // Nogmaals goedkeuren mag niet.
    await expect(approveOptout(db, req.id, admin.user!.id)).rejects.toThrow();
  });

  it("afwijzen laat de shop staan", async () => {
    const domain = `keep-${crypto.randomUUID().slice(0, 8)}.nl`;
    await db.from("shops").insert({ domain });
    const { data: admin } = await db.auth.admin.createUser({
      email: `admin-${crypto.randomUUID()}@test.local`,
      email_confirm: true,
    });
    users.push(admin.user!.id);
    const req = await createOptoutRequest(db, { domain, email: "iemand@gmail.com" });
    await rejectOptout(db, req.id, admin.user!.id, "niet de eigenaar");
    expect(await isOptedOut(db, domain)).toBe(false);
    const { count } = await db
      .from("shops")
      .select("id", { count: "exact", head: true })
      .eq("domain", domain);
    expect(count).toBe(1);
    await db.from("shops").delete().eq("domain", domain);
  });
});
