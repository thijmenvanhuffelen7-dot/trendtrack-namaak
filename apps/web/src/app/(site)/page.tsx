import { PLANS } from "@trendtrack/core";
import { getShopByDomain, listAds, type Db } from "@trendtrack/db";
import { AdFiltersSchema, parseFilters } from "@trendtrack/core";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Hero, type Estimate } from "@/components/site/hero-search";
import { PricingTable } from "@/components/site/pricing-table";
import { Showcase, type ShowcaseAd } from "@/components/site/showcase";
import { serviceDb } from "@/lib/server/db";
import { FAQ } from "@/lib/site/faq";
import { SITE } from "@/lib/site/config";

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

const STAGES = [
  {
    time: "Twee minuten",
    text: "Eerst maak je een gratis account, zonder creditcard.",
    grow: 1,
    color: "var(--s-yellow)",
    ink: "#111",
  },
  {
    time: "Binnen een minuut",
    text: "Dan zoek je een webshop op; kennen we hem niet, dan halen we hem op.",
    grow: 1,
    color: "var(--s-blue)",
    ink: "#fff",
  },
  {
    time: "Na drie dagen",
    text: "Daarna volgt de eerste omzetschatting uit dagelijkse metingen.",
    grow: 3,
    color: "var(--s-accent)",
    ink: "#fff",
  },
  {
    time: "Na een week",
    text: "Ten slotte zie je de groei: meer ads, nieuwe producten, stijgende omzet.",
    grow: 6,
    color: "var(--s-red)",
    ink: "#fff",
  },
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

      <Showcase ad={ad} />

      <section
        aria-labelledby="compare-title"
        className="bg-[var(--s-surface)] py-[clamp(72px,8vw,120px)]"
      >
        <div className="s-wrap" data-reveal>
          <h2 id="compare-title" className="mb-12" style={{ fontSize: "var(--step-head)" }}>
            Wat je ziet
          </h2>
          <div
            className="hidden md:block"
            role="table"
            aria-label="TrendTrack vergeleken met zelf uitzoeken"
          >
            <div role="row" className="grid grid-cols-12 text-[17px] font-semibold">
              <span role="columnheader" className="col-span-5 py-4" />
              <span role="columnheader" className="col-span-4 bg-[var(--s-accent)] px-5 pt-6 pb-4">
                TrendTrack
              </span>
              <span role="columnheader" className="col-span-3 px-5 pt-6 pb-4 text-[var(--s-muted)]">
                Zelf uitzoeken
              </span>
            </div>
            {COMPARE.map(([cap, us, them], i) => (
              <div
                role="row"
                key={cap}
                className={`grid min-h-[68px] grid-cols-12 items-center ${i % 2 === 0 ? "bg-[var(--s-bg)]" : ""}`}
              >
                <span
                  role="rowheader"
                  className="col-span-5 px-5 text-[clamp(1.1rem,1.6vw,1.5rem)] font-medium"
                >
                  {cap}
                </span>
                <span
                  role="cell"
                  className="col-span-4 flex h-full items-center bg-[var(--s-accent)] px-5 text-[17px]"
                >
                  {us}
                </span>
                <span role="cell" className="col-span-3 px-5 text-[17px] text-[var(--s-muted)]">
                  {them}
                </span>
              </div>
            ))}
          </div>
          <dl className="space-y-3 md:hidden">
            {COMPARE.map(([cap, us, them], i) => (
              <div key={cap} className={`p-4 ${i % 2 === 0 ? "bg-[var(--s-bg)]" : ""}`}>
                <dt className="text-xl font-semibold">{cap}</dt>
                <dd className="mt-2 bg-[var(--s-accent)] px-3 py-2 text-[16px]">
                  TrendTrack: {us}
                </dd>
                <dd className="mt-1 px-3 text-[16px] text-[var(--s-muted)]">Zelf: {them}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section aria-labelledby="how-title" className="s-wrap py-[clamp(72px,8vw,120px)]">
        <div data-reveal>
          <h2 id="how-title" className="mb-16" style={{ fontSize: "clamp(2.6rem, 6.4vw, 6.5rem)" }}>
            Van domein naar trend
          </h2>
          <div data-ui className="flex flex-col gap-1.5 md:h-[22vh] md:min-h-[180px] md:flex-row">
            {STAGES.map((s) => (
              <div
                key={s.time}
                className="min-h-[72px] p-5 md:min-w-[12%]"
                style={{ flexGrow: s.grow, flexBasis: 0, background: s.color, color: s.ink }}
              >
                <p className="text-[clamp(1.25rem,2vw,1.9rem)] leading-tight font-semibold tracking-[-0.03em]">
                  {s.time}
                </p>
              </div>
            ))}
          </div>
          <ol className="mt-5 grid gap-4 md:flex md:gap-1.5">
            {STAGES.map((s) => (
              <li
                key={s.time}
                className="text-[17px] md:max-w-[22ch] md:min-w-[12%]"
                style={{ flexGrow: s.grow, flexBasis: 0 }}
              >
                {s.text}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <PricingTable />

      <section
        aria-labelledby="faq-title"
        className="bg-[var(--s-surface)] py-[clamp(72px,8vw,120px)]"
      >
        <div className="s-wrap grid gap-10 md:grid-cols-12" data-reveal>
          <h2
            id="faq-title"
            className="md:col-span-3"
            style={{ fontSize: "clamp(1.75rem, 1.2rem + 1.6vw, 2.25rem)" }}
          >
            Eerlijke antwoorden
          </h2>
          <div className="md:col-span-8 md:col-start-5 md:columns-2 md:gap-14">
            {FAQ.map(([q, a]) => (
              <p key={q} className="mb-5 break-inside-avoid text-[17px] leading-[1.55]">
                <strong className="font-medium">{q}</strong>{" "}
                <span className="text-[#d4d4d4]">{a}</span>
              </p>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="cta-title">
        <div className="grid grid-cols-2 md:grid-cols-3">
          {[
            ["ads", "Ads van een shop, gesorteerd op looptijd, in het dashboard"],
            ["brandtracker", "De Brandtracker met veranderingen per dag"],
            ["emails", "De e-mail library met welkomstmails en campagnes"],
          ].map(([src, alt], i) => (
            <div
              key={src}
              className={`relative h-[40svh] min-h-[220px] overflow-hidden ${i === 0 ? "col-span-2 md:col-span-1" : ""}`}
            >
              <Image
                src={`/screens/${src}.webp`}
                alt={alt}
                fill
                sizes="(min-width: 768px) 33vw, 50vw"
                className="object-cover object-left-top"
              />
            </div>
          ))}
        </div>
        <div className="bg-[var(--s-blue)] py-16 md:min-h-[44svh]">
          <div className="s-wrap" data-reveal>
            <h2
              id="cta-title"
              className="max-w-[28ch] text-[clamp(1.4rem,2.2vw,1.9rem)] leading-[1.25] font-medium tracking-[-0.02em]"
            >
              Zoek je eerste concurrent op en{" "}
              <Link
                href="/login"
                className="underline decoration-4 underline-offset-[6px] transition-opacity hover:opacity-85"
              >
                maak een gratis account
              </Link>{" "}
              in twee minuten.
            </h2>
            <p className="mt-8 max-w-xl text-[16px]">
              Zeven dagen alles van Pro, zonder creditcard. Daarna gratis door, of kies een plan.
            </p>
            <p className="text-[16px]">
              Liever eerst iets proberen?{" "}
              <Link href="/tools" className="s-link">
                Bekijk de gratis tools
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
