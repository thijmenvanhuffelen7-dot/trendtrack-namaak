import type { BillingInterval, PlanId } from "@trendtrack/core";
import type { Db } from "./client";

/**
 * Provider-onafhankelijke betaal-events. Stripe (en later Mollie) vertalen hun webhooks hiernaar;
 * applyBillingEvent schrijft ze weg. Zo hoeft de rest van de app niets van de provider te weten.
 */
export type BillingEvent =
  | { type: "customer_linked"; workspaceId: string; customerId: string }
  | {
      type: "subscription_upsert";
      eventAt: string;
      subscription: {
        workspaceId: string | null;
        providerSubscriptionId: string;
        customerId: string | null;
        plan: PlanId;
        interval: BillingInterval | null;
        seats: number;
        status: "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "unpaid";
        currentPeriodStart: string | null;
        currentPeriodEnd: string | null;
        cancelAtPeriodEnd: boolean;
        trialEndsAt: string | null;
        /** Affiliate-code uit de metadata (alleen bij de eerste keer bewaard). */
        referral?: string | null;
      };
    }
  | { type: "payment_failed"; eventAt: string; providerSubscriptionId: string };

export type BillingProviderName = "stripe" | "mollie";

/** Verwerkt een webhook-event één keer (idempotent op provider + event-id). */
export async function processBillingEvent(
  serviceDb: Db,
  provider: BillingProviderName,
  eventId: string,
  eventType: string,
  events: BillingEvent[],
): Promise<"processed" | "duplicate"> {
  const { data: seen } = await serviceDb
    .from("billing_events")
    .select("event_id")
    .eq("provider", provider)
    .eq("event_id", eventId)
    .maybeSingle();
  if (seen) return "duplicate";
  for (const e of events) await applyBillingEvent(serviceDb, provider, e);
  // Pas na succesvolle verwerking markeren; bij een fout probeert de provider het opnieuw.
  await serviceDb
    .from("billing_events")
    .upsert(
      { provider, event_id: eventId, type: eventType },
      { onConflict: "provider,event_id", ignoreDuplicates: true },
    );
  return "processed";
}

export async function applyBillingEvent(
  serviceDb: Db,
  provider: BillingProviderName,
  e: BillingEvent,
): Promise<void> {
  if (e.type === "customer_linked") {
    const { error } = await serviceDb
      .from("workspaces")
      .update({ stripe_customer_id: e.customerId })
      .eq("id", e.workspaceId);
    if (error) throw error;
    return;
  }

  if (e.type === "payment_failed") {
    const { error } = await serviceDb
      .from("subscriptions")
      .update({ status: "past_due" })
      .eq("provider", provider)
      .eq("provider_subscription_id", e.providerSubscriptionId)
      .in("status", ["active", "trialing"]);
    if (error) throw error;
    return;
  }

  const s = e.subscription;
  const { data: existing } = await serviceDb
    .from("subscriptions")
    .select("id, workspace_id, provider_event_at")
    .eq("provider", provider)
    .eq("provider_subscription_id", s.providerSubscriptionId)
    .maybeSingle();
  // Ouder event dat na een nieuwer binnenkomt: negeren.
  if (existing?.provider_event_at && Date.parse(existing.provider_event_at) > Date.parse(e.eventAt))
    return;

  let workspaceId = existing?.workspace_id ?? s.workspaceId;
  if (!workspaceId && s.customerId) {
    const { data: ws } = await serviceDb
      .from("workspaces")
      .select("id")
      .eq("stripe_customer_id", s.customerId)
      .maybeSingle();
    workspaceId = ws?.id ?? null;
  }
  if (!workspaceId)
    throw new Error(`Abonnement ${s.providerSubscriptionId} hoort bij geen bekende workspace`);

  const row = {
    workspace_id: workspaceId,
    plan_id: s.plan,
    status: s.status,
    provider,
    provider_subscription_id: s.providerSubscriptionId,
    provider_customer_id: s.customerId,
    billing_interval: s.interval,
    seats: s.seats,
    current_period_start: s.currentPeriodStart,
    current_period_end: s.currentPeriodEnd,
    cancel_at_period_end: s.cancelAtPeriodEnd,
    trial_ends_at: s.trialEndsAt,
    provider_event_at: e.eventAt,
    ...(s.referral ? { referral_code: s.referral } : {}),
  };
  const { error } = await serviceDb
    .from("subscriptions")
    .upsert(row, { onConflict: "provider,provider_subscription_id" });
  if (error) throw error;
  if (s.customerId)
    await serviceDb
      .from("workspaces")
      .update({ stripe_customer_id: s.customerId })
      .eq("id", workspaceId)
      .is("stripe_customer_id", null);
}
