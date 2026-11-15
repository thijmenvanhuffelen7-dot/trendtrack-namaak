# Plannen, betalingen en limieten

## Plannen

Bron van waarheid: `packages/core/src/plans.ts`. De `plans`-tabel in de database wordt door de
migratie `20261115050000_billing.sql` gevuld; een test faalt als die twee uit elkaar lopen.

|                   | Gratis          | Starter €29      | Pro €59          | Agency €119            |
| ----------------- | --------------- | ---------------- | ---------------- | ---------------------- |
| Shop-lookups      | 5 / week        | 50 / week        | onbeperkt        | onbeperkt              |
| Ad-zoekopdrachten | 20 / dag        | onbeperkt        | onbeperkt        | onbeperkt              |
| Folders           | 1               | onbeperkt        | onbeperkt        | onbeperkt              |
| Brandtracker      | –               | 3 merken         | 15               | 40                     |
| E-mail library    | laatste 7 dagen | laatste 30 dagen | volledig         | volledig               |
| API + MCP         | –               | –                | 10.000 calls/mnd | 50.000 calls/mnd       |
| Gebruikers        | 1               | 1                | 1                | 3 (+€20/mnd per extra) |

Kwartaal −15%, jaar −30%. Nieuwe gebruikers krijgen 7 dagen Pro zonder creditcard
(database-trigger op `auth.users`); daarna gratis, tenzij ze betalen.

**Keuzes die niet in het bouwplan stonden** (pas aan in `plans.ts` als je het anders wilt):

- "E-mail library beperkt" bij Starter = de laatste 30 dagen; gratis = 7 dagen.
- Een shop-lookup = een shop-pagina openen of een onbekend domein laten ophalen. Dezelfde shop
  telt één keer per week. Een ad-zoekopdracht = een unieke combinatie van filters per dag;
  bladeren en een ad openen tellen niet.
- Periodes zijn kalenderperiodes in Nederlandse tijd: dag vanaf middernacht, week vanaf maandag,
  maand vanaf de 1e.
- Een mislukte betaling (`past_due`) houdt het plan zolang Stripe het opnieuw probeert.

## Limieten in de code

Eén functie: `checkAndRecordUsage(serviceDb, workspaceId, action, opts)` in
`packages/db/src/usage.ts`. Web, REST API en MCP gebruiken alleen deze.

- `shop_lookup`, `ad_search`, `api_call` tellen `usage_events` via de SQL-functie
  `record_usage` (advisory lock: ook bij gelijktijdige verzoeken nooit over de limiet).
- `folder`, `tracked_brand` tellen bestaande rijen.
- API en MCP delen het quotum `api_call` (`source` = `api` of `mcp`).
- Bij de limiet: in de UI een melding met "Bekijk plannen"; de API geeft HTTP 402 (Prompt 11).

## Stripe instellen (testmodus)

1. Stripe-account, testmodus aan. Zet in `.env.local`: `STRIPE_SECRET_KEY=sk_test_...`.
2. Producten en prijzen aanmaken (idempotent, via lookup keys als `pro_month`, `agency_seat_year`):
   ```bash
   pnpm --filter web stripe:setup
   ```
   Zet de geprinte `STRIPE_PORTAL_CONFIGURATION=bpc_...` in `.env.local`.
3. Dashboard → Settings → Payment methods: zet **iDEAL** en **Bancontact** aan (in abonnementen
   lopen die via SEPA-incasso).
4. Webhook lokaal doorsturen met de Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Zet het getoonde `whsec_...` als `STRIPE_WEBHOOK_SECRET`.
   Productie: Developers → Webhooks → endpoint `https://<domein>/api/stripe/webhook` met de events
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_failed`.
5. Testen: `/app/settings/billing` → "Kies Pro" → testkaart `4242 4242 4242 4242` → terug in de
   app staat Pro. Downgraden en opzeggen via "Abonnement beheren" (Customer Portal).

## Hoe het werkt

- Checkout krijgt `client_reference_id` en metadata `workspace_id`; daarmee koppelt de webhook het
  abonnement aan de workspace. Heeft een workspace al een betaald abonnement, dan gaat "kiezen"
  naar het portal (geen dubbele abonnementen).
- `apps/web/src/lib/server/billing/stripe.ts` vertaalt Stripe-events naar provider-onafhankelijke
  `BillingEvent`s; `packages/db/src/billing.ts` schrijft ze weg. Idempotent (`billing_events`) en
  bestand tegen events die in de verkeerde volgorde binnenkomen (`provider_event_at`).
- **Mollie toevoegen**: een `lib/server/billing/mollie.ts` die dezelfde `BillingEvent`s maakt, een
  webhook-route, en `provider = 'mollie'`. De rest van de app hoeft niet te veranderen.
