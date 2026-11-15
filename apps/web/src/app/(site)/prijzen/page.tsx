import type { Metadata } from "next";
import { PricingTable } from "@/components/site/pricing-table";
import { FAQ } from "@/lib/site/faq";

export const metadata: Metadata = {
  title: "Prijzen",
  description:
    "Gratis beginnen, Starter, Pro of Agency. Per maand, kwartaal (15% korting) of jaar (30% korting). Pro 7 dagen gratis proberen.",
  alternates: { canonical: "/prijzen" },
};

const BILLING_QUESTIONS = FAQ.filter(([q]) =>
  /plan|betal|opzeg|prijs|btw|proef|gratis|api/i.test(q),
);

export default function PricingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: BILLING_QUESTIONS.map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PricingTable headingLevel={1} />
      {BILLING_QUESTIONS.length > 0 && (
        <section
          aria-labelledby="pq-title"
          className="bg-[var(--s-surface)] py-[clamp(72px,8vw,120px)]"
        >
          <div className="s-wrap grid gap-8 md:grid-cols-[var(--s-axis)_1fr]">
            <h2 id="pq-title" style={{ fontSize: "clamp(1.75rem, 1.2rem + 1.6vw, 2.25rem)" }}>
              Over betalen
            </h2>
            <dl className="max-w-[62ch] space-y-6">
              {BILLING_QUESTIONS.map(([q, a]) => (
                <div key={q}>
                  <dt className="font-semibold">{q}</dt>
                  <dd className="mt-1">{a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}
    </>
  );
}
