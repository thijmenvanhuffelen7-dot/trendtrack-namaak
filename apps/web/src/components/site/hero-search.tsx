"use client";

import { ArrowRight, Play, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export interface Estimate {
  domain: string;
  known: boolean;
  name?: string | null;
  niche?: string | null;
  active_ads?: number;
  monthly_revenue?: { low: number; mid: number; high: number; confidence: number | null } | null;
}

const eur = (n: number) =>
  `€ ${new Intl.NumberFormat("nl-NL", { notation: "compact", maximumFractionDigits: 1 }).format(n)}`;

/**
 * Hero op een diepgroen paneel. Het live element: vul een webshop in en de zwevende kaartjes op het
 * dashboardscherm tonen de schattingsband en het aantal actieve ads uit onze database. Zonder
 * JavaScript gaat het formulier naar het inlogscherm, dus het werkt altijd.
 */
export function Hero({ initial }: { initial: Estimate }) {
  const [shown, setShown] = useState<Estimate>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const domain = String(new FormData(e.currentTarget).get("domain") ?? "").trim();
    if (!domain) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/estimate?domain=${encodeURIComponent(domain)}`);
      const body = await res.json();
      if (!res.ok) setError(body.error ?? "Dat lukte niet.");
      else setShown(body);
    } catch {
      setError("Geen verbinding. Probeer het opnieuw.");
    } finally {
      setPending(false);
    }
  }

  const band = shown.monthly_revenue;
  return (
    <section id="zoek" aria-labelledby="hero-title" className="s-inset s-dark s-grain mt-2">
      <div className="s-wrap grid items-center gap-12 pt-12 pb-10 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-14">
        <div>
          <Link href="/tools" className="s-pill s-rise">
            <span className="s-tag bg-white text-[#0f1412]">Nieuw</span>
            Zeven gratis tools voor webshops
          </Link>
          <h1 id="hero-title" className="s-rise-2 mt-7" style={{ fontSize: "var(--step-display)" }}>
            Zie wat elke webshop <span className="s-accent-text">écht verkoopt.</span>
          </h1>
          <p className="s-rise-3 mt-6 max-w-[34rem] text-[var(--step-lead)] leading-relaxed text-[var(--s-body)]">
            De geschatte omzet, de lopende Meta-ads en de nieuwsbrieven van webshops in Nederland en
            België. In het dashboard, via de API of gewoon in Claude.
          </p>

          <div className="s-rise-4 mt-8 max-w-[34rem]">
            <form
              action="/login"
              method="get"
              onSubmit={onSubmit}
              role="search"
              className="relative flex flex-col gap-2 sm:block"
            >
              <label htmlFor="hero-domain" className="sr-only">
                Domein van een webshop
              </label>
              <span className="relative block">
                <Search
                  className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[var(--s-faint)]"
                  aria-hidden
                />
                <input
                  id="hero-domain"
                  name="domain"
                  className="s-input !h-14 !rounded-2xl !pl-11 !text-[16px] sm:!pr-44"
                  placeholder="bijvoorbeeld bosbad.be"
                  autoComplete="off"
                  inputMode="url"
                  required
                />
              </span>
              {/* Op een telefoon onder het veld, vanaf sm in het veld. */}
              <button
                type="submit"
                className="s-btn !min-h-11 !rounded-xl sm:absolute sm:top-1.5 sm:right-1.5"
                disabled={pending}
              >
                {pending ? "Zoeken…" : "Bekijk omzet"}
                <ArrowRight className="s-arrow size-4" aria-hidden />
              </button>
            </form>
            <p className="mt-3 min-h-6 text-[14px] text-[var(--s-muted)]" aria-live="polite">
              {error ? (
                <span className="text-[var(--s-danger)]">{error}</span>
              ) : shown.known && band ? (
                <>
                  <strong className="font-medium text-[var(--s-ink)]">
                    {shown.name ?? shown.domain}
                  </strong>
                  : {eur(band.low)} – {eur(band.high)} per maand (schatting, geen feit)
                </>
              ) : shown.known ? (
                `${shown.domain}: nog te weinig signalen voor een eerlijke schatting.`
              ) : (
                `${shown.domain} kennen we nog niet. Met een gratis account halen we hem binnen een minuut op.`
              )}
            </p>
          </div>

          <div className="s-rise-4 mt-6 flex flex-wrap gap-3">
            <Link href="/login?mode=signup" className="s-btn">
              <span className="s-btn-icon">
                <ArrowRight className="size-4" aria-hidden />
              </span>
              Begin gratis
            </Link>
            <Link href="/schattingen" className="s-btn-ghost">
              <Play className="size-4 fill-current" aria-hidden />
              Hoe we schatten
            </Link>
          </div>
        </div>

        {/* Echt dashboardscherm; de uitkomst van de zoekopdracht staat er als zwevende kaartjes op. */}
        <div className="relative px-2 pt-6 pb-8 sm:px-6">
          <div className="overflow-hidden rounded-[22px] border border-white/15 bg-white shadow-[0_30px_80px_-30px_rgb(0_0_0/0.6)]">
            <Image
              src="/screens/shop-detail.webp"
              alt="Shoppagina in het dashboard met geschatte omzet, groei en grafieken"
              width={1056}
              height={800}
              priority
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="block h-auto w-full"
            />
          </div>
          <div
            className="s-float absolute top-0 right-0 w-[min(62%,240px)] rounded-2xl border border-white/15 bg-[#0b3a31]/85 p-4 backdrop-blur-md"
            aria-hidden
          >
            <p className="text-[clamp(1.3rem,2.4vw,1.9rem)] leading-none font-bold tracking-[-0.03em] tabular-nums">
              {band ? `${eur(band.low)} – ${eur(band.high)}` : "–"}
            </p>
            <p className="mt-2 text-[13px] text-white/75">
              Geschatte omzet per maand · {shown.name ?? shown.domain}
            </p>
          </div>
          <div
            className="s-float-2 absolute bottom-0 left-0 rounded-2xl border border-white/15 bg-[#0b3a31]/85 px-4 py-3 backdrop-blur-md"
            aria-hidden
          >
            <p className="text-[clamp(1.3rem,2.2vw,1.7rem)] leading-none font-bold tracking-[-0.03em]">
              {shown.active_ads ?? 0}
            </p>
            <p className="mt-1 text-[13px] text-white/75">actieve ads in NL en BE</p>
          </div>
        </div>
      </div>
      <ul className="s-wrap flex flex-wrap gap-2 pb-10" aria-label="Bronnen">
        {[
          "Officiële Meta Ad Library",
          "Openbare Shopify-data",
          "Echte nieuwsbrieven",
          "API en MCP",
        ].map((c) => (
          <li key={c} className="s-chip">
            {c}
          </li>
        ))}
      </ul>
    </section>
  );
}
