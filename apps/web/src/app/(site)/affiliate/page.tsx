import { PLANS } from "@trendtrack/core/plans";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, PageTitle } from "@/components/site/prose";

export const metadata: Metadata = {
  title: "Affiliate-programma: 30% terugkerend",
  description:
    "Verdien 30% van elk abonnement dat via jouw link start, elke maand zolang de klant betaalt. Voor bureaus, creators en e-commerce-coaches.",
  alternates: { canonical: "/affiliate" },
};

// Prijzen zijn inclusief 21% btw; commissie gaat over het bedrag zonder btw.
const exVat = (incl: number) => incl / 1.21;
const EXAMPLES: [string, number][] = [
  ["5 klanten op Starter", 5 * exVat(PLANS.starter.monthlyEur)],
  ["5 klanten op Pro", 5 * exVat(PLANS.pro.monthlyEur)],
  ["2 bureaus op Agency", 2 * exVat(PLANS.agency.monthlyEur)],
];

const STEPS: [string, string][] = [
  [
    "Maak een gratis account",
    "Kies je code onder Instellingen → Affiliate. Je link wordt trendtrack.nl/?ref=jouwcode.",
  ],
  [
    "Deel de link",
    "In je video, nieuwsbrief, cursus of bij je klanten. We onthouden de link 30 dagen in de browser van de bezoeker.",
  ],
  [
    "Verdien 30%",
    "Van elke betaling (zonder btw) van abonnementen die via jouw link starten, zolang de klant betaalt. Ook bij kwartaal- en jaarplannen.",
  ],
  ["Uitbetaling per maand", "Op factuur, vanaf € 50. Terugbetalingen en chargebacks gaan eraf."],
];

export default function AffiliatePublic() {
  const eur = (n: number) =>
    new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);
  return (
    <PageShell>
      <PageTitle
        title="30% van elk abonnement"
        lead="Stuur webshops naar TrendTrack met je eigen link. Kiezen ze een betaald plan, dan krijg jij elke maand 30% van wat ze betalen, zolang ze klant blijven."
      />
      <div className="s-rise-4 mt-8 flex flex-wrap gap-3">
        <Link href="/login?next=/app/settings/affiliate" className="s-btn">
          Maak je affiliate-link
          <ArrowRight className="s-arrow size-4" aria-hidden />
        </Link>
      </div>

      <section aria-labelledby="calc-title" className="mt-24">
        <h2 id="calc-title" style={{ fontSize: "var(--step-head)" }}>
          Wat het <span className="s-accent-text">oplevert.</span>
        </h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-3" data-reveal>
          {EXAMPLES.map(([label, mrr]) => (
            <li key={label} className="s-frame">
              <div className="s-card p-6">
                <p className="font-[family-name:var(--font-display)] text-[clamp(2.2rem,4vw,3.2rem)] leading-none font-bold tracking-[-0.04em] tabular-nums">
                  {eur(mrr * 0.3)}
                </p>
                <p className="mt-3 text-[15px] text-[var(--s-muted)]">
                  per maand met {label.toLowerCase()}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[14px] text-[var(--s-faint)]">Bij maandbetaling, zonder btw.</p>
      </section>

      <section aria-labelledby="rules-title" className="mt-24 grid gap-10 lg:grid-cols-[1fr_1.3fr]">
        <h2 id="rules-title" style={{ fontSize: "var(--step-head)" }}>
          Zo <span className="s-accent-text">werkt het.</span>
        </h2>
        <ol className="space-y-3">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="s-frame">
              <div className="s-card flex gap-4 p-5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-[var(--s-line-2)] bg-white/[0.04] text-[14px] text-[#5fe3c5]">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-[19px]">{title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-[var(--s-muted)]">{text}</p>
                </div>
              </div>
            </li>
          ))}
          <li className="px-2 pt-2 text-[14px] text-[var(--s-faint)]">
            Niet toegestaan: je eigen abonnement, adverteren op onze merknaam en misleidende
            beloftes over de omzetcijfers (het blijven schattingen).
          </li>
        </ol>
      </section>
    </PageShell>
  );
}
