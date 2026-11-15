import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { processBillingEvent, type BillingEvent } from "./billing";
import { createServiceClient } from "./client";
import { getWorkspaceForUser } from "./queries/workspace";
import { checkAndRecordUsage, getUsageSummary, getWorkspacePlan } from "./usage";

const db = createServiceClient();

async function newWorkspace() {
  const { data, error } = await db.auth.admin.createUser({
    email: `usage-${crypto.randomUUID()}@test.local`,
    email_confirm: true,
  });
  if (error) throw error;
  const ws = (await getWorkspaceForUser(db, data.user.id))!;
  return { userId: data.user.id, ws: ws.id };
}

describe("limieten en abonnementen", () => {
  const users: string[] = [];
  let free = { userId: "", ws: "" };
  beforeAll(async () => {
    free = await newWorkspace();
    users.push(free.userId);
    // Proef weghalen: deze workspace is gratis.
    await db.from("subscriptions").delete().eq("workspace_id", free.ws);
  });
  afterAll(async () => {
    for (const u of users) await db.auth.admin.deleteUser(u);
  });

  it("nieuwe gebruiker krijgt 7 dagen gratis Pro", async () => {
    const w = await newWorkspace();
    users.push(w.userId);
    const p = await getWorkspacePlan(db, w.ws);
    expect(p.plan).toBe("pro");
    const days = (Date.parse(p.trialEndsAt!) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);
    // Na de proef: gratis
    const later = new Date(Date.now() + 8 * 86_400_000);
    expect((await getWorkspacePlan(db, w.ws, later)).plan).toBe("free");
  });

  it("gratis: 5 shop-lookups per week, zelfde shop telt één keer", async () => {
    const r = [];
    for (const d of ["a.nl", "b.nl", "c.nl", "a.nl", "d.nl", "e.nl", "f.nl"]) {
      r.push(
        await checkAndRecordUsage(db, free.ws, "shop_lookup", { key: d, userId: free.userId }),
      );
    }
    expect(r.map((x) => x.allowed)).toEqual([true, true, true, true, true, true, false]);
    expect(r[6]).toMatchObject({ plan: "free", limit: 5, used: 5, remaining: 0, reason: "limit" });
    // Een al bekeken shop blijft toegankelijk
    expect((await checkAndRecordUsage(db, free.ws, "shop_lookup", { key: "b.nl" })).allowed).toBe(
      true,
    );
  });

  it("blijft binnen de limiet bij gelijktijdige verzoeken", async () => {
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        checkAndRecordUsage(db, free.ws, "ad_search", { key: `q${i}` }),
      ),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(20);
    const { count } = await db
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", free.ws)
      .eq("action", "ad_search");
    expect(count).toBe(20);
  });

  it("geen API op gratis; folders tellen bestaande rijen", async () => {
    expect(await checkAndRecordUsage(db, free.ws, "api_call", { source: "api" })).toMatchObject({
      allowed: false,
      reason: "not_in_plan",
    });
    expect((await checkAndRecordUsage(db, free.ws, "folder")).allowed).toBe(true);
    await db.from("folders").insert({ workspace_id: free.ws, name: "eerste" });
    expect(await checkAndRecordUsage(db, free.ws, "folder")).toMatchObject({
      allowed: false,
      used: 1,
      limit: 1,
    });
  });

  it("na een upgrade gelden de nieuwe limieten meteen; dubbele en oude events veranderen niets", async () => {
    const at = (s: number) => new Date(Date.now() + s * 1000).toISOString();
    const event = (
      status: "active" | "canceled",
      plan: "pro" | "agency",
      eventAt: string,
    ): BillingEvent => ({
      type: "subscription_upsert",
      eventAt,
      subscription: {
        workspaceId: free.ws,
        providerSubscriptionId: `sub_test_${free.ws}`,
        customerId: `cus_test_${free.ws}`,
        plan,
        interval: "month",
        seats: plan === "agency" ? 5 : 1,
        status,
        currentPeriodStart: at(0),
        currentPeriodEnd: at(30 * 86_400),
        cancelAtPeriodEnd: false,
        trialEndsAt: null,
      },
    });

    expect(
      await processBillingEvent(db, "stripe", "evt_1", "customer.subscription.created", [
        event("active", "pro", at(0)),
      ]),
    ).toBe("processed");
    expect(
      await processBillingEvent(db, "stripe", "evt_1", "customer.subscription.created", [
        event("active", "pro", at(0)),
      ]),
    ).toBe("duplicate");
    expect((await checkAndRecordUsage(db, free.ws, "shop_lookup", { key: "z.nl" })).allowed).toBe(
      true,
    ); // was op
    expect((await checkAndRecordUsage(db, free.ws, "folder")).allowed).toBe(true);
    expect(await checkAndRecordUsage(db, free.ws, "api_call", { source: "mcp" })).toMatchObject({
      allowed: true,
      plan: "pro",
      limit: 10_000,
      used: 1,
    });

    // Upgrade naar Agency met 5 seats
    await processBillingEvent(db, "stripe", "evt_2", "customer.subscription.updated", [
      event("active", "agency", at(10)),
    ]);
    const p = await getWorkspacePlan(db, free.ws);
    expect(p).toMatchObject({ plan: "agency", seats: 5 });
    const { data: ws } = await db
      .from("workspaces")
      .select("stripe_customer_id")
      .eq("id", free.ws)
      .single();
    expect(ws!.stripe_customer_id).toBe(`cus_test_${free.ws}`);

    // Een ouder event dat te laat binnenkomt, mag de upgrade niet terugdraaien
    await processBillingEvent(db, "stripe", "evt_old", "customer.subscription.updated", [
      event("active", "pro", at(5)),
    ]);
    expect((await getWorkspacePlan(db, free.ws)).plan).toBe("agency");

    // Mislukte betaling: plan blijft (herkansing); opzeggen: terug naar gratis
    await processBillingEvent(db, "stripe", "evt_3", "invoice.payment_failed", [
      { type: "payment_failed", eventAt: at(20), providerSubscriptionId: `sub_test_${free.ws}` },
    ]);
    expect(await getWorkspacePlan(db, free.ws)).toMatchObject({
      plan: "agency",
      subscription: { status: "past_due" },
    });
    await processBillingEvent(db, "stripe", "evt_4", "customer.subscription.deleted", [
      event("canceled", "agency", at(30)),
    ]);
    expect((await getWorkspacePlan(db, free.ws)).plan).toBe("free");

    const summary = await getUsageSummary(db, free.ws);
    expect(summary.usage.find((u) => u.action === "ad_search")).toMatchObject({
      limit: 20,
      used: 20,
    });
    await db.from("billing_events").delete().like("event_id", "evt_%");
  });
});
