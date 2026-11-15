import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { PageShell } from "@/components/site/prose";

export const metadata: Metadata = {
  title: "Hoe we omzet schatten · TrendTrack",
  description:
    "Omzet van webshops is bij ons altijd een schatting met een bandbreedte. Zo komt die tot stand.",
};

/** Publieke uitleg van het schattingsmodel. Bron van waarheid: docs/estimation.md. */
export default async function EstimatesPage() {
  const en = (await getLocale()) === "en";
  return (
    <PageShell>
      <h1 className="s-rise max-w-4xl" style={{ fontSize: "var(--step-display)" }}>
        {en ? "How we estimate revenue" : "Hoe we omzet schatten"}
      </h1>
      <div className="s-prose s-rise-2 mt-10 max-w-[68ch]">
        {en ? (
          <>
            <p>
              <strong>We do not know a webshop&apos;s revenue.</strong> We estimate it from public
              signals and always show a range (low – high) with a confidence label. Never a single
              hard number.
            </p>
            <h2>The three signals</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Ads.</strong> The Meta Ad Library shows how many people in the EU saw an ad,
                not what it cost. We estimate spend from reach × frequency × a price per thousand
                impressions, and revenue as spend × 1.5 – 4.
              </li>
              <li>
                <strong>Sold-out products.</strong> When a variant goes from available to sold out,
                at least one unit was sold. That is a lower bound, so we multiply it by 2 – 15.
              </li>
              <li>
                <strong>Reviews.</strong> If the shop shows its review count publicly, growth in
                reviews indicates orders: roughly 1 review per 15 – 60 orders.
              </li>
            </ul>
            <h2>Combining and confidence</h2>
            <p>
              Signals are weighted by reliability. If they disagree, the range widens and confidence
              drops. Confidence never exceeds 85%. With no usable signal we show{" "}
              <em>no estimate</em> instead of guessing.
            </p>
            <h2>Known weaknesses</h2>
            <p>
              Shops that earn mostly from SEO, email or repeat customers are underestimated.
              Dropshippers with unlimited stock give no sold-out signal. The assumptions are Benelux
              averages and have not been calibrated against real revenue yet.
            </p>
          </>
        ) : (
          <>
            <p>
              <strong>We weten de omzet van een webshop niet.</strong> We schatten hem uit publieke
              signalen en tonen altijd een bandbreedte (laag – hoog) met een betrouwbaarheidslabel.
              Nooit één hard getal.
            </p>
            <h2>De drie signalen</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Ads.</strong> De Meta Ad Library laat zien hoeveel mensen in de EU een ad
                zagen, niet wat hij kostte. We schatten de spend uit bereik × frequentie × een prijs
                per duizend vertoningen, en de omzet als spend × 1,5 – 4.
              </li>
              <li>
                <strong>Uitverkochte producten.</strong> Gaat een variant van beschikbaar naar
                uitverkocht, dan is er minstens één stuk verkocht. Dat is een ondergrens, dus we
                vermenigvuldigen met 2 – 15.
              </li>
              <li>
                <strong>Reviews.</strong> Toont de shop het aantal reviews publiek, dan zegt de
                groei iets over het aantal bestellingen: ongeveer 1 review per 15 – 60 bestellingen.
              </li>
            </ul>
            <h2>Combineren en betrouwbaarheid</h2>
            <p>
              De signalen wegen mee naar hun betrouwbaarheid. Spreken ze elkaar tegen, dan wordt de
              band breder en daalt de betrouwbaarheid. Die komt nooit boven 85%. Is er geen
              bruikbaar signaal, dan tonen we <em>geen schatting</em> in plaats van te gokken.
            </p>
            <h2>Bekende zwaktes</h2>
            <p>
              Shops die vooral verdienen aan SEO, e-mail of terugkerende klanten onderschatten we.
              Dropshippers met onbeperkte voorraad geven geen uitverkoopsignaal. De aannames zijn
              Benelux-gemiddelden en nog niet geijkt tegen echte omzet.
            </p>
          </>
        )}
      </div>
    </PageShell>
  );
}
