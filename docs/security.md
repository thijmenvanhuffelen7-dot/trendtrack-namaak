# Beveiliging (review Prompt 14)

Stand van 15 november 2026. Wat er is, hoe het getest wordt en wat nog openstaat.

## Toegang tot data

- **RLS op elke tabel**, alleen SELECT-policies. Schrijven gaat uitsluitend via de service role
  (server actions na `getSession()`, API-routes na key-check, workers).
- **Audit-test** `packages/db/src/rls-audit.integration.test.ts` (`pnpm audit:rls`, ook in `pnpm test:db`):
  - elke tabel staat in een matrix (public / anon / workspace / own / admin / service); een nieuwe tabel
    laat de test falen tot hij bewust is ingedeeld;
  - RLS staat overal aan, er zijn geen INSERT/UPDATE/DELETE-policies en alleen `plans` is voor anon;
  - anon leest niets behalve plannen; een ingelogde gebruiker kan op geen enkele tabel inserten of
    deleten en ziet geen data van een andere workspace of gebruiker;
  - alleen `is_admin`, `is_workspace_member` en `shop_facets` zijn via `/rpc` aan te roepen.
- Bevinding en fix: trigger-functies en `is_opted_out` waren uitvoerbaar voor anon/authenticated
  (niet misbruikbaar, maar onnodig). Rechten ingetrokken in `20261115110000_function_grants.sql`.

## Geheimen

- Alleen via env; `.env.local` en `.env.production` staan in `.gitignore`.
- Gecontroleerd in de productie-build: geen service-role key, Stripe-key of `RATE_LIMIT_SALT` in
  `.next/static` (de client-bundles). `server-only` staat op de sessie- en db-modules.
- API-keys, OAuth-codes en -tokens staan alleen als SHA-256-hash in de database.
- `RATE_LIMIT_SALT` is verplicht in productie (anders weigert de app de gratis tools).

## HTTP

- Security headers op elke pagina (`next.config.ts`): CSP (`default-src 'self'`, `frame-ancestors 'none'`,
  `object-src 'none'`, `base-uri 'self'`, `form-action` beperkt), `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP en HSTS (productie).
- Bewuste uitzonderingen in de CSP: `script-src 'unsafe-inline'` (inline hydration-scripts van Next; een
  nonce zou elke pagina dynamisch maken), `img-src https:` (productbeelden van shops en Meta),
  `frame-src https:` (landingspagina's van ads, in een iframe **zonder** scripts: `sandbox=""`).
  Op `/oauth/*` mag `form-action` naar elke https-redirect-URI van de MCP-client.
- E-mail-HTML: gesaneerd (sanitize-html) en getoond in een iframe zonder `allow-scripts` en zonder
  `allow-same-origin`.

## Invoer

- Alle externe invoer via zod: HTTP-parameters, server actions, API-keys, job-payloads, Stripe-events,
  Meta-responses, MCP-tool-argumenten.
- **SSRF**: de crawler en de gratis tools gebruiken `PoliteFetcher` met DNS-check op privé/interne
  adressen (ook na redirects), alleen http(s) en poort 80/443, robots.txt en 1 request/s per domein.
- CSV-export beschermd tegen formule-injectie (`=`, `+`, `-`, `@` worden geneutraliseerd).
- Open redirects: `safeNext` staat alleen interne paden toe.

## Misbruik en limieten

| Wat                         | Limiet                                                                        | Waar                           |
| --------------------------- | ----------------------------------------------------------------------------- | ------------------------------ |
| Gratis tools zonder account | per gehasht IP per uur: detect 20, products 5, ads 20, estimate 30, opt-out 5 | `public_rate_hit`              |
| REST API en MCP             | per key: Pro 5/s en 2000/dag, Agency 10/s en 10000/dag                        | `api_rate_hit`, `record_usage` |
| Dashboard                   | per plan (shop-lookups, ad-zoekacties, folders, brands)                       | `checkAndRecordUsage`          |
| Magic links                 | Supabase auth rate limits                                                     | `supabase/config.toml`         |

## Opt-out

Eigenaren vragen verwijdering aan op `/opt-out`; een admin keurt goed op `/admin/opt-out`. Daarna:
shopdata weg (cascade), domein op `opted_out_domains`, en een databasetrigger voorkomt dat het domein ooit
opnieuw in `shops` komt. Workers slaan elke job voor het domein over, lookups worden direct afgesloten en
de gratis tools geven 410. Getest in `optout.integration.test.ts` en e2e.

## Nog open (bewust)

- Geen 2FA voor admins (magic link via e-mail). Overweeg Google-login met verplichte 2FA voor admins.
- Geen WAF/bot-bescherming voor de gratis tools behalve de IP-limieten; Vercel Firewall kan erbij.
- De CSP gebruikt `'unsafe-inline'` voor scripts (zie boven).
- Pentest door een derde partij is niet gedaan.
