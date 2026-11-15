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
      <section aria-labelledby="tool-title" className="s-wrap pt-10 pb-[clamp(72px,8vw,120px)]">
        <div className="grid gap-6 md:grid-cols-[var(--s-axis)_1fr]">
          <p className="order-2 text-[15px] md:order-none md:pt-3">
            <Link href="/tools" className="s-link text-[var(--s-muted)]">
              Gratis tools
            </Link>
          </p>
          <div>
            <h1
              id="tool-title"
              style={{ fontSize: "clamp(2.6rem, 6.4vw, 6rem)", lineHeight: 0.92 }}
            >
              {t.h1}
            </h1>
            <p className="mt-6 max-w-[48ch] text-[var(--step-lead)] leading-[1.35]">{t.intro}</p>
          </div>
        </div>
        <div className="mt-12">
          {t.kind === "theme" || t.kind === "apps" ? <DetectTool mode={t.kind} /> : null}
          {t.kind === "export" && <ExportTool />}
          {t.kind === "ads" && <AdsTool />}
          {t.kind === "roas" && <RoasCalculator />}
          {t.kind === "margin" && <MarginCalculator />}
          {t.kind === "clv" && <ClvCalculator />}
        </div>
      </section>

      <section
        aria-labelledby="how-title"
        className="bg-[var(--s-surface)] py-[clamp(72px,8vw,120px)]"
      >
        <div className="s-wrap grid gap-8 md:grid-cols-[var(--s-axis)_1fr]" data-reveal>
          <h2 id="how-title" style={{ fontSize: "clamp(1.75rem, 1.2rem + 1.6vw, 2.25rem)" }}>
            Zo werkt het
          </h2>
          <div className="max-w-[60ch] space-y-4">
            {t.how.map((h) => (
              <p key={h}>{h}</p>
            ))}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="more-title"
        className="bg-[var(--s-blue)] py-[clamp(72px,8vw,120px)]"
      >
        <div className="s-wrap grid gap-8 md:grid-cols-[var(--s-axis)_1fr]" data-reveal>
          <h2 id="more-title" style={{ fontSize: "clamp(1.75rem, 1.2rem + 1.6vw, 2.25rem)" }}>
            Meer dan één shop?
          </h2>
          <div>
            <p className="max-w-[44ch] text-[var(--step-lead)] leading-[1.35]">
              Met een gratis account zie je van elke webshop de geschatte omzet, de ads en de
              nieuwsbrieven.{" "}
              <Link href="/login" className="underline decoration-4 underline-offset-[6px]">
                Maak een gratis account
              </Link>
              .
            </p>
            <ul className="mt-8 space-y-1">
              {others.map((o) => (
                <li key={o.slug}>
                  <Link href={`/tools/${o.slug}`} className="s-link">
                    {o.h1}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <figure className="s-wrap mt-12 grid gap-8 md:grid-cols-[var(--s-axis)_1fr]" data-reveal>
          <figcaption className="text-[15px] md:order-2 md:col-start-1 md:row-start-1 md:self-end">
            {screen[1]}.
          </figcaption>
          <Image
            src={`/screens/${screen[0]}.webp`}
            alt={screen[1]}
            width={1056}
            height={800}
            sizes="(min-width: 768px) 60vw, 100vw"
            className="h-auto w-full max-w-[1056px] md:col-start-2"
          />
        </figure>
      </section>
    </>
  );
}
