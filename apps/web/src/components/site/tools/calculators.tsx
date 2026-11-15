"use client";

import { useState } from "react";
import { breakEvenRoas, clv, margin } from "@/lib/site/calculators";
import { eur, num, NumField } from "./fields";

function Out({ items }: { items: [string, string, boolean?][] }) {
  // Het getal eerst, het label eronder: een uitkomst leest als "€ 27,95 winst per verkoop".
  return (
    <ul className="grid gap-3 md:grid-cols-2" aria-live="polite">
      {items.map(([label, value, big]) => (
        <li
          key={label}
          className={
            big
              ? "rounded-2xl bg-[linear-gradient(135deg,#19b394,#0c7866_55%,#075245)] shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] p-6 md:col-span-2"
              : "rounded-2xl border border-[var(--s-line)] bg-white/[0.02] p-5"
          }
        >
          <p
            className={
              big
                ? "text-[clamp(2.4rem,5vw,4rem)] leading-none font-semibold tracking-[-0.04em] tabular-nums"
                : "text-[var(--step-lead)] font-semibold tabular-nums"
            }
          >
            {value}
          </p>
          <p className="mt-1 text-[15px]">{label}</p>
        </li>
      ))}
    </ul>
  );
}

function useMarginInputs() {
  const [v, set] = useState({
    price: "49,95",
    vat: "21",
    cost: "14",
    ship: "5,50",
    fee: "1,9",
    other: "1",
  });
  const field = (k: keyof typeof v) => ({
    value: v[k],
    onChange: (x: string) => set({ ...v, [k]: x }),
  });
  const input = {
    priceInclVat: num(v.price),
    vatRate: num(v.vat) / 100,
    costPrice: num(v.cost),
    shippingCost: num(v.ship),
    paymentFeePct: num(v.fee) / 100,
    otherCost: num(v.other),
  };
  const fields = (
    <div className="grid gap-4 sm:grid-cols-2">
      <NumField id="c-price" label="Verkoopprijs inclusief btw" suffix="€" {...field("price")} />
      <NumField id="c-vat" label="Btw-tarief" suffix="%" {...field("vat")} />
      <NumField id="c-cost" label="Inkoopprijs zonder btw" suffix="€" {...field("cost")} />
      <NumField id="c-ship" label="Verzendkosten per bestelling" suffix="€" {...field("ship")} />
      <NumField id="c-fee" label="Transactiekosten" suffix="%" {...field("fee")} />
      <NumField id="c-other" label="Verpakking en overig" suffix="€" {...field("other")} />
    </div>
  );
  return { input, fields };
}

export function RoasCalculator() {
  const { input, fields } = useMarginInputs();
  const r = breakEvenRoas(input);
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      {fields}
      <Out
        items={[
          [
            "Break-even ROAS",
            r.roas === null ? "Geen winst" : r.roas.toLocaleString("nl-NL"),
            true,
          ],
          ["Maximaal aan ads per bestelling", eur(r.maxCpa)],
          ["Winstmarge vóór ads", `${r.margin.marginPct.toLocaleString("nl-NL")}%`],
        ]}
      />
    </div>
  );
}

export function MarginCalculator() {
  const { input, fields } = useMarginInputs();
  const m = margin(input);
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      {fields}
      <Out
        items={[
          ["Winst per verkoop", eur(m.profit), true],
          ["Winstmarge", `${m.marginPct.toLocaleString("nl-NL")}%`],
          ["Opslag op inkoop", `${m.markupPct.toLocaleString("nl-NL")}%`],
          ["Prijs zonder btw", eur(m.priceExVat)],
          ["Totale kosten", eur(m.totalCost)],
        ]}
      />
    </div>
  );
}

export function ClvCalculator() {
  const [v, set] = useState({ aov: "55", orders: "2,5", years: "3", margin: "45", vat: "21" });
  const field = (k: keyof typeof v) => ({
    value: v[k],
    onChange: (x: string) => set({ ...v, [k]: x }),
  });
  const r = clv({
    aov: num(v.aov),
    ordersPerYear: num(v.orders),
    years: num(v.years),
    grossMarginPct: num(v.margin),
    vatRate: num(v.vat) / 100,
  });
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <NumField
          id="v-aov"
          label="Gemiddelde orderwaarde inclusief btw"
          suffix="€"
          {...field("aov")}
        />
        <NumField id="v-orders" label="Bestellingen per klant per jaar" {...field("orders")} />
        <NumField id="v-years" label="Jaren dat een klant blijft" {...field("years")} />
        <NumField id="v-margin" label="Brutomarge" suffix="%" {...field("margin")} />
        <NumField id="v-vat" label="Btw-tarief" suffix="%" {...field("vat")} />
      </div>
      <Out
        items={[
          ["Winst per klant (CLV)", eur(r.profit), true],
          ["Omzet per klant", eur(r.revenue)],
          ["Maximaal om een klant te werven", eur(r.maxCac)],
        ]}
      />
    </div>
  );
}
