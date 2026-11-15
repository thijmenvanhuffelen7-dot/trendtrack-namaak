import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/server/db";
import { handleStripeWebhook, WebhookSignatureError } from "@/lib/server/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe-webhook. Instellen in Stripe (Developers → Webhooks) met de events:
 * checkout.session.completed, customer.subscription.created/updated/deleted, invoice.payment_failed.
 * Lokaal: stripe listen --forward-to localhost:3000/api/stripe/webhook
 */
export async function POST(req: Request) {
  const body = await req.text(); // ruwe body: nodig voor de handtekening
  try {
    const result = await handleStripeWebhook(
      serviceDb(),
      body,
      req.headers.get("stripe-signature"),
    );
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    if (err instanceof WebhookSignatureError)
      return NextResponse.json({ error: "ongeldige handtekening" }, { status: 400 });
    console.error("[stripe webhook]", err);
    // 500: Stripe probeert het later opnieuw.
    return NextResponse.json({ error: "verwerken mislukt" }, { status: 500 });
  }
}
