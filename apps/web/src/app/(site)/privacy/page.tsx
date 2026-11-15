import type { Metadata } from "next";
import Link from "next/link";
import { Column, PageTitle, Prose } from "@/components/site/prose";
import { SITE } from "@/lib/site/config";

export const metadata: Metadata = {
  title: "Privacyverklaring",
  description: "Welke gegevens TrendTrack verwerkt, waarom, hoe lang en welke rechten je hebt.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <div className="s-wrap pt-10 pb-[clamp(72px,8vw,120px)]">
      <PageTitle title="Privacy" aside="Versie 15 november 2026" />
      <Column>
        <Prose>
          <p className="s-note">
            Concepttekst. Laat deze verklaring nakijken door een jurist voordat de site live gaat,
            en vul de bedrijfsgegevens in.
          </p>
          <h2>Wie we zijn</h2>
          <p>
            TrendTrack ([bedrijfsnaam], KvK [nummer], {SITE.city}) is verantwoordelijk voor de
            verwerking van persoonsgegevens op deze site en in het dashboard. Vragen? Mail{" "}
            <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
          </p>

          <h2>Gegevens van gebruikers</h2>
          <table>
            <thead>
              <tr>
                <th>Wat</th>
                <th>Waarom</th>
                <th>Grondslag</th>
                <th>Bewaren</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>E-mailadres en naam</td>
                <td>Inloggen, je account</td>
                <td>Overeenkomst</td>
                <td>Tot je je account verwijdert</td>
              </tr>
              <tr>
                <td>Abonnement en facturen</td>
                <td>Betalen via Stripe</td>
                <td>Overeenkomst, wettelijke plicht</td>
                <td>7 jaar (fiscale bewaarplicht)</td>
              </tr>
              <tr>
                <td>Gebruik (zoekacties, API-calls)</td>
                <td>Limieten van je plan, misbruik voorkomen</td>
                <td>Overeenkomst</td>
                <td>Zolang je account bestaat</td>
              </tr>
              <tr>
                <td>Gehasht IP-adres bij gratis tools</td>
                <td>Limiet per uur</td>
                <td>Gerechtvaardigd belang</td>
                <td>2 dagen</td>
              </tr>
              <tr>
                <td>
                  Affiliate-code (cookie <em>ref</em>)
                </td>
                <td>Commissie toekennen</td>
                <td>Gerechtvaardigd belang</td>
                <td>30 dagen</td>
              </tr>
            </tbody>
          </table>
          <p>
            We gebruiken alleen functionele cookies: de inlogsessie, je taalkeuze en de
            affiliate-code. Geen advertentie- of trackingcookies, dus geen cookiebanner.
          </p>

          <h2>Gegevens over webshops en adverteerders</h2>
          <p>
            We verwerken openbare bedrijfsinformatie: wat iedere bezoeker van een webshop ziet, de
            openbare Meta Ad Library (ads in de EU) en nieuwsbrieven waarop iedereen zich kan
            inschrijven. In ads en mails kunnen namen van personen staan, bijvoorbeeld van een
            eigenaar of een influencer. Grondslag is ons gerechtvaardigd belang bij marktonderzoek;
            persoonlijke links en trackingpixels halen we uit mails.
          </p>
          <p>
            We respecteren robots.txt. Wil je dat we je shop niet meer volgen? Vraag het aan via{" "}
            <Link href="/opt-out">opt-out</Link>; we verwijderen de gegevens en slaan je domein
            voortaan over.
          </p>

          <h2>Verwerkers</h2>
          <ul>
            <li>Supabase (database en inloggen), servers in de EU.</li>
            <li>Stripe (betalingen).</li>
            <li>Vercel (hosting van de site) en een VPS-aanbieder in de EU (crawlers).</li>
            <li>Een e-mailprovider voor inlogmails.</li>
          </ul>
          <p>
            Met elke verwerker is een verwerkersovereenkomst gesloten. Doorgifte buiten de EU
            gebeurt alleen met de standaardcontractbepalingen van de Europese Commissie.
          </p>

          <h2>Je rechten</h2>
          <p>
            Je mag je gegevens inzien, laten corrigeren of verwijderen, bezwaar maken en ze
            meenemen. Mail ons; we reageren binnen een maand. Ben je het niet met ons eens, dan kun
            je klagen bij de Autoriteit Persoonsgegevens (in België: de
            Gegevensbeschermingsautoriteit).
          </p>

          <h2>Beveiliging</h2>
          <p>
            Verbindingen zijn versleuteld, API-sleutels en tokens bewaren we alleen als hash en
            toegang tot de database is per gebruiker afgeschermd.
          </p>
        </Prose>
      </Column>
    </div>
  );
}
