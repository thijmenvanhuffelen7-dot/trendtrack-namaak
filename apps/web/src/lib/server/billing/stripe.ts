/**
 * Stripe-koppeling. Bewust zonder "server-only" zodat de webhook-logica in tests te draaien is;
 * importeer dit alleen vanuit server-code. De rest van de app praat via BillingEvent
 * (packages/db/billing.ts), zodat Mollie later als tweede provider kan.
 */
import {
  parseLookupKey,
  PLANS,
  priceLookupKey,
  type BillingInterval,
  type PlanId,
} from "@trendtrack/core";
import { processBillingEvent, type BillingEvent, type Db } from "@trendtrack/db";
import Stripe from "stripe";

export function stripeConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return /^sk_(test|live)_/.test(env.STRIPE_SECRET_KEY ?? "");
}

let client: Stripe | undefined;
export function getStripe(env: NodeJS.ProcessEnv = process.env): Stripe {
  if (!stripeConfigured(env))
    throw new Error("STRIPE_SECRET_KEY ontbreekt of is ongeldig (zie .env.example)");
  client ??= new Stripe(env.STRIPE_SECRET_KEY!, { appInfo: { name: "TrendTrack Benelux" } });
  return client;
}

// --- Checkout en portal -------------------------------------------------------------------------

export interface CheckoutInput {
  workspaceId: string;
  userId: string;
  email: string;
  customerId: string | null;
  plan: Exclude<PlanId, "free">;
  interval: BillingInterval;
  seats?: number;
  origin: string;
  /** Referral-code uit de affiliate-link (Prompt 13), komt in de metadata. */
  referral?: string | null;
}

/** Betaalmethodes voor de checkout. Leeg = de methodes die in het Stripe-dashboard aan staan. */
function paymentMethods(
  env: NodeJS.ProcessEnv,
): Stripe.Checkout.SessionCreateParams.PaymentMethodType[] | undefined {
  const list = (env.STRIPE_PAYMENT_METHODS ?? "card,ideal,bancontact")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length
    ? (list as Stripe.Checkout.SessionCreateParams.PaymentMethodType[])
    : undefined;
}

export async function createCheckoutSession(
  input: CheckoutInput,
  stripe = getStripe(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const plan = PLANS[input.plan];
  const extraSeats = Math.max(0, (input.seats ?? plan.limits.seats) - plan.limits.seats);
  const keys = [
    priceLookupKey(input.plan, input.interval),
    ...(extraSeats ? [priceLookupKey(input.plan, input.interval, true)] : []),
  ];
  const prices = await stripe.prices.list({ lookup_keys: keys, active: true, limit: 10 });
  const byKey = new Map(prices.data.map((p) => [p.lookup_key, p.id]));
  const missing = keys.filter((k) => !byKey.has(k));
  if (missing.length)
    throw new Error(
      `Stripe-prijzen ontbreken (${missing.join(", ")}). Draai: pnpm --filter web stripe:setup`,
    );

  const metadata = {
    workspace_id: input.workspaceId,
    user_id: input.userId,
    plan: input.plan,
    interval: input.interval,
    ...(input.referral ? { referral: input.referral } : {}),
  };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: input.workspaceId,
    ...(input.customerId ? { customer: input.customerId } : { customer_email: input.email }),
    line_items: [
      { price: byKey.get(keys[0]!)!, quantity: 1 },
      ...(extraSeats ? [{ price: byKey.get(keys[1]!)!, quantity: extraSeats }] : []),
    ],
    payment_method_types: paymentMethods(env),
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    tax_id_collection: { enabled: true },
    locale: "nl",
    metadata,
    subscription_data: { metadata },
    success_url: `${input.origin}/app/settings/billing?checkout=success`,
    cancel_url: `${input.origin}/app/settings/billing?checkout=cancel`,
  });
  if (!session.url) throw new Error("Stripe gaf geen checkout-URL terug");
  return session.url;
}

export async function createPortalSession(
  customerId: string,
  returnUrl: string,
  stripe = getStripe(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
    ...(env.STRIPE_PORTAL_CONFIGURATION ? { configuration: env.STRIPE_PORTAL_CONFIGURATION } : {}),
  });
  return session.url;
}

// --- Webhooks -----------------------------------------------------------------------------------

const STATUS: Record<
  Stripe.Subscription.Status,
  "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "unpaid"
> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  incomplete: "incomplete",
  incomplete_expired: "canceled",
  unpaid: "unpaid",
  paused: "unpaid",
};

const iso = (unix: number | null | undefined) =>
  unix ? new Date(unix * 1000).toISOString() : null;
const idOf = (v: string | { id: string } | null | undefined) =>
  typeof v === "string" ? v : (v?.id ?? null);

/** Zet een Stripe-abonnement om naar ons formaat. Null als er geen bekende prijs in zit. */
export function mapSubscription(
  sub: Stripe.Subscription,
  eventAt: string,
  deleted = false,
): BillingEvent | null {
  let base: { plan: PlanId; interval: BillingInterval; item: Stripe.SubscriptionItem } | null =
    null;
  let extraSeats = 0;
  for (const item of sub.items.data) {
    const key = parseLookupKey(item.price.lookup_key ?? item.price.metadata?.lookup_key);
    if (!key) continue;
    if (key.seat) extraSeats += item.quantity ?? 0;
    else base = { plan: key.plan, interval: key.interval, item };
  }
  if (!base) return null;
  // Sinds API-versie 2025-03-31 staan de periodes op het item in plaats van op het abonnement.
  const legacy = sub as unknown as { current_period_start?: number; current_period_end?: number };
  const item = base.item as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  return {
    type: "subscription_upsert",
    eventAt,
    subscription: {
      workspaceId: sub.metadata?.workspace_id ?? null,
      providerSubscriptionId: sub.id,
      customerId: idOf(sub.customer),
      plan: base.plan,
      interval: base.interval,
      seats: PLANS[base.plan].limits.seats + extraSeats,
      status: deleted ? "canceled" : STATUS[sub.status],
      currentPeriodStart: iso(item.current_period_start ?? legacy.current_period_start),
      currentPeriodEnd: iso(item.current_period_end ?? legacy.current_period_end),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEndsAt: iso(sub.trial_end),
    },
  };
}

/** Vertaalt een Stripe-event naar BillingEvents. Onbekende events leveren een lege lijst op. */
export function mapStripeEvent(event: Stripe.Event): BillingEvent[] {
  const eventAt = new Date(event.created * 1000).toISOString();
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      const workspaceId = s.client_reference_id ?? s.metadata?.workspace_id;
      const customerId = idOf(s.customer);
      return workspaceId && customerId
        ? [{ type: "customer_linked", workspaceId, customerId }]
        : [];
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const mapped = mapSubscription(
        event.data.object,
        eventAt,
        event.type === "customer.subscription.deleted",
      );
      if (!mapped)
        console.warn(
          `[stripe] abonnement ${event.data.object.id} zonder bekende prijs (lookup key); genegeerd`,
        );
      return mapped ? [mapped] : [];
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice & {
        subscription?: string | { id: string } | null;
      };
      const subId = idOf(inv.parent?.subscription_details?.subscription) ?? idOf(inv.subscription);
      return subId ? [{ type: "payment_failed", eventAt, providerSubscriptionId: subId }] : [];
    }
    default:
      return [];
  }
}

export class WebhookSignatureError extends Error {}

/** Controleert de handtekening en verwerkt het event (idempotent). */
export async function handleStripeWebhook(
  serviceDb: Db,
  rawBody: string,
  signature: string | null,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ status: "processed" | "duplicate"; type: string }> {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET ontbreekt");
  let event: Stripe.Event;
  try {
    // Alleen de webhooks-helper; die heeft geen API-key nodig.
    event = Stripe.webhooks.constructEvent(rawBody, signature ?? "", secret);
  } catch (err) {
    throw new WebhookSignatureError(err instanceof Error ? err.message : "ongeldige handtekening");
  }
  const status = await processBillingEvent(
    serviceDb,
    "stripe",
    event.id,
    event.type,
    mapStripeEvent(event),
  );
  return { status, type: event.type };
}
