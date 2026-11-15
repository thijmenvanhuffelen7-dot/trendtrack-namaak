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
    <section aria-labelledby="features-title" className="s-section pt-0">
      <div className="s-wrap">
        <h2 id="features-title" className="sr-only">
          Wat er in TrendTrack zit
        </h2>
        <div className="s-frame">
          <div
            role="tablist"
            aria-label="Onderdelen"
            onKeyDown={onKey}
            className="s-fade-x-sm flex gap-1 overflow-x-auto rounded-[19px] border border-[var(--s-line)] bg-[var(--s-bg-2)] p-1.5"
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
                className={`shrink-0 rounded-[14px] px-4 py-2.5 text-[15px] transition-colors ${
                  i === active
                    ? "bg-white/[0.08] text-[var(--s-ink)] shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
                    : "text-[var(--s-muted)] hover:text-[var(--s-ink)]"
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
            className="grid gap-8 p-5 md:grid-cols-[0.8fr_1.6fr] md:items-center md:p-8"
          >
            <div key={f.id} className="s-rise">
              <h3 className="text-[clamp(1.6rem,2.4vw,2.2rem)]">{f.title}</h3>
              <p className="mt-4 text-[17px] leading-relaxed text-[#c4c4cc]">{f.text}</p>
            </div>
            <div className="overflow-hidden rounded-[18px] border border-[var(--s-line)] bg-white">
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
      </div>
    </section>
  );
}
