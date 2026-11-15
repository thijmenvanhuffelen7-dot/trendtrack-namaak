import { PLANS } from "@trendtrack/core";
import { getShopByDomain, listAds, type Db } from "@trendtrack/db";
import { AdFiltersSchema, parseFilters } from "@trendtrack/core";
import type { Metadata } from "next";
import { ArrowRight, Check, Minus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { LogoMark } from "@/components/site/logo";
import { NumberedSteps } from "@/components/site/numbered-steps";
import { FeatureTabs } from "@/components/site/feature-tabs";
import { Hero, type Estimate } from "@/components/site/hero-search";
import { PricingTable } from "@/components/site/pricing-table";
import { Showcase, type ShowcaseAd } from "@/components/site/showcase";
import { ToolArt } from "@/components/site/tool-art";
import { serviceDb } from "@/lib/server/db";
import { FAQ } from "@/lib/site/faq";
import { SITE } from "@/lib/site/config";
import { TOOLS } from "@/lib/site/tools";

export const metadata: Metadata = { alternates: { canonical: "/" } };
// Elk uur opnieuw, met echte cijfers uit de database.
export const revalidate = 3600;

const compact = (n: number) =>
  new Intl.NumberFormat("nl-NL", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/** Echte voorbeelddata; valt terug op vaste waarden als de database bij het bouwen niet bereikbaar is. */
async function sample(): Promise<{ estimate: Estimate; ad: ShowcaseAd }> {
  const fallback = {
    estimate: {
      domain: "zilverzand.nl",
      known: true,
      name: "Zilverzand Sieraden",
      active_ads: 3,
      monthly_revenue: { low: 18000, mid: 26000, high: 37000, confidence: 0.45 },
    },
    ad: {
      advertiser: "Zilverzand Sieraden",
      domain: "zilverzand.nl",
      title: "Schakelketting zilver",
      body: "Gratis verzending op alle zilveren kettingen! Bestel nu.",
      days: 64,
      reach: "412K",
      spend: "€ 2,5K – € 4,9K",
    },
  };
  try {
    const db: Db = serviceDb();
    const s = await getShopByDomain(db, "zilverzand.nl");
    const ads = await listAds(
      db,
      parseFilters(AdFiltersSchema, {
        active: "true",
        sort: "longest",
        per_page: "1",
        domain: "zilverzand.nl",
      }),
    );
    const a = ads.rows[0];
    if (!s || !a) return fallback;
    const days = a.started_at
      ? Math.floor((Date.now() - Date.parse(a.started_at)) / 86_400_000)
      : 0;
    return {
      estimate: {
        domain: s.domain,
        known: true,
        name: s.name,
        active_ads: s.active_ads_count,
        monthly_revenue:
          s.est_monthly_revenue_low !== null
            ? {
                low: Number(s.est_monthly_revenue_low),
                mid: Number(s.est_monthly_revenue),
                high: Number(s.est_monthly_revenue_high),
                confidence: s.est_confidence,
              }
            : null,
      },
      ad: {
        advertiser: a.advertisers?.page_name ?? s.name ?? s.domain,
        domain: s.domain,
        title: a.title ?? "",
        body: a.body ?? "",
        days,
        reach: compact(Number(a.eu_total_reach ?? 0)),
        spend:
          a.est_spend_low !== null
            ? `€ ${compact(Number(a.est_spend_low))} – € ${compact(Number(a.est_spend_high))}`
            : "–",
      },
    };
  } catch {
    return fallback;
  }
}

const COMPARE: [string, string, string][] = [
  ["Geschatte omzet per maand", "Bandbreedte met betrouwbaarheid", "Niet te zien"],
  ["Ads die in NL en BE lopen", "Alle, met looptijd en bereik", "Per merk zoeken in de Ad Library"],
  ["Wat een ad kost", "Geschat uit bereik en CPM", "Niet te zien"],
  ["Thema en apps", "Automatisch herkend", "Broncode lezen"],
  ["Nieuwe producten en prijzen", "Elke dag bijgehouden", "Zelf terugkomen en vergelijken"],
  ["Nieuwsbrieven", "Welkomstmails, flows en campagnes", "Zelf inschrijven en bewaren"],
  ["Concurrenten volgen", "Brandtracker met dagelijkse feed", "Een spreadsheet bijhouden"],
  ["Vragen in Claude of ChatGPT", "Via onze MCP-server", "Niet mogelijk"],
];

export default async function Home() {
  const { estimate, ad } = await sample();
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "TrendTrack",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE.url,
      offers: (["free", "starter", "pro", "agency"] as const).map((id) => ({
        "@type": "Offer",
        name: PLANS[id].name,
        price: PLANS[id].monthlyEur,
        priceCurrency: "EUR",
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero initial={estimate} />

      <FeatureTabs />

      <Showcase ad={ad} />

      <section aria-labelledby="why-title" className="s-section pt-0">
        <div className="s-wrap grid items-center gap-14 lg:grid-cols-2">
          <div data-reveal>
            <span className="s-eyebrow">Waarom TrendTrack</span>
            <h2 id="why-title" className="mt-5" style={{ fontSize: "var(--step-head)" }}>
              Van gissen naar weten
            </h2>
            <p className="mt-4 max-w-md text-[var(--step-lead)] text-[var(--s-body)]">
              Geen spreadsheets en losse tabbladen meer. Alles wat een concurrent zichtbaar doet, op
              één plek en elke dag bijgewerkt.
            </p>
            <div className="mt-10">
              <NumberedSteps
                steps={[
                  {
                    title: "Omzet als bandbreedte",
                    accent: "nooit één nep-getal",
                    text: "Uit voorraad, reviews en advertentiebereik, met een betrouwbaarheid erbij.",
                  },
                  {
                    title: "Ads met wat ze kosten",
                    text: "Elke ad uit de officiële Meta Ad Library, met looptijd, bereik en geschatte spend.",
                  },
                  {
                    title: "Nieuwsbrieven en flows",
                    text: "Welkomstmails, campagnes en kortingsacties van shops, zonder zelf in te schrijven.",
                  },
                  {
                    title: "Volgen wat verandert",
                    text: "De Brandtracker meldt nieuwe ads, producten en prijswijzigingen van je concurrenten.",
                  },
                ]}
              />
            </div>
          </div>
          <div data-reveal className="relative">
            <div className="s-card overflow-hidden p-2">
              <Image
                src="/screens/brandtracker.webp"
                alt="De Brandtracker met veranderingen per dag bij gevolgde shops"
                width={1056}
                height={800}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="block h-auto w-full rounded-[18px]"
              />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="tools-title" className="s-section pt-0">
        <div className="s-wrap">
          <div data-reveal className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="s-eyebrow">Gratis tools</span>
              <h2 id="tools-title" className="mt-5" style={{ fontSize: "var(--step-head)" }}>
                Probeer het zonder account
              </h2>
              <p className="mt-4 max-w-xl text-[var(--step-lead)] text-[var(--s-body)]">
                Herken het thema en de apps van een Shopify-store, exporteer producten of reken je
                break-even ROAS uit.
              </p>
            </div>
            <Link href="/tools" className="s-btn-ghost">
              <span className="s-btn-icon">
                <ArrowRight className="size-4" aria-hidden />
              </span>
              Alle {TOOLS.length} tools
            </Link>
          </div>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TOOLS.slice(0, 4).map((t) => (
              <li key={t.slug} className="s-card s-lift p-2">
                <Link href={`/tools/${t.slug}`} className="group flex h-full flex-col">
                  <ToolArt kind={t.kind} className="h-36" />
                  <div className="flex flex-1 flex-col px-3 pt-4 pb-3">
                    <h3 className="text-[19px]">{t.title}</h3>
                    <p className="mt-2 flex-1 text-[14px] leading-relaxed text-[var(--s-muted)]">
                      {t.description}
                    </p>
                    <p className="mt-4 text-[13px] font-medium text-[var(--s-accent-soft)]">
                      Gratis, zonder account →
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="mcp" aria-labelledby="mcp-title" className="s-inset s-dark">
        <div className="s-wrap grid items-center gap-14 py-[clamp(64px,7vw,112px)] lg:grid-cols-2">
          <div data-reveal>
            <span className="s-eyebrow">AI-koppeling</span>
            <h2 id="mcp-title" className="mt-5" style={{ fontSize: "var(--step-head)" }}>
              Vraag het gewoon <span className="s-accent-text">aan Claude.</span>
            </h2>
            <p className="mt-5 max-w-xl text-[var(--step-lead)] leading-relaxed text-[var(--s-body)]">
              Koppel TrendTrack als connector in Claude of ChatGPT en stel je vragen in gewone taal.
              De assistent zoekt zelf in de shops, ads en nieuwsbrieven. Liever zelf bouwen? Er is
              ook een REST API.
            </p>
            <ul className="mt-8 flex flex-wrap gap-2">
              {["12 tools voor AI", "Veilig inloggen (OAuth)", "Claude", "ChatGPT", "Cursor"].map(
                (c) => (
                  <li key={c} className="s-chip">
                    {c}
                  </li>
                ),
              )}
            </ul>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/login?next=/app/mcp" className="s-btn">
                <span className="s-btn-icon">
                  <ArrowRight className="size-4" aria-hidden />
                </span>
                Koppel de MCP-server
              </Link>
              <Link href="/docs/api" className="s-btn-ghost">
                API-documentatie
              </Link>
            </div>
          </div>

          <div data-reveal className="s-card space-y-4 p-6 text-[15px]">
            <p className="s-label">Gesprek in Claude</p>
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[var(--s-tint-2)] px-4 py-2.5">
              Hoeveel omzet doet {estimate.domain} ongeveer, en welke ad loopt het langst?
            </p>
            <p className="w-fit rounded-lg border border-[var(--s-line)] bg-[var(--s-tint)] px-3 py-1.5 font-mono text-[12px] text-[var(--s-accent-soft)]">
              trendtrack · get_shop · search_ads
            </p>
            <div className="max-w-[92%] space-y-2 text-[var(--s-body)]">
              <p>
                <strong className="text-[var(--s-ink)]">{estimate.name ?? estimate.domain}</strong>{" "}
                doet naar schatting{" "}
                <strong className="text-[var(--s-ink)]">
                  {estimate.monthly_revenue
                    ? `€ ${compact(estimate.monthly_revenue.low)} – € ${compact(estimate.monthly_revenue.high)}`
                    : "nog onbekend"}
                </strong>{" "}
                per maand. Dat is een bandbreedte, geen exact getal.
              </p>
              <p>
                De langst lopende ad is “{ad.title}”: {ad.days} dagen live, {ad.reach} bereik in de
                EU en een geschatte spend van {ad.spend}.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="compare-title" className="s-section">
        <div className="s-wrap" data-reveal>
          <div className="text-center">
            <span className="s-eyebrow">Vergelijking</span>
            <h2
              id="compare-title"
              className="mx-auto mt-5 max-w-2xl"
              style={{ fontSize: "var(--step-head)" }}
            >
              Wat je ziet, zonder zoekwerk
            </h2>
          </div>
          <div className="s-card mt-12 overflow-hidden">
            <table className="w-full text-left text-[15px]">
              <caption className="sr-only">TrendTrack vergeleken met zelf uitzoeken</caption>
              <thead>
                <tr className="border-b border-[var(--s-line)] bg-[var(--s-surface-2)] text-[14px]">
                  <th scope="col" className="px-6 py-4 font-normal text-[var(--s-muted)]">
                    <span className="sr-only">Onderdeel</span>
                  </th>
                  <th scope="col" className="px-6 py-4 font-semibold text-[var(--s-accent)]">
                    TrendTrack
                  </th>
                  <th
                    scope="col"
                    className="hidden px-6 py-4 font-normal text-[var(--s-muted)] md:table-cell"
                  >
                    Zelf uitzoeken
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([cap, us, them]) => (
                  <tr key={cap} className="border-b border-[var(--s-line)] last:border-0">
                    <th scope="row" className="px-6 py-4 font-medium">
                      {cap}
                    </th>
                    <td className="px-6 py-4">
                      <span className="flex items-start gap-2">
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-[var(--s-accent)]"
                          aria-hidden
                        />
                        {us}
                      </span>
                    </td>
                    <td className="hidden px-6 py-4 text-[var(--s-muted)] md:table-cell">
                      <span className="flex items-start gap-2">
                        <Minus className="mt-0.5 size-4 shrink-0" aria-hidden />
                        {them}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <PricingTable />

      <section aria-labelledby="faq-title" className="s-section pt-0">
        <div className="s-wrap grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <div data-reveal>
            <span className="s-eyebrow">Vragen</span>
            <h2 id="faq-title" className="mt-5" style={{ fontSize: "var(--step-head)" }}>
              Antwoorden op veelgestelde vragen
            </h2>
            <div className="s-card mt-8 p-6">
              <p className="text-[18px] font-semibold">Staat je vraag er niet bij?</p>
              <a href={`mailto:${SITE.email}`} className="s-btn mt-4">
                <span className="s-btn-icon">
                  <ArrowRight className="size-4" aria-hidden />
                </span>
                Mail ons
              </a>
            </div>
          </div>
          <div className="space-y-3">
            {FAQ.map(([q, a]) => (
              <details
                key={q}
                className="group rounded-[20px] border border-[var(--s-line)] bg-[var(--s-surface)] [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[20px] px-5 py-4 text-[16px] font-medium transition-colors group-open:bg-[var(--s-ink)] group-open:text-[var(--s-bg)]">
                  {q}
                  <span className="grid size-8 shrink-0 place-items-center rounded-[10px] border border-[var(--s-line-2)] text-[18px] leading-none transition-transform duration-200 group-open:rotate-45 group-open:border-white/30">
                    +
                  </span>
                </summary>
                <p className="px-5 pt-4 pb-5 text-[15px] leading-relaxed text-[var(--s-body)]">
                  {a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="cta-title" className="s-inset s-dark s-grain">
        <div
          className="s-wrap flex flex-col items-center py-[clamp(72px,8vw,120px)] text-center"
          data-reveal
        >
          <span className="grid size-16 place-items-center rounded-[18px] border border-white/15 bg-black/30">
            <LogoMark className="size-9" />
          </span>
          <h2 id="cta-title" className="mt-8 max-w-3xl" style={{ fontSize: "var(--step-display)" }}>
            Zie wie er groeit. <span className="s-accent-text">Vandaag nog.</span>
          </h2>
          <p className="mt-5 max-w-xl text-[var(--step-lead)] text-[var(--s-body)]">
            Zeven dagen alles van Pro, zonder creditcard. Daarna gratis door, of kies een plan.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/login?mode=signup" className="s-btn">
              <span className="s-btn-icon">
                <ArrowRight className="size-4" aria-hidden />
              </span>
              Maak een gratis account
            </Link>
            <Link href="/tools" className="s-btn-ghost">
              Eerst de gratis tools
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
