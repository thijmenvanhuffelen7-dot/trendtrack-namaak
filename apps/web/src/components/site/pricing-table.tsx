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
  // Plannamen (mobiel) één niveau onder de kop van de tabel.
  const Sub = headingLevel === 1 ? "h2" : "h3";
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
    <section aria-labelledby="pricing-title" className="s-section s-glow relative">
      <div className="s-wrap">
        <div data-reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <H
              id="pricing-title"
              style={{ fontSize: headingLevel === 1 ? "var(--step-display)" : "var(--step-head)" }}
            >
              Wat het <span className="s-accent-text">kost.</span>
            </H>
            <p className="mt-4 max-w-xl text-[var(--step-lead)] text-[#c4c4cc]">
              Gratis beginnen, opschalen wanneer je wilt. Langer vooruit betalen is goedkoper.
            </p>
          </div>
          <div
            role="radiogroup"
            aria-label="Betaalperiode"
            className="inline-flex rounded-2xl border border-[var(--s-line)] bg-[var(--s-bg-2)] p-1"
          >
            {INTERVALS.map((i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={interval === i}
                onClick={() => setInterval(i)}
                className={`rounded-xl px-4 py-2 text-[14px] transition-colors ${
                  interval === i
                    ? "bg-white/[0.09] text-[var(--s-ink)] shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
                    : "text-[var(--s-muted)] hover:text-[var(--s-ink)]"
                }`}
              >
                {i === "month" ? "Maand" : i === "quarter" ? "Kwartaal" : "Jaar"}
                {INTERVAL_DISCOUNT[i] > 0 && (
                  <span className="ml-1.5 text-[#5fe3c5]">−{INTERVAL_DISCOUNT[i] * 100}%</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <ul className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {ORDER.map((id) => {
            const p = price(id);
            const pro = id === "pro";
            return (
              <li
                key={id}
                className={`s-frame relative flex ${pro ? "border-[var(--s-accent-hi)]/40 shadow-[0_0_60px_-12px_rgb(25_179_148/0.35)]" : ""}`}
              >
                <div className="s-card flex w-full flex-col p-6">
                  <div className="flex h-7 items-center justify-between">
                    <Sub className="text-[22px]">{PLANS[id].name}</Sub>
                    {pro && <span className="s-tag bg-[var(--s-accent)] text-white">Populair</span>}
                  </div>
                  <p className="mt-6 font-[family-name:var(--font-display)] text-[44px] leading-none font-bold tracking-[-0.04em] tabular-nums">
                    {p.main}
                  </p>
                  <p className="mt-2 min-h-[2.6em] text-[14px] text-[var(--s-muted)]">{p.sub}</p>
                  <Link href={cta(id)} className={`mt-5 w-full ${pro ? "s-btn" : "s-btn-ghost"}`}>
                    {id === "free" ? "Gratis beginnen" : `Kies ${PLANS[id].name}`}
                  </Link>
                  <dl className="mt-6 space-y-3 border-t border-[var(--s-line)] pt-6 text-[14px]">
                    {ROWS.map(([label, val]) => {
                      const v = val(id);
                      const off = v === "Niet inbegrepen";
                      return (
                        <div key={label} className="flex items-start justify-between gap-3">
                          <dt className="text-[var(--s-muted)]">{label}</dt>
                          <dd
                            className={`text-right ${off ? "text-[var(--s-faint)]" : "text-[var(--s-ink)]"}`}
                          >
                            {v}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 max-w-2xl text-[14px] text-[var(--s-muted)]">
          Prijzen inclusief btw. Nieuwe accounts krijgen 7 dagen Pro, zonder creditcard. Betalen met
          iDEAL, Bancontact of creditcard; maandelijks opzegbaar.
        </p>
      </div>
    </section>
  );
}
