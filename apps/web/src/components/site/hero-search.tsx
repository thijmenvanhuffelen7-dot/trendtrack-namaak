"use client";

import { ArrowRight, ChevronRight, Search } from "lucide-react";
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

const SCREENS: [string, string, string][] = [
  ["shop-detail", "Shop-detail", "Shoppagina met geschatte omzet, groei en grafieken"],
  ["ads", "Ads-bibliotheek", "Ads uit Nederland en België met looptijd en bereik"],
  ["emails", "E-mail library", "Welkomstmails en campagnes van webshops"],
  ["shops", "Shops", "Lijst van webshops met omzet, thema en apps"],
  ["brandtracker", "Brandtracker", "Dagelijkse feed van gevolgde merken"],
  ["shop-products", "Producten", "Producten van een shop met prijzen en voorraad"],
];

function ScreenCard({ src, label, alt }: { src: string; label: string; alt: string }) {
  return (
    <figure className="s-frame">
      <figcaption className="s-label px-3 pt-2 pb-2.5">{label}</figcaption>
      <div className="overflow-hidden rounded-[18px] border border-[var(--s-line)]">
        <Image
          src={`/screens/${src}.webp`}
          alt={alt}
          width={1056}
          height={800}
          sizes="320px"
          className="block h-auto w-full"
        />
      </div>
    </figure>
  );
}

/**
 * De hero met het live element: vul een webshop in en de kaart toont de schattingsband uit onze
 * database. Zonder JavaScript gaat het formulier naar het inlogscherm, dus het werkt altijd.
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
  const left = SCREENS.slice(0, 3);
  const right = SCREENS.slice(3);
  return (
    <section
      id="zoek"
      aria-labelledby="hero-title"
      className="s-glow s-grain relative overflow-hidden"
    >
      <div className="s-wrap grid items-center gap-12 pt-14 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-24">
        <div>
          <Link href="/tools" className="s-pill s-rise">
            <span className="s-tag bg-[var(--s-accent)] text-white">Nieuw</span>
            Zeven gratis tools voor webshops
            <ChevronRight className="size-4 text-[var(--s-faint)]" aria-hidden />
          </Link>
          <h1 id="hero-title" className="s-rise-2 mt-7" style={{ fontSize: "var(--step-display)" }}>
            Zie wat elke webshop verkoopt.
          </h1>
          <p className="s-rise-3 mt-6 max-w-[34rem] text-[var(--step-lead)] leading-relaxed text-[#c4c4cc]">
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

            <div className="s-frame mt-4" aria-live="polite">
              <div className="s-card flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="s-label">
                    {shown.known ? (shown.name ?? shown.domain) : shown.domain}
                  </p>
                  {shown.known && band ? (
                    <p className="mt-1 font-[family-name:var(--font-display)] text-[clamp(1.6rem,2.6vw,2.1rem)] leading-none font-bold tracking-[-0.03em] tabular-nums">
                      {eur(band.low)} – {eur(band.high)}
                      <span className="ml-2 font-[family-name:var(--font-satoshi)] text-[14px] font-normal tracking-normal text-[var(--s-muted)]">
                        per maand
                      </span>
                    </p>
                  ) : (
                    <p className="mt-1 text-[15px] text-[#d4d4d8]">
                      {shown.known
                        ? "Nog te weinig signalen voor een eerlijke schatting."
                        : "Kennen we nog niet. Met een gratis account halen we hem binnen een minuut op."}
                    </p>
                  )}
                  {error && <p className="mt-1 text-[14px] text-[var(--s-yellow)]">{error}</p>}
                </div>
                {shown.known && band && (
                  <div className="hidden text-right text-[13px] text-[var(--s-muted)] sm:block">
                    <p>{shown.active_ads ?? 0} actieve ads</p>
                    <p>schatting, geen feit</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="s-rise-4 mt-8 flex flex-wrap gap-3">
            <Link href="/login?mode=signup" className="s-btn">
              Begin gratis
              <ArrowRight className="s-arrow size-4" aria-hidden />
            </Link>
            <Link href="/schattingen" className="s-btn-ghost">
              Hoe we schatten
            </Link>
          </div>
          <p className="mt-8 text-[14px] text-[var(--s-faint)]">
            Data uit de officiële Meta Ad Library, openbare Shopify-gegevens en echte nieuwsbrieven.
          </p>
        </div>

        {/* Twee kolommen met echte schermen die langzaam langs schuiven. */}
        <div
          className="s-marquee-wrap s-fade-y relative hidden h-[640px] grid-cols-2 gap-4 overflow-hidden lg:grid"
          aria-hidden
        >
          {[left, right].map((col, i) => (
            <div key={i} className={i === 0 ? "s-marquee" : "s-marquee-rev"}>
              <div className="space-y-4 pb-4">
                {[...col, ...col].map(([src, label, alt], j) => (
                  <ScreenCard key={`${src}-${j}`} src={src} label={label} alt={alt} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="lg:hidden">
          <ScreenCard
            src="shop-detail"
            label="Shop-detail"
            alt="Shoppagina met geschatte omzet, groei en grafieken"
          />
        </div>
      </div>
    </section>
  );
}
