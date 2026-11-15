import type { Metadata } from "next";
import { Column, PageTitle, Prose } from "@/components/site/prose";
import { SITE } from "@/lib/site/config";
import { OptoutForm } from "./form";

export const metadata: Metadata = {
  title: "Je shop laten verwijderen",
  description:
    "Ben je eigenaar van een webshop en wil je niet in TrendTrack staan? Vraag hier aan dat we je shop verwijderen en niet meer volgen.",
  alternates: { canonical: "/opt-out" },
};

export default function OptoutPage() {
  return (
    <div className="s-wrap pt-10 pb-[clamp(72px,8vw,120px)]">
      <PageTitle
        title="Shop laten verwijderen"
        lead="Wil je niet dat we je webshop volgen? Dan verwijderen we de gegevens en slaan we je domein voortaan over."
      />
      <Column>
        <OptoutForm />
        <div className="mt-16">
          <Prose>
            <h2>Wat er gebeurt</h2>
            <ul>
              <li>
                We controleren of het verzoek van de eigenaar komt, meestal via het e-mailadres op
                je domein. Soms mailen we je om het te bevestigen.
              </li>
              <li>
                Binnen 5 werkdagen verwijderen we de shop met alle producten, prijshistorie,
                schattingen en nieuwsbrieven.
              </li>
              <li>
                Daarna crawlen we je domein niet meer en kan niemand het opnieuw toevoegen, ook niet
                via de API of de gratis tools.
              </li>
              <li>
                Je ads blijven zichtbaar in de openbare Meta Ad Library; bij ons zijn ze niet meer
                aan je shop gekoppeld.
              </li>
            </ul>
            <p>
              Je kunt onze crawler ook weren via robots.txt (user-agent <em>TrendTrackBot</em>); dat
              respecteren we altijd. Vragen? Mail <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
            </p>
          </Prose>
        </div>
      </Column>
    </div>
  );
}
