import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdsTool } from "@/components/site/tools/ads-tool";
import {
  ClvCalculator,
  MarginCalculator,
  RoasCalculator,
} from "@/components/site/tools/calculators";
import { DetectTool } from "@/components/site/tools/detect-tool";
import { ExportTool } from "@/components/site/tools/export-tool";
import { SITE } from "@/lib/site/config";
import { TOOLS, toolBySlug } from "@/lib/site/tools";

// Welk dashboardscherm laat zien wat je met een account krijgt.
const SCREEN: Record<string, [string, string]> = {
  theme: ["shop-detail", "Shoppagina in het dashboard met thema, apps en geschatte omzet"],
  apps: ["shop-detail", "Shoppagina in het dashboard met thema, apps en geschatte omzet"],
  export: ["shop-products", "Productlijst van een shop met prijzen en voorraad per dag"],
  ads: ["ads", "Ads-overzicht met filters op land, looptijd en bereik"],
  roas: ["ads", "Ads-overzicht met filters op land, looptijd en bereik"],
  margin: ["shops", "Shoplijst met geschatte omzet per maand"],
  clv: ["emails", "Nieuwsbrieven van shops, met welkomstreeksen en campagnes"],
};

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const t = toolBySlug((await params).slug);
  if (!t) return {};
  return {
    title: `${t.title} (gratis)`,
    description: t.description,
    alternates: { canonical: `/tools/${t.slug}` },
  };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const t = toolBySlug((await params).slug);
  if (!t) notFound();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: t.title,
    url: `${SITE.url}/tools/${t.slug}`,
    description: t.description,
    applicationCategory: "BusinessApplication",
    offers: { "@type": "Offer", price: 0, priceCurrency: "EUR" },
  };
  const screen = SCREEN[t.kind]!;
  const others = TOOLS.filter((o) => o.slug !== t.slug).slice(0, 3);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="s-glow relative">
        <section
          aria-labelledby="tool-title"
          className="s-wrap pt-16 pb-[clamp(80px,9vw,120px)] md:pt-24"
        >
          <div className="max-w-4xl">
            <p className="s-rise mb-6 text-[14px]">
              <Link href="/tools" className="s-link text-[var(--s-muted)]">
                Gratis tools
              </Link>
            </p>
            <h1 id="tool-title" className="s-rise-2" style={{ fontSize: "var(--step-display)" }}>
              {t.h1}
            </h1>
            <p className="s-rise-3 mt-6 max-w-[42rem] text-[var(--step-lead)] leading-relaxed text-[#c4c4cc]">
              {t.intro}
            </p>
          </div>
          <div className="s-frame s-rise-4 mt-12">
            <div className="s-card p-5 md:p-8">
              {t.kind === "theme" || t.kind === "apps" ? <DetectTool mode={t.kind} /> : null}
              {t.kind === "export" && <ExportTool />}
              {t.kind === "ads" && <AdsTool />}
              {t.kind === "roas" && <RoasCalculator />}
              {t.kind === "margin" && <MarginCalculator />}
              {t.kind === "clv" && <ClvCalculator />}
            </div>
          </div>
        </section>
      </div>

      <section aria-labelledby="how-title" className="s-section border-t border-white/[0.06]">
        <div className="s-wrap grid gap-12 lg:grid-cols-[1fr_1.2fr]" data-reveal>
          <div>
            <h2 id="how-title" style={{ fontSize: "var(--step-head)" }}>
              Zo <span className="s-accent-text">werkt het.</span>
            </h2>
            <ol className="mt-8 space-y-5">
              {t.how.map((h, i) => (
                <li key={h} className="flex gap-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-[var(--s-line-2)] bg-white/[0.04] text-[14px] text-[#5fe3c5]">
                    {i + 1}
                  </span>
                  <p className="pt-1 text-[16px] leading-relaxed text-[#d4d4d8]">{h}</p>
                </li>
              ))}
            </ol>
          </div>
          <figure className="s-frame">
            <figcaption className="s-label px-3 pt-2 pb-2.5">{screen[1]}</figcaption>
            <div className="overflow-hidden rounded-[18px] border border-[var(--s-line)]">
              <Image
                src={`/screens/${screen[0]}.webp`}
                alt={screen[1]}
                width={1056}
                height={800}
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="block h-auto w-full"
              />
            </div>
          </figure>
        </div>
      </section>

      <section aria-labelledby="more-title" className="s-section pt-0">
        <div className="s-wrap">
          <div className="s-frame">
            <div
              className="s-card s-glow relative grid gap-8 overflow-hidden p-8 md:grid-cols-[1.2fr_1fr] md:p-12"
              data-reveal
            >
              <div>
                <h2 id="more-title" style={{ fontSize: "clamp(2rem, 1.4rem + 2vw, 3rem)" }}>
                  Meer dan <span className="s-accent-text">één shop?</span>
                </h2>
                <p className="mt-4 max-w-md text-[17px] text-[#c4c4cc]">
                  Met een gratis account zie je van elke webshop de geschatte omzet, de ads en de
                  nieuwsbrieven.
                </p>
                <Link href="/login" className="s-btn mt-8">
                  Maak een gratis account
                </Link>
              </div>
              <ul className="space-y-2 self-center">
                {others.map((o) => (
                  <li key={o.slug}>
                    <Link
                      href={`/tools/${o.slug}`}
                      className="flex items-center justify-between rounded-xl border border-[var(--s-line)] bg-white/[0.02] px-4 py-3 text-[15px] transition-colors hover:border-white/20 hover:bg-white/[0.05]"
                    >
                      {o.h1}
                      <span className="text-[var(--s-faint)]">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
