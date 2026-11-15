import {
  checkAndRecordUsage,
  createServiceClient,
  getWorkspaceForUser,
  getWorkspacePlan,
} from "@trendtrack/db";
import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stripeEvent, stripeSubscription } from "./fixtures";
import { handleStripeWebhook, WebhookSignatureError } from "./stripe";

// Volledige webhook-route zonder netwerk: echte Stripe-handtekeningen (zelfde geheim als de route),
// echte database. Bewijst dat een upgrade de limieten meteen verandert.
const db = createServiceClient();
const env = { ...process.env, STRIPE_WEBHOOK_SECRET: "whsec_test_geheim" };

function signed(event: Stripe.Event, secret = env.STRIPE_WEBHOOK_SECRET) {
  const payload = JSON.stringify(event);
  return { payload, signature: Stripe.webhooks.generateTestHeaderString({ payload, secret }) };
}

describe("Stripe-webhook → limieten", () => {
  let userId = "";
  let ws = "";
  const now = Math.floor(Date.now() / 1000);
  beforeAll(async () => {
    const { data } = await db.auth.admin.createUser({
      email: `stripe-${Date.now()}@test.local`,
      email_confirm: true,
    });
    userId = data.user!.id;
    ws = (await getWorkspaceForUser(db, userId))!.id;
    await db.from("subscriptions").delete().eq("workspace_id", ws); // gratis, zonder proef
  });
  afterAll(async () => {
    await db.from("billing_events").delete().like("event_id", "evt_it_%");
    await db.auth.admin.deleteUser(userId);
  });

  it("weigert een event met een foute handtekening", async () => {
    const e = stripeEvent(
      "customer.subscription.created",
      stripeSubscription({ workspaceId: ws, items: [{ lookupKey: "pro_month" }] }),
    );
    const { payload } = signed(e);
    const bad = signed(e, "whsec_ander_geheim").signature;
    await expect(handleStripeWebhook(db, payload, bad, env)).rejects.toBeInstanceOf(
      WebhookSignatureError,
    );
    await expect(handleStripeWebhook(db, payload, null, env)).rejects.toBeInstanceOf(
      WebhookSignatureError,
    );
    await expect(
      handleStripeWebhook(
        db,
        payload.replace("pro_month", "agency_month"),
        signed(e).signature,
        env,
      ),
    ).rejects.toBeInstanceOf(WebhookSignatureError);
  });

  it("checkout → abonnement → nieuwe limieten; downgrade en opzeggen werken ook", async () => {
    // Gratis: na 1 folder is het op
    await db.from("folders").insert({ workspace_id: ws, name: "x" });
    expect((await checkAndRecordUsage(db, ws, "folder")).allowed).toBe(false);

    const send = async (type: string, obj: unknown, id: string, created: number) => {
      const { payload, signature } = signed(stripeEvent(type, obj, { id, created }));
      return handleStripeWebhook(db, payload, signature, env);
    };
    const sub = (lookupKey: string, status: Stripe.Subscription.Status = "active") =>
      stripeSubscription({
        id: `sub_it_${ws}`,
        workspaceId: ws,
        customer: `cus_it_${ws}`,
        status,
        items: [{ lookupKey }],
      });

    expect(
      await send(
        "checkout.session.completed",
        { client_reference_id: ws, customer: `cus_it_${ws}`, metadata: {} },
        "evt_it_1",
        now,
      ),
    ).toEqual({
      status: "processed",
      type: "checkout.session.completed",
    });
    await send("customer.subscription.created", sub("pro_month"), "evt_it_2", now + 1);
    expect(
      await send("customer.subscription.created", sub("pro_month"), "evt_it_2", now + 1),
    ).toMatchObject({ status: "duplicate" });

    // Meteen Pro-limieten
    expect(await getWorkspacePlan(db, ws)).toMatchObject({ plan: "pro" });
    expect((await checkAndRecordUsage(db, ws, "folder")).allowed).toBe(true);
    expect(await checkAndRecordUsage(db, ws, "api_call", { source: "api" })).toMatchObject({
      allowed: true,
      limit: 10_000,
    });

    // Downgrade via het portal => customer.subscription.updated met een Starter-prijs
    await send("customer.subscription.updated", sub("starter_year"), "evt_it_3", now + 2);
    expect(await getWorkspacePlan(db, ws)).toMatchObject({
      plan: "starter",
      subscription: { billing_interval: "year" },
    });
    expect(await checkAndRecordUsage(db, ws, "api_call", { source: "api" })).toMatchObject({
      allowed: false,
      reason: "not_in_plan",
    });

    // Opzeggen => gratis
    await send(
      "customer.subscription.deleted",
      sub("starter_year", "canceled"),
      "evt_it_4",
      now + 3,
    );
    expect((await getWorkspacePlan(db, ws)).plan).toBe("free");
    const { data: w } = await db
      .from("workspaces")
      .select("stripe_customer_id")
      .eq("id", ws)
      .single();
    expect(w!.stripe_customer_id).toBe(`cus_it_${ws}`);
  });
});
