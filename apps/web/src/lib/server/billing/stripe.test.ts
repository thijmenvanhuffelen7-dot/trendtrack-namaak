import { describe, expect, it } from "vitest";
import { stripeEvent, stripeSubscription } from "./fixtures";
import { mapStripeEvent } from "./stripe";

describe("mapStripeEvent", () => {
  it("abonnement: plan, periode, seats en status", () => {
    const sub = stripeSubscription({
      workspaceId: "ws_1",
      items: [{ lookupKey: "agency_year" }, { lookupKey: "agency_seat_year", quantity: 2 }],
    });
    const [e] = mapStripeEvent(stripeEvent("customer.subscription.created", sub));
    expect(e).toEqual({
      type: "subscription_upsert",
      eventAt: new Date(1_794_700_100_000).toISOString(),
      subscription: {
        workspaceId: "ws_1",
        providerSubscriptionId: "sub_123",
        customerId: "cus_123",
        plan: "agency",
        interval: "year",
        seats: 5,
        status: "active",
        currentPeriodStart: new Date(1_794_700_000_000).toISOString(),
        currentPeriodEnd: new Date((1_794_700_000 + 30 * 86_400) * 1000).toISOString(),
        cancelAtPeriodEnd: false,
        trialEndsAt: null,
      },
    });
  });

  it("deleted = opgezegd; incomplete_expired = opgezegd; paused = geen toegang", () => {
    const sub = stripeSubscription({ items: [{ lookupKey: "pro_month" }] });
    expect(mapStripeEvent(stripeEvent("customer.subscription.deleted", sub))[0]).toMatchObject({
      subscription: { status: "canceled" },
    });
    expect(
      mapStripeEvent(
        stripeEvent("customer.subscription.updated", { ...sub, status: "incomplete_expired" }),
      )[0],
    ).toMatchObject({ subscription: { status: "canceled" } });
    expect(
      mapStripeEvent(stripeEvent("customer.subscription.updated", { ...sub, status: "paused" }))[0],
    ).toMatchObject({ subscription: { status: "unpaid" } });
  });

  it("checkout koppelt de klant aan de workspace", () => {
    expect(
      mapStripeEvent(
        stripeEvent("checkout.session.completed", {
          client_reference_id: "ws_9",
          customer: "cus_9",
          metadata: {},
        }),
      ),
    ).toEqual([{ type: "customer_linked", workspaceId: "ws_9", customerId: "cus_9" }]);
  });

  it("mislukte betaling: oude en nieuwe factuurvorm", () => {
    expect(
      mapStripeEvent(stripeEvent("invoice.payment_failed", { subscription: "sub_old" }))[0],
    ).toMatchObject({ providerSubscriptionId: "sub_old" });
    expect(
      mapStripeEvent(
        stripeEvent("invoice.payment_failed", {
          parent: { subscription_details: { subscription: "sub_new" } },
        }),
      )[0],
    ).toMatchObject({ type: "payment_failed", providerSubscriptionId: "sub_new" });
  });

  it("onbekende prijzen en events worden genegeerd", () => {
    expect(
      mapStripeEvent(
        stripeEvent(
          "customer.subscription.created",
          stripeSubscription({ items: [{ lookupKey: "iets_anders" }] }),
        ),
      ),
    ).toEqual([]);
    expect(mapStripeEvent(stripeEvent("charge.succeeded", {}))).toEqual([]);
  });
});
