"use client";

import {
  INTERVAL_DISCOUNT,
  INTERVALS,
  PLANS,
  quote,
  type BillingInterval,
  type PlanId,
} from "@trendtrack/core/plans";
import Link from "next/link";
import { useState } from "react";

const ORDER: PlanId[] = ["free", "starter", "pro", "agency"];
const eur = (cents: number) =>
  new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
const unl = (v: number | null, unit: string) =>
  v === null ? "Onbeperkt" : `${v.toLocaleString("nl-NL")} ${unit}`;

const ROWS: [string, (id: PlanId) => string][] = [
  ["Shop-lookups", (id) => unl(PLANS[id].limits.shopLookupsPerWeek, "per week")],
  ["Ads zoeken", (id) => unl(PLANS[id].limits.adSearchesPerDay, "per dag")],
  [
    "Folders",
    (id) => (PLANS[id].limits.folders === null ? "Onbeperkt" : String(PLANS[id].limits.folders)),
  ],
  [
    "Brandtracker",
    (id) =>
      PLANS[id].limits.trackedBrands
        ? `${PLANS[id].limits.trackedBrands} merken`
        : "Niet inbegrepen",
  ],
  [
    "E-mail library",
    (id) =>
      PLANS[id].limits.emailHistoryDays === null
        ? "Volledig"
        : `Laatste ${PLANS[id].limits.emailHistoryDays} dagen`,
  ],
  [
    "API en MCP",
    (id) =>
      PLANS[id].limits.api
        ? `${PLANS[id].limits.apiCallsPerMonth?.toLocaleString("nl-NL")} calls per maand`
        : "Niet inbegrepen",
  ],
  [
    "Gebruikers",
    (id) =>
      PLANS[id].limits.extraSeatMonthlyEur
        ? `${PLANS[id].limits.seats}, extra € ${PLANS[id].limits.extraSeatMonthlyEur} per maand`
        : String(PLANS[id].limits.seats),
  ],
];

/** Plannen als grote tabel. De aanbevolen kolom (Pro) staat op het accentvlak. Bron: packages/core/plans.ts. */
export function PricingTable({ headingLevel = 2 }: { headingLevel?: 1 | 2 }) {
  const [interval, setInterval] = useState<BillingInterval>("month");
  const H = headingLevel === 1 ? "h1" : "h2";
  const price = (id: PlanId) =>
    id === "free"
      ? { main: "€ 0", sub: "voor altijd" }
      : (() => {
          const q = quote(id, interval);
          return {
            main: eur(q.perMonthCents),
            sub:
              interval === "month"
                ? "per maand"
                : `per maand, ${eur(q.totalCents)} per ${interval === "year" ? "jaar" : "kwartaal"}`,
          };
        })();
  const cta = (id: PlanId) =>
    id === "free"
      ? "/login"
      : `/login?next=${encodeURIComponent(`/app/settings/billing?interval=${interval}`)}`;

  return (
    <section aria-labelledby="pricing-title" className="s-wrap py-[clamp(72px,8vw,120px)]">
      <div data-reveal className="flex flex-wrap items-end justify-between gap-6">
        <H
          id="pricing-title"
          style={
            headingLevel === 1
              ? { fontSize: "clamp(3rem, 8vw, 7.5rem)", lineHeight: 0.9 }
              : { fontSize: "var(--step-head)" }
          }
        >
          Wat het kost
        </H>
        <div
          role="radiogroup"
          aria-label="Betaalperiode"
          className="inline-flex bg-[var(--s-surface)] p-1"
        >
          {INTERVALS.map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={interval === i}
              onClick={() => setInterval(i)}
              className={`px-3 py-2 text-[15px] transition-colors ${interval === i ? "bg-[var(--s-ink)] text-[var(--s-bg)]" : "text-[var(--s-muted)] hover:text-[var(--s-ink)]"}`}
            >
              {i === "month" ? "Maand" : i === "quarter" ? "Kwartaal" : "Jaar"}
              {INTERVAL_DISCOUNT[i] > 0 && (
                <span className="ml-1">−{INTERVAL_DISCOUNT[i] * 100}%</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop: één grote tabel */}
      <table className="mt-12 hidden w-full table-fixed border-collapse text-left md:table">
        <caption className="sr-only">Plannen en wat erin zit</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="w-[26%] p-5 align-bottom text-[var(--s-muted)] font-normal text-[15px]"
            >
              Prijzen inclusief btw
            </th>
            {ORDER.map((id) => {
              const p = price(id);
              return (
                <th
                  key={id}
                  scope="col"
                  className={`p-5 align-bottom ${id === "pro" ? "bg-[var(--s-accent)]" : ""}`}
                >
                  <span
                    className="block font-semibold tracking-[-0.03em]"
                    style={{ fontSize: "clamp(1.5rem, 2.6vw, 2.6rem)" }}
                  >
                    {PLANS[id].name}
                  </span>
                  <span
                    className="block font-normal tracking-[-0.03em] tabular-nums"
                    style={{ fontSize: "clamp(1.5rem, 2.6vw, 2.6rem)" }}
                  >
                    {p.main}
                  </span>
                  <span className="block text-[15px] font-normal opacity-80">{p.sub}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([label, val], i) => (
            <tr key={label} className={i % 2 === 0 ? "bg-[var(--s-surface)]" : ""}>
              <th scope="row" className="p-5 text-[clamp(1.05rem,1.4vw,1.375rem)] font-normal">
                {label}
              </th>
              {ORDER.map((id) => (
                <td
                  key={id}
                  className={`p-5 text-[clamp(1rem,1.3vw,1.25rem)] ${id === "pro" ? "bg-[var(--s-accent)]" : ""}`}
                >
                  {val(id)}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td className="p-5" />
            {ORDER.map((id) => (
              <td key={id} className={`p-5 ${id === "pro" ? "bg-[var(--s-accent)]" : ""}`}>
                <Link
                  href={cta(id)}
                  className={id === "pro" ? "s-btn !bg-white !text-[#0c7866]" : "s-btn"}
                >
                  {id === "free" ? "Gratis beginnen" : `Kies ${PLANS[id].name}`}
                </Link>
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {/* Telefoon: één blok per plan */}
      <div className="mt-10 space-y-12 md:hidden">
        {ORDER.map((id) => {
          const p = price(id);
          return (
            <div
              key={id}
              className={`p-5 ${id === "pro" ? "bg-[var(--s-accent)]" : "bg-[var(--s-surface)]"}`}
            >
              <h3 className="text-[9vw] leading-none font-semibold tracking-[-0.04em]">
                {PLANS[id].name}
              </h3>
              <p className="mt-1 text-[9vw] leading-none tracking-[-0.04em] tabular-nums">
                {p.main}
              </p>
              <p className="mt-1 text-[15px] opacity-80">{p.sub}</p>
              <dl className="mt-5 space-y-3 text-[17px]">
                {ROWS.map(([label, val]) => (
                  <div key={label}>
                    <dt className="opacity-75">{label}</dt>
                    <dd>{val(id)}</dd>
                  </div>
                ))}
              </dl>
              <Link
                href={cta(id)}
                className={`mt-6 w-full ${id === "pro" ? "s-btn !bg-white !text-[#0c7866]" : "s-btn"}`}
              >
                {id === "free" ? "Gratis beginnen" : `Kies ${PLANS[id].name}`}
              </Link>
            </div>
          );
        })}
      </div>
      <p className="mt-6 max-w-2xl text-[15px] text-[var(--s-muted)]">
        Nieuwe accounts krijgen 7 dagen Pro, zonder creditcard. Betalen met iDEAL, Bancontact of
        creditcard; maandelijks opzegbaar.
      </p>
    </section>
  );
}
