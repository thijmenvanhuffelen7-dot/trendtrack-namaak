"use client";

import Image from "next/image";
import { useRef, useState } from "react";

const FEATURES = [
  {
    id: "omzet",
    tab: "Omzetschatting",
    title: "Omzet als bandbreedte, nooit als gok",
    text: "Uit dagelijkse metingen van voorraad, reviews en advertentiebereik. Met een betrouwbaarheid erbij, zodat je weet hoe hard het getal is.",
    screen: "shop-detail",
    alt: "Shoppagina met geschatte omzet per maand, groei en grafieken",
  },
  {
    id: "ads",
    tab: "Ads",
    title: "Elke ad die in Nederland en België loopt",
    text: "Uit de officiële Meta Ad Library, met looptijd, bereik en geschatte spend. Sorteer op wat het langst draait: dat werkt.",
    screen: "ads",
    alt: "Ads-overzicht met filters op land, looptijd en bereik",
  },
  {
    id: "mails",
    tab: "Nieuwsbrieven",
    title: "Welkomstmails, flows en campagnes",
    text: "We schrijven ons in op de nieuwsbrief van elke shop en bewaren wat binnenkomt. Persoonlijke links halen we eruit.",
    screen: "emails",
    alt: "E-mail library met welkomstmails en campagnes",
  },
  {
    id: "brandtracker",
    tab: "Brandtracker",
    title: "Weet het als een concurrent beweegt",
    text: "Nieuwe en gestopte ads, nieuwe producten en prijswijzigingen van de shops die je volgt, elke dag op één plek.",
    screen: "brandtracker",
    alt: "Brandtracker met veranderingen per dag",
  },
  {
    id: "producten",
    tab: "Producten",
    title: "Prijzen en voorraad, dag na dag",
    text: "Van elke Shopify-store: nieuwe producten, prijsverlagingen en wat uitverkoopt.",
    screen: "shop-products",
    alt: "Productlijst van een shop met prijzen en voorraad",
  },
  {
    id: "shops",
    tab: "Shops vinden",
    title: "Filter op niche, land, thema en apps",
    text: "Vind de snelst groeiende shops in jouw niche, of iedereen die Klaviyo en Judge.me gebruikt.",
    screen: "shops",
    alt: "Shoplijst met filters en geschatte omzet",
  },
];

/** Tabbalk met de onderdelen; de gekozen tab toont het echte scherm groot. Pijltjestoetsen werken. */
export function FeatureTabs() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const f = FEATURES[active]!;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = (active + (e.key === "ArrowRight" ? 1 : FEATURES.length - 1)) % FEATURES.length;
    setActive(next);
    refs.current[next]?.focus();
  };
  return (
    <section aria-labelledby="features-title" className="s-inset s-dark mt-4">
      <div className="s-wrap py-[clamp(64px,7vw,112px)]">
        <div className="mx-auto max-w-3xl text-center">
          <span className="s-eyebrow">Wat je krijgt</span>
          <h2 id="features-title" className="mt-5" style={{ fontSize: "var(--step-head)" }}>
            Eén dashboard voor omzet, ads en <span className="s-accent-text">nieuwsbrieven.</span>
          </h2>
        </div>
        <div
          role="tablist"
          aria-label="Onderdelen"
          onKeyDown={onKey}
          className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-1.5 rounded-[20px] border border-[var(--s-line)] bg-[var(--s-bg-2)] p-1.5 sm:grid-cols-3"
        >
          {FEATURES.map((x, i) => (
            <button
              key={x.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              id={`tab-${x.id}`}
              aria-selected={i === active}
              aria-controls={`panel-${x.id}`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              className={`rounded-[14px] px-3 py-2.5 text-[14px] font-medium transition-colors ${
                i === active
                  ? "bg-[#ecefed] text-[#0f1412]"
                  : "text-[var(--s-muted)] hover:bg-[var(--s-tint)] hover:text-[var(--s-ink)]"
              }`}
            >
              {x.tab}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`panel-${f.id}`}
          aria-labelledby={`tab-${f.id}`}
          className="mt-8 grid gap-8 md:grid-cols-[0.8fr_1.6fr] md:items-center"
        >
          <div key={f.id} className="s-card s-rise p-6">
            <h3 className="text-[clamp(1.4rem,2.2vw,1.9rem)]">{f.title}</h3>
            <p className="mt-3 text-[16px] leading-relaxed text-[var(--s-body)]">{f.text}</p>
          </div>
          <div className="overflow-hidden rounded-[22px] border border-white/15 bg-white shadow-[0_30px_80px_-30px_rgb(0_0_0/0.6)]">
            <Image
              key={f.screen}
              src={`/screens/${f.screen}.webp`}
              alt={f.alt}
              width={1056}
              height={800}
              sizes="(min-width: 768px) 60vw, 100vw"
              className="s-rise block h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
