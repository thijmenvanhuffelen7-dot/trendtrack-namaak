"use server";

import { INTERVALS, PAID_PLANS, PLANS } from "@trendtrack/core";
import { validReferral } from "@trendtrack/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createCheckoutSession,
  createPortalSession,
  stripeConfigured,
} from "@/lib/server/billing/stripe";
import { serviceDb } from "@/lib/server/db";
import { getPlan, getSession, siteUrl } from "@/lib/server/session";

const CheckoutSchema = z.object({
  plan: z.enum(PAID_PLANS),
  interval: z.enum(INTERVALS),
  seats: z.coerce.number().int().min(1).max(200).optional(),
});

/** Start een Stripe Checkout. Heeft de workspace al een betaald abonnement, dan naar het portal (geen dubbele abonnementen). */
export async function checkoutAction(form: FormData) {
  if (!stripeConfigured()) redirect("/app/settings/billing?error=config");
  const input = CheckoutSchema.parse(Object.fromEntries(form));
  const { user, workspace } = await getSession();
  const plan = await getPlan();
  const origin = siteUrl(await headers());
  const { data: ws } = await serviceDb()
    .from("workspaces")
    .select("stripe_customer_id")
    .eq("id", workspace.id)
    .single();
  const customerId = ws?.stripe_customer_id ?? null;

  let url: string;
  try {
    if (plan.subscription && plan.subscription.provider !== "manual" && customerId) {
      url = await createPortalSession(customerId, `${origin}/app/settings/billing`);
    } else {
      const seats =
        input.plan === "agency" ? Math.max(PLANS.agency.limits.seats, input.seats ?? 3) : undefined;
      const referral = await validReferral(
        serviceDb(),
        (await headers()).get("cookie")?.match(/(?:^|;\s*)ref=([a-z0-9_-]{1,40})/i)?.[1] ?? null,
        user.id,
      );
      url = await createCheckoutSession({
        workspaceId: workspace.id,
        userId: user.id,
        email: user.email,
        customerId,
        plan: input.plan,
        interval: input.interval,
        seats,
        origin,
        referral,
      });
    }
  } catch (err) {
    console.error("[checkout]", err);
    redirect("/app/settings/billing?error=checkout");
  }
  redirect(url);
}

export async function portalAction() {
  if (!stripeConfigured()) redirect("/app/settings/billing?error=config");
  const { workspace } = await getSession();
  const { data: ws } = await serviceDb()
    .from("workspaces")
    .select("stripe_customer_id")
    .eq("id", workspace.id)
    .single();
  if (!ws?.stripe_customer_id) redirect("/app/settings/billing");
  let url: string;
  try {
    url = await createPortalSession(
      ws.stripe_customer_id,
      `${siteUrl(await headers())}/app/settings/billing`,
    );
  } catch (err) {
    console.error("[portal]", err);
    redirect("/app/settings/billing?error=checkout");
  }
  redirect(url);
}
