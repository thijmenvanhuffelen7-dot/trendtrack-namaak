# E-mail library

We verzamelen echte nieuwsbrieven van webshops door ons in te schrijven met een uniek adres per shop.

## Opzet (eenmalig)

1. **Domein**: neem een apart (sub)domein, bv. `inbox.jouwdomein.nl`. Gebruik niet je hoofddomein:
   als nieuwsbrieven daar als spam gemarkeerd worden, wil je je eigen mail niet raken.
2. **Kies hoe mail binnenkomt** (`EMAIL_INBOUND_MODE`):
   - `webhook` (aanbevolen, direct): Postmark of Mailgun ontvangt de mail en POST hem naar de web-app.
     - Postmark: Inbound stream, catch-all op het domein, webhook-URL
       `https://postmark:<INBOUND_WEBHOOK_SECRET>@<jouw-app>/api/inbound/postmark`
     - Mailgun: Receiving route `match_recipient(".*@inbox.jouwdomein.nl")` → forward naar
       `https://<jouw-app>/api/inbound/mailgun`; zet `MAILGUN_WEBHOOK_SIGNING_KEY`
   - `imap`: een catch-all mailbox bij een gewone mailprovider; de workers pollen elke 30 seconden
     (`IMAP_*` variabelen). Werkt zonder publieke URL, maar is trager en minder robuust.
3. **DNS**: MX-records van het inbox-domein naar de provider (zie hun handleiding).
4. Zet `EMAIL_INBOX_DOMAIN` in `.env.local` (web én workers).

## Per shop

```bash
pnpm workers inbox --domain=zilverzand.nl                 # maakt/toont het seed-adres
# schrijf je met dat adres in op de nieuwsbrief van de shop, daarna meteen:
pnpm workers inbox --domain=zilverzand.nl --subscribed    # of --at=2026-11-15T10:00:00Z
pnpm workers inbox --list
pnpm workers inbox --domain=zilverzand.nl --test-mail --hours=1   # testmail zonder provider
```

Adressen zien eruit als `zilverzand-sieraden-k3m9x2@inbox.jouwdomein.nl`. De 6 random tekens maken
ze onraadbaar, zodat niemand de library met nepmail kan vullen. Mail voor een onbekend adres komt
in `inbound_rejects` (handig om typo's te vinden).

**Leg `subscribed_at` direct vast.** Zonder inschrijfmoment kunnen we welcome en flow niet
herkennen en wordt alles een campagne. Pas je het later aan, dan worden de bestaande mails
opnieuw geclassificeerd.

## Wat er met een mail gebeurt

1. Koppelen aan de shop via het seed-adres (ook via `Delivered-To`/`X-Original-To` bij catch-all).
2. Dubbel? (zelfde `Message-ID`) → overslaan. Providers sturen bij fouten opnieuw.
3. Opschonen (`packages/core/email-sanitize.ts`):
   scripts, iframes, forms, meta-tags, event-handlers en `javascript:` eruit; tracking-pixels eruit;
   afmeld-/voorkeurslinks onklikbaar; ons seed-adres vervangen door `jij@voorbeeld.nl`.
4. HTML naar Supabase Storage (privé bucket `emails`, pad `<shop_id>/<email_id>.html`).
5. Rij in `emails` met onderwerp, preheader, afzender, tijd en een tekstpreview.
6. Alle mails van de shop opnieuw classificeren.

## Classificatie (heuristiek)

- **welcome**: binnen 48 uur na inschrijven.
- **flow**: na de welcome-reeks, binnen 30 dagen, en op een vaste afstand van de vorige
  geautomatiseerde mail (hele uren, ±10 minuten). Flows draaien op vertragingen als "wacht 3 dagen";
  campagnes worden op een kalendermoment verstuurd, los van wanneer wij ons inschreven.
- **campaign**: de rest.
- `flow_step` = positie in de geautomatiseerde reeks (welcome-mails tellen mee).

Bekende zwaktes: een campagne die toevallig op een heel aantal uren na een flowmail komt, telt als
flow. Flows met een "verstuur om 10:00"-instelling (slimme verzendtijd) zien eruit als campagnes.

## Tonen in de UI (Prompt 9)

Toon de opgeschoonde HTML **altijd** in `<iframe sandbox srcdoc="...">` zonder `allow-scripts` en
zonder `allow-same-origin`. De sanitizer is de eerste verdedigingslinie, de sandbox de tweede.

## Privacy

- We schrijven ons echt in, met eigen adressen; er zitten geen persoonsgegevens van anderen in.
- Persoonlijke links (afmelden, voorkeuren) en ons adres halen we weg, zodat gebruikers niet per
  ongeluk onze inschrijving opzeggen of het adres zien.
- Een shop die niet in de library wil: zie de opt-out (Prompt 14).
