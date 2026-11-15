import { PLANS } from "@trendtrack/core/plans";
import type { Metadata } from "next";
import Link from "next/link";
import { Column, PageTitle } from "@/components/site/prose";

export const metadata: Metadata = {
  title: "Affiliate-programma: 30% terugkerend",
  description:
    "Verdien 30% van elk abonnement dat via jouw link start, elke maand zolang de klant betaalt. Voor bureaus, creators en e-commerce-coaches.",
  alternates: { canonical: "/affiliate" },
};

// Bedragen zonder btw, uit de plannen zelf zodat ze meelopen met prijswijzigingen.
const EXAMPLES: [string, number][] = [
  ["5 klanten op Starter", 5 * PLANS.starter.monthlyEur],
  ["5 klanten op Pro", 5 * PLANS.pro.monthlyEur],
  ["2 bureaus op Agency", 2 * PLANS.agency.monthlyEur],
];

export default function AffiliatePublic() {
  const eur = (n: number) =>
    new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);
  return (
    <>
      <section className="s-wrap pt-10 pb-[clamp(72px,8vw,120px)]" aria-labelledby="aff-title">
        <PageTitle
          title="30% van elk abonnement"
          lead="Stuur webshops naar TrendTrack met je eigen link. Kiezen ze een betaald plan, dan krijg jij elke maand 30% van wat ze betalen, zolang ze klant blijven."
        />
        <Column>
          <Link href="/login?next=/app/settings/affiliate" className="s-btn">
            Maak je affiliate-link
          </Link>
        </Column>
      </section>

      <section
        aria-labelledby="calc-title"
        className="bg-[var(--s-accent)] py-[clamp(72px,8vw,120px)]"
      >
        <div className="s-wrap grid gap-8 md:grid-cols-[var(--s-axis)_1fr]">
          <h2 id="calc-title" style={{ fontSize: "clamp(1.75rem, 1.2rem + 1.6vw, 2.25rem)" }}>
            Wat het oplevert
          </h2>
          <ul className="grid gap-px sm:grid-cols-3">
            {EXAMPLES.map(([label, mrr]) => (
              <li key={label} className="bg-[#0a6556] p-6">
                <p className="text-[clamp(2rem,4vw,3.2rem)] leading-none font-semibold tracking-[-0.04em] tabular-nums">
                  {eur(mrr * 0.3)}
                </p>
                <p className="mt-2 text-[15px]">per maand met {label.toLowerCase()}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="rules-title" className="s-wrap py-[clamp(72px,8vw,120px)]">
        <div className="grid gap-8 md:grid-cols-[var(--s-axis)_1fr]">
          <h2 id="rules-title" style={{ fontSize: "clamp(1.75rem, 1.2rem + 1.6vw, 2.25rem)" }}>
            Zo werkt het
          </h2>
          <ol className="max-w-[62ch] space-y-5">
            <li>
              <strong className="font-semibold">Maak een gratis account</strong> en kies je code
              onder Instellingen → Affiliate. Je link wordt trendtrack.nl/?ref=jouwcode.
            </li>
            <li>
              <strong className="font-semibold">Deel de link</strong> in je video, nieuwsbrief,
              cursus of bij je klanten. We onthouden de link 30 dagen in de browser van de bezoeker.
            </li>
            <li>
              <strong className="font-semibold">Je verdient 30%</strong> van elke betaling (zonder
              btw) van abonnementen die via jouw link starten, zolang de klant betaalt. Ook bij een
              kwartaal- of jaarplan.
            </li>
            <li>
              <strong className="font-semibold">Uitbetaling per maand</strong> op factuur, vanaf €
              50. Terugbetalingen en chargebacks gaan eraf.
            </li>
            <li>
              <strong className="font-semibold">Niet toegestaan:</strong> je eigen abonnement,
              adverteren op onze merknaam en misleidende beloftes over de omzetcijfers (het blijven
              schattingen).
            </li>
          </ol>
        </div>
      </section>
    </>
  );
}
