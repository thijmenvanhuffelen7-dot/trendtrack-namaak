import type { Metadata } from "next";
import Link from "next/link";
import { TOOLS } from "@/lib/site/tools";

export const metadata: Metadata = {
  title: "Gratis tools voor webshops",
  description:
    "Gratis tools: Shopify-thema en apps herkennen, producten exporteren, winnende ads vinden en je ROAS, marge en klantwaarde berekenen.",
  alternates: { canonical: "/tools" },
};

export default function ToolsIndex() {
  return (
    <div className="s-wrap pt-10 pb-[clamp(72px,8vw,120px)]">
      <div className="grid gap-8 md:grid-cols-[var(--s-axis)_1fr]">
        <p className="max-w-[28ch] text-[var(--step-lead)] leading-[1.35] md:order-1 md:pt-4">
          Zonder account te gebruiken. Wil je meer, dan kan dat met het gratis plan.
        </p>
        <h1
          className="md:order-2"
          style={{ fontSize: "clamp(3rem, 8vw, 7.5rem)", lineHeight: 0.9 }}
        >
          Gratis tools
        </h1>
      </div>
      <ul className="mt-16">
        {TOOLS.map((t, i) => (
          <li key={t.slug} className={i % 2 === 0 ? "bg-[var(--s-surface)]" : ""}>
            <Link
              href={`/tools/${t.slug}`}
              className="group grid gap-2 px-5 py-6 md:grid-cols-[var(--s-axis)_1fr] md:items-baseline"
            >
              <h2 className="text-[clamp(1.5rem,2.6vw,2.4rem)] transition-transform duration-200 group-hover:translate-x-1">
                {t.h1}
              </h2>
              <p className="max-w-2xl text-[var(--s-muted)] transition-colors group-hover:text-[var(--s-ink)]">
                {t.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
