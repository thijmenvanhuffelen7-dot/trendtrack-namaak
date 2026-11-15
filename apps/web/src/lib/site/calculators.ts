/**
 * Rekenmodellen van de gratis calculators. Puur en getest; draaien volledig in de browser.
 * Bedragen zijn in euro's. Btw-tarieven NL: 21% (hoog), 9% (laag), 0%.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface MarginInput {
  priceInclVat: number;
  vatRate: number; // 0.21
  costPrice: number; // inkoop ex btw
  shippingCost: number; // per order, ex btw
  paymentFeePct: number; // 0.019 = 1,9%
  otherCost: number; // verpakking e.d., ex btw
}

export interface MarginResult {
  priceExVat: number;
  totalCost: number;
  profit: number;
  marginPct: number; // winst / prijs ex btw
  markupPct: number; // winst / inkoop
}

export function margin(i: MarginInput): MarginResult {
  const priceExVat = i.priceInclVat / (1 + i.vatRate);
  const fee = i.priceInclVat * i.paymentFeePct;
  const totalCost = i.costPrice + i.shippingCost + fee + i.otherCost;
  const profit = priceExVat - totalCost;
  return {
    priceExVat: r2(priceExVat),
    totalCost: r2(totalCost),
    profit: r2(profit),
    marginPct: priceExVat > 0 ? r2((profit / priceExVat) * 100) : 0,
    markupPct: i.costPrice > 0 ? r2((profit / i.costPrice) * 100) : 0,
  };
}

/**
 * Break-even ROAS: bij welke opbrengst per € advertentie speel je quitte?
 * ROAS hier = omzet incl. btw / ad spend (zoals Meta het toont).
 */
export function breakEvenRoas(i: MarginInput): {
  roas: number | null;
  maxCpa: number;
  margin: MarginResult;
} {
  const m = margin(i);
  // Je mag per order maximaal de winst (vóór ads) aan advertenties uitgeven.
  const maxCpa = Math.max(0, m.profit);
  return { roas: maxCpa > 0 ? r2(i.priceInclVat / maxCpa) : null, maxCpa: r2(maxCpa), margin: m };
}

export interface ClvInput {
  aov: number; // gemiddelde orderwaarde incl btw
  ordersPerYear: number;
  years: number;
  grossMarginPct: number; // 0-100, op omzet ex btw
  vatRate: number;
}

export function clv(i: ClvInput) {
  const revenue = i.aov * i.ordersPerYear * i.years;
  const profit = (revenue / (1 + i.vatRate)) * (i.grossMarginPct / 100);
  return {
    revenue: r2(revenue),
    profit: r2(profit),
    /** Vuistregel: geef hooguit een derde van de klantwaarde uit aan het werven van een klant. */
    maxCac: r2(profit / 3),
  };
}
