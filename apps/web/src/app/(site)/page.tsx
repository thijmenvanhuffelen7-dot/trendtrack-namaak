import { PLANS } from "@trendtrack/core";
import { getShopByDomain, listAds, type Db } from "@trendtrack/db";
import { AdFiltersSchema, parseFilters } from "@trendtrack/core";
import type { Metadata } from "next";
import { ArrowRight, Check, Minus } from "lucide-react";
import Link from "next/link";
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

      <section aria-labelledby="tools-title" className="s-section border-t border-white/[0.06]">
        <div className="s-wrap">
          <div data-reveal className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h2 id="tools-title" style={{ fontSize: "var(--step-head)" }}>
                Gratis tools, <span className="s-accent-text">geen account.</span>
              </h2>
              <p className="mt-4 max-w-xl text-[var(--step-lead)] text-[#c4c4cc]">
                Herken het thema en de apps van een Shopify-store, exporteer producten of reken je
                break-even ROAS uit.
              </p>
            </div>
            <Link
              href="/tools"
              className="inline-flex items-center gap-2 text-[15px] text-[var(--s-ink)] hover:text-[#5fe3c5]"
            >
              Alle {TOOLS.length} tools <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TOOLS.slice(0, 4).map((t) => (
              <li key={t.slug} className="s-frame s-lift">
                <Link href={`/tools/${t.slug}`} className="s-card group flex h-full flex-col p-2">
                  <ToolArt kind={t.kind} className="h-36" />
                  <div className="flex flex-1 flex-col px-3 pt-4 pb-3">
                    <h3 className="text-[20px]">{t.title}</h3>
                    <p className="mt-2 flex-1 text-[14px] leading-relaxed text-[var(--s-muted)]">
                      {t.description}
                    </p>
                    <p className="mt-4 text-[13px] text-[var(--s-faint)] group-hover:text-[#5fe3c5]">
                      Gratis, zonder account
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="mcp"
        aria-labelledby="mcp-title"
        className="s-section s-glow relative border-t border-white/[0.06]"
      >
        <div className="s-wrap grid items-center gap-14 lg:grid-cols-2">
          <div data-reveal>
            <h2 id="mcp-title" style={{ fontSize: "var(--step-head)" }}>
              Vraag het gewoon <span className="s-accent-text">aan Claude.</span>
            </h2>
            <p className="mt-5 max-w-xl text-[var(--step-lead)] leading-relaxed text-[#c4c4cc]">
              Koppel TrendTrack als connector in Claude of ChatGPT en stel je vragen in gewone taal.
              De assistent zoekt zelf in de shops, ads en nieuwsbrieven. Liever zelf bouwen? Er is
              ook een REST API.
            </p>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6">
              {[
                ["12", "tools voor AI"],
                ["OAuth", "veilig inloggen"],
                ["Pro", "en Agency"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="sr-only">{l}</dt>
                  <dd className="font-[family-name:var(--font-display)] text-[28px] leading-none font-bold tracking-[-0.03em]">
                    {v}
                  </dd>
                  <dd className="mt-2 text-[14px] text-[var(--s-muted)]">{l}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-8 flex flex-wrap gap-2">
              {["Claude", "ChatGPT", "Cursor", "Eigen scripts via de API"].map((c) => (
                <li
                  key={c}
                  className="rounded-full border border-[var(--s-line-2)] bg-white/[0.03] px-3 py-1 text-[14px] text-[#d4d4d8]"
                >
                  {c}
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/login?next=/app/mcp" className="s-btn">
                Koppel de MCP-server
                <ArrowRight className="s-arrow size-4" aria-hidden />
              </Link>
              <Link href="/docs/api" className="s-btn-ghost">
                API-documentatie
              </Link>
            </div>
          </div>

          <div data-reveal className="s-frame">
            <p className="s-label px-3 pt-2 pb-2.5">Gesprek in Claude</p>
            <div className="s-card space-y-4 p-6 text-[15px]">
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-white/[0.07] px-4 py-2.5">
                Hoeveel omzet doet {estimate.domain} ongeveer, en welke ad loopt het langst?
              </p>
              <p className="w-fit rounded-lg border border-[var(--s-line)] bg-black/40 px-3 py-1.5 font-mono text-[12px] text-[#5fe3c5]">
                trendtrack · get_shop · search_ads
              </p>
              <div className="max-w-[92%] space-y-2 text-[#d4d4d8]">
                <p>
                  <strong className="text-[var(--s-ink)]">
                    {estimate.name ?? estimate.domain}
                  </strong>{" "}
                  doet naar schatting{" "}
                  <strong className="text-[var(--s-ink)]">
                    {estimate.monthly_revenue
                      ? `€ ${compact(estimate.monthly_revenue.low)} – € ${compact(estimate.monthly_revenue.high)}`
                      : "nog onbekend"}
                  </strong>{" "}
                  per maand. Dat is een bandbreedte, geen exact getal.
                </p>
                <p>
                  De langst lopende ad is “{ad.title}”: {ad.days} dagen live, {ad.reach} bereik in
                  de EU en een geschatte spend van {ad.spend}.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="compare-title" className="s-section border-t border-white/[0.06]">
        <div className="s-wrap" data-reveal>
          <h2 id="compare-title" style={{ fontSize: "var(--step-head)" }}>
            Wat je ziet, <span className="s-accent-text">zonder zoekwerk.</span>
          </h2>
          <div className="s-frame mt-12">
            <div className="s-card overflow-hidden">
              <table className="w-full text-left text-[15px]">
                <caption className="sr-only">TrendTrack vergeleken met zelf uitzoeken</caption>
                <thead>
                  <tr className="border-b border-[var(--s-line)] text-[14px]">
                    <th scope="col" className="px-6 py-4 font-normal text-[var(--s-muted)]">
                      <span className="sr-only">Onderdeel</span>
                    </th>
                    <th scope="col" className="px-6 py-4 font-medium text-[#5fe3c5]">
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
                          <Check className="mt-0.5 size-4 shrink-0 text-[#5fe3c5]" aria-hidden />
                          {us}
                        </span>
                      </td>
                      <td className="hidden px-6 py-4 text-[var(--s-faint)] md:table-cell">
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
        </div>
      </section>

      <PricingTable />

      <section aria-labelledby="faq-title" className="s-section border-t border-white/[0.06]">
        <div className="s-wrap grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <div data-reveal>
            <h2 id="faq-title" style={{ fontSize: "var(--step-head)" }}>
              Eerlijke <span className="s-accent-text">antwoorden.</span>
            </h2>
            <p className="mt-4 max-w-sm text-[var(--step-lead)] text-[#c4c4cc]">
              Staat je vraag er niet bij? Mail{" "}
              <a href={`mailto:${SITE.email}`} className="s-link text-[var(--s-ink)]">
                {SITE.email}
              </a>
              .
            </p>
          </div>
          <div className="s-frame">
            <div className="s-card divide-y divide-[var(--s-line)]">
              {FAQ.map(([q, a]) => (
                <details
                  key={q}
                  className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-medium">
                    {q}
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-[var(--s-line-2)] text-[var(--s-muted)] transition-transform duration-200 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-[15px] leading-relaxed text-[var(--s-muted)]">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="cta-title"
        className="s-section s-glow relative border-t border-white/[0.06]"
      >
        <div className="s-wrap" data-reveal>
          <h2 id="cta-title" className="max-w-4xl" style={{ fontSize: "var(--step-display)" }}>
            Zie wie er groeit. <span className="s-accent-text">Vandaag nog.</span>
          </h2>
          <p className="mt-5 max-w-xl text-[var(--step-lead)] text-[#c4c4cc]">
            Zeven dagen alles van Pro, zonder creditcard. Daarna gratis door, of kies een plan.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/login?mode=signup" className="s-btn">
              Maak een gratis account
              <ArrowRight className="s-arrow size-4" aria-hidden />
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
