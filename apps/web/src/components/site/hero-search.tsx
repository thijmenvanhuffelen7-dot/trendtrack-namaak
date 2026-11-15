"use client";

import Image from "next/image";
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
 * De hero met het live element: vul een webshop in en het groene vlak toont de schattingsband uit
 * onze database. Zonder JavaScript gaat het formulier naar het inlogscherm, dus het werkt altijd.
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
    <section
      aria-labelledby="hero-title"
      className="s-wrap grid gap-10 pt-6 md:grid-cols-[var(--s-axis)_1fr] md:gap-0 md:pt-14"
    >
      <h1
        id="hero-title"
        className="order-1 md:order-2 md:col-start-2 md:row-start-1"
        style={{ fontSize: "var(--step-display)", lineHeight: 0.86 }}
      >
        <span className="s-mask">
          <span>Zie wie</span>
        </span>
        <span className="s-mask">
          <span>er groeit.</span>
        </span>
      </h1>

      <div className="s-after-head order-2 md:order-1 md:col-start-1 md:row-start-1 md:row-span-2 md:pt-[22vh] md:pr-10">
        <p className="max-w-[26ch] text-[var(--step-lead)] leading-[1.35]">
          De geschatte omzet, de lopende ads en de nieuwsbrieven van elke webshop in Nederland en
          België.
        </p>
        <form
          action="/login"
          method="get"
          onSubmit={onSubmit}
          className="mt-8 flex max-w-md flex-col gap-2 sm:flex-row"
          role="search"
        >
          <label htmlFor="hero-domain" className="sr-only">
            Domein van een webshop
          </label>
          <input
            id="hero-domain"
            name="domain"
            className="s-input"
            placeholder="bijvoorbeeld bosbad.be"
            autoComplete="off"
            inputMode="url"
            required
          />
          <button type="submit" className="s-btn shrink-0" disabled={pending}>
            {pending ? "Zoeken…" : "Bekijk de omzet"}
          </button>
        </form>
        <p className="mt-3 text-[15px] text-[var(--s-muted)]" aria-live="polite">
          {error ?? "Gratis, zonder account. Het antwoord verschijnt in het groene vlak."}
        </p>
      </div>

      <div className="order-3 md:col-start-2 md:row-start-2 md:mt-14">
        <div className="relative z-10 -mb-14 md:-mb-20" aria-live="polite">
          <div className="w-[min(78vw,300px)] bg-[var(--s-accent)] p-5 text-white transition-transform duration-300">
            {shown.known && band ? (
              <>
                <p className="text-[clamp(1.9rem,3vw,2.5rem)] leading-none font-semibold tracking-[-0.04em] tabular-nums">
                  {eur(band.low)} – {eur(band.high)}
                </p>
                <p className="mt-3 text-[15px] leading-snug">
                  Geschatte omzet per maand van {shown.name ?? shown.domain}
                  {shown.active_ads ? `, met ${shown.active_ads} actieve ads` : ""}. Een
                  bandbreedte, nooit één getal.
                </p>
              </>
            ) : (
              <>
                <p className="text-[clamp(1.5rem,2.4vw,2rem)] leading-none font-semibold tracking-[-0.04em] break-all">
                  {shown.domain}
                </p>
                <p className="mt-3 text-[15px] leading-snug">
                  {shown.known
                    ? "Nog te weinig signalen voor een eerlijke schatting."
                    : "Kennen we nog niet. Met een gratis account halen we hem binnen een minuut op."}
                </p>
              </>
            )}
          </div>
        </div>
        <div className="overflow-hidden" data-ui>
          <Image
            src="/screens/shop-detail.webp"
            alt="Het TrendTrack-dashboard met de schatting, groei en grafieken van een webshop"
            width={1056}
            height={800}
            priority
            sizes="(min-width: 768px) 66vw, 100vw"
            className="s-drift block h-auto w-full"
          />
        </div>
      </div>
    </section>
  );
}
