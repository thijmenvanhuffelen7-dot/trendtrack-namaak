import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, PageTitle } from "@/components/site/prose";
import { ToolArt } from "@/components/site/tool-art";
import { TOOLS } from "@/lib/site/tools";

export const metadata: Metadata = {
  title: "Gratis tools voor webshops",
  description:
    "Gratis tools: Shopify-thema en apps herkennen, producten exporteren, winnende ads vinden en je ROAS, marge en klantwaarde berekenen.",
  alternates: { canonical: "/tools" },
};

export default function ToolsIndex() {
  return (
    <PageShell>
      <PageTitle
        title="Gratis tools"
        lead="Zonder account te gebruiken. Wil je meer shops, alle ads of de nieuwsbrieven, dan kan dat met het gratis plan."
      />
      <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => (
          <li key={t.slug} className="s-frame s-lift">
            <Link href={`/tools/${t.slug}`} className="s-card group flex h-full flex-col p-2">
              <ToolArt kind={t.kind} />
              <div className="flex flex-1 flex-col px-3 pt-4 pb-3">
                <h2 className="text-[22px]">{t.h1}</h2>
                <p className="mt-2 flex-1 text-[15px] leading-relaxed text-[var(--s-muted)]">
                  {t.description}
                </p>
                <p className="mt-4 text-[14px] text-[var(--s-faint)] transition-colors group-hover:text-[var(--s-accent-soft)]">
                  Gratis, zonder account →
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
