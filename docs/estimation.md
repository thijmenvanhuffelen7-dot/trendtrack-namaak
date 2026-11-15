# Hoe we omzet schatten

**Kort:** we weten de omzet van een webshop niet. We schatten hem uit publieke signalen en tonen
altijd een bandbreedte (laag – midden – hoog) met een betrouwbaarheid (0–1). Nooit één hard getal.

Code: `packages/core/src/estimation.ts`. Alle aannames staan in `ASSUMPTIONS` in dat bestand;
pas je daar iets aan, pas dan ook deze pagina aan.

## De signalen

Elke dag maakt de job `shop.snapshot` een momentopname van elke actieve Shopify-store. Daaruit
komen drie signalen. Elk signaal geeft een eigen bandbreedte en een eigen betrouwbaarheid.

### 1. Advertenties (betrouwbaarheid 0,35)

- Uit de Meta Ad Library weten we hoeveel mensen in de EU een ad zag (`eu_total_reach`).
  Meta geeft **geen** spend voor commerciële ads. We schatten spend per ad als
  bereik × frequentie / 1000 × CPM (`packages/core/cpm.ts`):
  - CPM per land (EUR): NL 6–12, BE 5–10, DE 7–13, FR 5–10, anders 5–12. Gemiddelde over de landen
    waarin we de ad vonden.
  - Frequentie 1,2 (laag) – 2,5 (hoog): bereik telt unieke personen, maar iemand ziet een ad vaker.
    Zonder frequentie zou de spend structureel te laag uitvallen.
- Per actieve ad: geschatte spend / dagen actief × 30 = spend per maand (minimaal 7 dagen,
  zodat een ad van één dag niet tot een maandbedrag wordt opgeblazen).
- Omzet = spend × ROAS. Aanname ROAS: **1,5 (laag) – 2,5 (midden) – 4 (hoog)**.
- Zwakte: shops die veel omzet uit SEO, e-mail of terugkerende klanten halen, onderschatten we.
  Shops met verliesgevende campagnes overschatten we.

### 2. Uitverkochte varianten (betrouwbaarheid tot 0,3)

- We vergelijken de voorraad-status uit `/products.json` met de vorige dag. Gaat een variant van
  "beschikbaar" naar "uitverkocht", dan is er minstens één stuk verkocht.
- "Sellout value" = som van prijs × aantal varianten dat uitverkocht raakte.
- Dat is een **ondergrens**: verkopen van varianten die niet op nul komen zien we niet.
  Omzet = sellout value per maand × **2 (laag) – 5 (midden) – 15 (hoog)**.
- Pas vanaf 3 vergeleken dagen; volle betrouwbaarheid na 14 dagen.
- Nul uitverkopen telt niet als bewijs van nul omzet (veel winkels hebben diepe voorraad).
- Telt niet als het aantal varianten van een product veranderde (dan is het product aangepast).

### 3. Reviews (betrouwbaarheid tot 0,25)

- Als de review-app (Judge.me, Loox, of schema.org `AggregateRating`) het totaal publiek toont,
  tellen we de groei in reviews.
- Aanname: 1 review per **15 (laag) – 30 (midden) – 60 (hoog)** bestellingen.
- Omzet = reviews per maand × bestellingen per review × gemiddelde orderwaarde.
- Pas na 7 dagen; volle betrouwbaarheid na 28 dagen.

### Gemiddelde orderwaarde (AOV)

Mediaanprijs van de top-10 bestsellers (of van alle producten als we geen bestsellers kennen)
× 1,2 (vaak meer dan één item per bestelling). Hiermee rekenen we ook het aantal bestellingen uit.

### Bestsellers

Bestsellerposities slaan we per dag op (`product_snapshots.position_in_bestsellers`). Ze bepalen
welke prijzen in de AOV meetellen en laten in de UI zien wat er verschuift. Ze zeggen niets over
de grootte van de omzet, dus ze zijn geen apart omzetsignaal. Let op: de standaard Shopify-robots.txt
verbiedt `sort_by`, dus bestsellers hebben we alleen als de winkel een eigen bestseller-collectie heeft.

## Combineren

- Midden, laag en hoog: gewogen meetkundig gemiddelde van de signalen (gewicht = betrouwbaarheid).
- Zijn de signalen het oneens, dan wordt de band zo breed dat alle middenwaarden erin vallen.
- Betrouwbaarheid = 1 − Π(1 − betrouwbaarheid per signaal), daarna verlaagd naarmate de signalen
  meer verschillen (4× verschil halveert hem). Maximum **0,85**: we zijn nooit zeker.
- Geen enkel bruikbaar signaal? Dan **geen schatting** (null), geen gok.

## Growth score (−1 tot 1)

De laatste 7 dagen tegenover de 28 dagen daarvoor, op drie dingen:
nieuwe producten per dag (30%), actieve ads (35%) en geschatte dagomzet (35%).
Per onderdeel: tanh(ln((recent + 1) / (eerder + 1))). 0 = stabiel, > 0 = groei, < 0 = krimp.
Zijn er nog geen 28 eerdere dagen, dan vergelijken we de eerste helft van de data met de tweede.
Vanaf 2 snapshots is er een score, maar die is in het begin onrustig.

## Hoe we dit in de UI tonen

- Altijd "€18k – €37k per maand (schatting)" met de middenwaarde klein ernaast, nooit alleen "€26k".
- Betrouwbaarheid als label: < 0,3 "grove schatting", 0,3–0,6 "redelijke schatting", > 0,6 "sterke schatting".
- Een link "Hoe schatten we dit?" naar een publieke versie van deze pagina.
- In de API: elk geschat veld krijgt `"estimate": true` en de `confidence`.
- `shops.est_signals` zegt welke signalen meetelden, zodat we kunnen tonen "gebaseerd op ads en reviews".

## Bekende zwaktes

- Shops zonder ads, zonder publieke reviewteller en met diepe voorraad krijgen geen schatting.
- Dropshipping-shops (onbeperkte voorraad) leveren geen uitverkoop-signaal.
- ROAS en CPM verschillen sterk per niche; de aannames zijn Benelux-gemiddelden en nog niet gekalibreerd.
  Zodra we shops met bekende omzet hebben (bv. eigenaren die meedoen), kunnen we ze ijken.
