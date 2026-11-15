import type { Metadata } from "next";
import Link from "next/link";
import { Column, PageTitle, Prose } from "@/components/site/prose";
import { SITE } from "@/lib/site/config";

export const metadata: Metadata = {
  title: "Algemene voorwaarden",
  description:
    "De voorwaarden voor het gebruik van TrendTrack: accounts, plannen, betalen, opzeggen, de API en aansprakelijkheid.",
  alternates: { canonical: "/voorwaarden" },
};

export default function Terms() {
  return (
    <div className="s-wrap pt-10 pb-[clamp(72px,8vw,120px)]">
      <PageTitle title="Voorwaarden" aside="Versie 15 november 2026" />
      <Column>
        <Prose>
          <p className="s-note">
            Concepttekst. Laat deze voorwaarden nakijken door een jurist voordat de site live gaat.
          </p>
          <h2>1. Over deze voorwaarden</h2>
          <p>
            Deze voorwaarden gelden voor het gebruik van TrendTrack (de site, het dashboard, de REST
            API en de MCP-server) van [bedrijfsnaam], {SITE.city}. TrendTrack is bedoeld voor
            zakelijke gebruikers.
          </p>

          <h2>2. Account</h2>
          <p>
            Je bent verantwoordelijk voor wat er met je account, je API-sleutels en gekoppelde apps
            gebeurt. Deel sleutels niet; trek ze in als ze uitlekken.
          </p>

          <h2>3. Plannen en betalen</h2>
          <ul>
            <li>
              Er is een gratis plan en betaalde plannen per maand, kwartaal of jaar. De actuele
              prijzen en limieten staan op <Link href="/prijzen">prijzen</Link>; bedragen zijn
              exclusief btw.
            </li>
            <li>
              Een proefperiode van Pro duurt 7 dagen en stopt vanzelf; daarna val je terug naar het
              gratis plan.
            </li>
            <li>
              Abonnementen worden vooraf betaald en verlengen automatisch. Opzeggen kan altijd en
              gaat in aan het einde van de lopende periode. Betaalde periodes worden niet
              terugbetaald, tenzij de wet dat vereist.
            </li>
            <li>
              Prijswijzigingen melden we minstens 30 dagen vooraf; ze gelden vanaf de volgende
              periode.
            </li>
          </ul>

          <h2>4. Schattingen</h2>
          <p>
            Omzet, ad-spend en andere geschatte cijfers zijn schattingen op basis van openbare
            signalen en worden altijd als bandbreedte getoond. Ze zijn geen feiten over een bedrijf.
            Neem geen beslissingen alleen op basis van deze cijfers.
          </p>

          <h2>5. Wat niet mag</h2>
          <ul>
            <li>
              De dienst doorverkopen of de data in bulk overnemen buiten de limieten van je plan.
            </li>
            <li>
              De API of de MCP-server gebruiken om limieten te omzeilen, of meer accounts aanmaken
              met dat doel.
            </li>
            <li>Gegevens gebruiken om personen lastig te vallen of in strijd met de wet.</li>
          </ul>
          <p>Bij misbruik mogen we je account beperken of beëindigen.</p>

          <h2>6. Beschikbaarheid</h2>
          <p>
            We doen ons best om TrendTrack altijd bereikbaar te houden, maar garanderen geen
            ononderbroken werking. Gegevens van derden (zoals de Meta Ad Library) kunnen vertraagd
            of onvolledig zijn.
          </p>

          <h2>7. Aansprakelijkheid</h2>
          <p>
            Onze aansprakelijkheid is beperkt tot het bedrag dat je in de 12 maanden voor de schade
            aan ons betaalde. We zijn niet aansprakelijk voor indirecte schade, zoals gemiste omzet.
            Dit geldt niet bij opzet of bewuste roekeloosheid.
          </p>

          <h2>8. Recht</h2>
          <p>
            Op deze voorwaarden is Nederlands recht van toepassing. Geschillen gaan naar de bevoegde
            rechter in [arrondissement].
          </p>
        </Prose>
      </Column>
    </div>
  );
}
