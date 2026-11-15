import type Stripe from "stripe";

/** Minimaal Stripe-abonnement zoals het in webhooks binnenkomt (API 2025+: periodes op het item). */
export function stripeSubscription(o: {
  id?: string;
  workspaceId?: string | null;
  customer?: string;
  status?: Stripe.Subscription.Status;
  items: { lookupKey: string; quantity?: number }[];
  periodStart?: number;
  periodEnd?: number;
  cancelAtPeriodEnd?: boolean;
}): Stripe.Subscription {
  const start = o.periodStart ?? 1_794_700_000;
  const end = o.periodEnd ?? start + 30 * 86_400;
  return {
    id: o.id ?? "sub_123",
    object: "subscription",
    customer: o.customer ?? "cus_123",
    status: o.status ?? "active",
    cancel_at_period_end: o.cancelAtPeriodEnd ?? false,
    trial_end: null,
    metadata: o.workspaceId === null ? {} : { workspace_id: o.workspaceId ?? "ws_123" },
    items: {
      object: "list",
      data: o.items.map((it, i) => ({
        id: `si_${i}`,
        object: "subscription_item",
        quantity: it.quantity ?? 1,
        current_period_start: start,
        current_period_end: end,
        price: {
          id: `price_${it.lookupKey}`,
          object: "price",
          lookup_key: it.lookupKey,
          metadata: {},
        },
      })),
    },
  } as unknown as Stripe.Subscription;
}

export function stripeEvent(
  type: string,
  object: unknown,
  o: { id?: string; created?: number } = {},
): Stripe.Event {
  return {
    id: o.id ?? `evt_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type,
    created: o.created ?? 1_794_700_100,
    api_version: "2025-10-29.clover",
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    data: { object },
  } as unknown as Stripe.Event;
}
