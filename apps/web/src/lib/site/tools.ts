/** De gratis tools: één bron voor de index, de pagina's, de sitemap en de metadata. */
export interface ToolInfo {
  slug: string;
  title: string;
  h1: string;
  description: string;
  intro: string;
  how: string[];
  kind: "theme" | "apps" | "export" | "ads" | "roas" | "margin" | "clv";
}

export const TOOLS: ToolInfo[] = [
  {
    slug: "shopify-theme-detector",
    kind: "theme",
    title: "Shopify theme detector",
    h1: "Welk Shopify-thema?",
    description:
      "Zie gratis welk Shopify-thema een webshop gebruikt. Vul een domein in en je weet het in een paar seconden.",
    intro:
      "Vul het domein van een webshop in. We kijken op de homepage welk thema Shopify laadt, en of het een kopie van een standaardthema is.",
    how: [
      "Shopify zet de naam van het thema in de pagina. We lezen het oorspronkelijke thema (bijvoorbeeld Dawn), ook als de winkel het hernoemde.",
      "We halen alleen de homepage op, met een eigen herkenbare bot en volgens robots.txt van de winkel.",
      "Geen Shopify-store? Dan zie je dat ook, met de apps die we wel herkennen.",
    ],
  },
  {
    slug: "shopify-apps-detector",
    kind: "apps",
    title: "Shopify apps detector",
    h1: "Welke apps draait een webshop?",
    description:
      "Zie gratis welke apps en tools een Shopify-store gebruikt: reviews, e-mail, abonnementen, upsells, pixels en meer.",
    intro:
      "We herkennen ruim zestig apps en tools aan de scripts op de homepage, van Klaviyo en Judge.me tot Kiyoh en de Meta-pixel.",
    how: [
      "Apps laden scripts van hun eigen servers. Die adressen vergelijken we met onze lijst.",
      "Apps die alleen in de achterkant van de winkel draaien (zoals boekhouding) zijn van buiten niet te zien.",
      "Met een account zie je de apps van duizenden shops en kun je filteren op app.",
    ],
  },
  {
    slug: "shopify-product-exporter",
    kind: "export",
    title: "Shopify product exporter",
    h1: "Producten exporteren naar CSV",
    description:
      "Exporteer gratis tot 250 producten van een Shopify-store naar CSV: titel, prijs, van-prijs, type, merk, voorraad en tags.",
    intro:
      "Shopify-stores publiceren hun productlijst openbaar. Wij zetten de eerste 250 producten in een CSV die je in Excel of Google Sheets opent.",
    how: [
      "We lezen de openbare productlijst van de winkel (/products.json), de eerste pagina van 250 producten.",
      "Je krijgt per product de titel, link, prijzen, het aantal varianten en hoeveel daarvan op voorraad zijn.",
      "Meer producten, prijshistorie en nieuwe producten per dag? Dat zit in het dashboard.",
    ],
  },
  {
    slug: "winnende-ads-finder",
    kind: "ads",
    title: "Winnende ads finder",
    h1: "Winnende ads vinden",
    description:
      "Vind gratis de langst lopende Facebook- en Instagram-ads in Nederland en België voor een zoekwoord. Lang lopend is vaak winstgevend.",
    intro:
      "Adverteerders zetten ads die geen geld opleveren snel stil. Wat al maanden loopt, werkt meestal. Zoek op een woord uit de advertentietekst.",
    how: [
      "We zoeken in de ads uit de officiële Meta Ad Library die in Nederland of België lopen.",
      "Je ziet de twaalf langst lopende actieve ads, met bereik en geschatte spend.",
      "Alle resultaten, filters op bereik en taal, en ads opslaan in folders: met een gratis account.",
    ],
  },
  {
    slug: "roas-break-even-calculator",
    kind: "roas",
    title: "ROAS break-even calculator",
    h1: "Je break-even ROAS",
    description:
      "Bereken bij welke ROAS je advertenties quitte spelen en wat een bestelling maximaal aan advertenties mag kosten.",
    intro:
      "Onder je break-even ROAS kost elke bestelling uit ads je geld. Vul je prijzen en kosten in; alles blijft in je browser.",
    how: [
      "Break-even ROAS = verkoopprijs inclusief btw gedeeld door wat je per bestelling aan ads mag uitgeven.",
      "Wat je mag uitgeven is je winst per bestelling vóór advertenties: prijs zonder btw min inkoop, verzending, transactiekosten en verpakking.",
      "Meta toont ROAS over omzet inclusief btw; deze calculator rekent op dezelfde manier.",
    ],
  },
  {
    slug: "winstmarge-calculator",
    kind: "margin",
    title: "Winstmarge calculator",
    h1: "Je winstmarge per product",
    description:
      "Bereken je winst, winstmarge en opslag per product, met btw, verzendkosten en transactiekosten.",
    intro:
      "Weet wat je echt overhoudt per verkoop. Vul de verkoopprijs en je kosten in; alles blijft in je browser.",
    how: [
      "We halen eerst de btw van je verkoopprijs af: die is niet van jou.",
      "Daarna gaan inkoop, verzending, transactiekosten (een percentage van de prijs) en overige kosten eraf.",
      "Marge is winst gedeeld door de prijs zonder btw; opslag is winst gedeeld door de inkoopprijs.",
    ],
  },
  {
    slug: "clv-calculator",
    kind: "clv",
    title: "CLV calculator",
    h1: "Wat is een klant waard?",
    description:
      "Bereken de customer lifetime value (CLV) van je klanten en hoeveel je maximaal mag uitgeven om een klant te werven.",
    intro:
      "Een klant die terugkomt is meer waard dan één bestelling. Vul je gemiddelden in; alles blijft in je browser.",
    how: [
      "Omzet per klant = gemiddelde orderwaarde × bestellingen per jaar × aantal jaren dat een klant blijft.",
      "Winst per klant = die omzet zonder btw × je brutomarge.",
      "Vuistregel: geef hooguit een derde van de winst per klant uit aan het werven ervan.",
    ],
  },
];

export const toolBySlug = (slug: string) => TOOLS.find((t) => t.slug === slug);
