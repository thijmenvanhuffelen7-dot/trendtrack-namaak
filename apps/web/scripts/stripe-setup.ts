/**
 * Maakt de producten en prijzen in Stripe aan (idempotent, via lookup keys) en een portal-
 * configuratie waarmee klanten zelf kunnen up- en downgraden. Eerst in testmodus draaien:
 *
 *   pnpm --filter web stripe:setup
 *
 * Bedragen komen uit packages/core/src/plans.ts.
 */
import {
  INTERVAL_MONTHS,
  INTERVALS,
  PAID_PLANS,
  PLANS,
  priceCents,
  priceLookupKey,
  type BillingInterval,
} from "@trendtrack/core";
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key || !/^sk_(test|live)_/.test(key)) {
  console.error("STRIPE_SECRET_KEY ontbreekt in .env.local");
  process.exit(1);
}
const stripe = new Stripe(key);
const live = key.startsWith("sk_live_");

const recurring = (i: BillingInterval): Stripe.PriceCreateParams.Recurring =>
  i === "year" ? { interval: "year" } : { interval: "month", interval_count: INTERVAL_MONTHS[i] };

async function findOrCreateProduct(id: string, name: string, description: string) {
  try {
    return await stripe.products.retrieve(id);
  } catch {
    return stripe.products.create({ id, name, description, tax_code: "txcd_10103001" /* SaaS */ });
  }
}

async function ensurePrice(
  product: string,
  lookupKey: string,
  unitAmount: number,
  interval: BillingInterval,
) {
  const existing = (await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 }))
    .data[0];
  if (existing && existing.unit_amount === unitAmount && existing.product === product) {
    console.log(`  = ${lookupKey}: €${(unitAmount / 100).toFixed(2)}`);
    return existing;
  }
  // Nieuwe prijs; transfer_lookup_key verhuist de sleutel van een oude prijs (bestaande klanten houden die).
  const price = await stripe.prices.create({
    product,
    currency: "eur",
    unit_amount: unitAmount,
    recurring: recurring(interval),
    lookup_key: lookupKey,
    transfer_lookup_key: true,
    tax_behavior: "inclusive",
    metadata: { lookup_key: lookupKey },
  });
  console.log(
    `  + ${lookupKey}: €${(unitAmount / 100).toFixed(2)}${existing ? " (vervangt oude prijs)" : ""}`,
  );
  return price;
}

async function main() {
  console.log(`Stripe ${live ? "LIVE" : "test"}-modus`);
  const portalProducts: Stripe.BillingPortal.ConfigurationCreateParams.Features.SubscriptionUpdate.Product[] =
    [];
  for (const id of PAID_PLANS) {
    const plan = PLANS[id];
    const product = await findOrCreateProduct(
      `trendtrack_${id}`,
      `TrendTrack ${plan.name}`,
      `TrendTrack ${plan.name}-abonnement`,
    );
    console.log(`${plan.name}:`);
    const prices = [];
    for (const interval of INTERVALS)
      prices.push(
        await ensurePrice(
          product.id,
          priceLookupKey(id, interval),
          priceCents(plan.monthlyEur, interval),
          interval,
        ),
      );
    portalProducts.push({ product: product.id, prices: prices.map((p) => p.id) });
    if (plan.limits.extraSeatMonthlyEur) {
      const seat = await findOrCreateProduct(
        `trendtrack_${id}_seat`,
        `TrendTrack ${plan.name} extra gebruiker`,
        "Extra gebruiker bovenop de inbegrepen seats",
      );
      for (const interval of INTERVALS)
        await ensurePrice(
          seat.id,
          priceLookupKey(id, interval, true),
          priceCents(plan.limits.extraSeatMonthlyEur, interval),
          interval,
        );
    }
  }

  const config = await stripe.billingPortal.configurations.create({
    business_profile: { headline: "Beheer je TrendTrack-abonnement" },
    features: {
      customer_update: { enabled: true, allowed_updates: ["email", "address", "tax_id"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price", "quantity", "promotion_code"],
        products: portalProducts,
        proration_behavior: "create_prorations",
      },
    },
  });
  console.log(
    `\nPortal-configuratie: ${config.id}\nZet in .env.local: STRIPE_PORTAL_CONFIGURATION=${config.id}`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
