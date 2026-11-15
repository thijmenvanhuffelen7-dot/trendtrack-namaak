# Voortgang

## Prompt 1: project-setup — klaar (2026-11-15)

- pnpm-monorepo: `apps/web`, `apps/workers`, `apps/mcp`, `packages/db`, `packages/core`
- web: Next.js 15 (App Router) + Tailwind v4 + shadcn/ui-basis (`components.json`, `cn`, `Button`)
- workers: pg-boss-skelet (`src/index.ts`), jobnamen (`src/jobs.ts`), CLI-skelet (`src/cli.ts`)
- mcp: Streamable HTTP op `/mcp` (stateless), `/health`, tool `ping`, test via in-memory transport
- core: `normalizeDomain` / `tryNormalizeDomain` (weigert IP's en localhost), `Estimate`-type
- db: service-role client + zod-validatie van env, placeholder `database.gen.ts`
- ESLint (flat config), Prettier, Vitest (projects), `.env.example`, Supabase CLI (`supabase init`)
- GitHub Actions: lint, typecheck, test, format-check
- Gecheckt: `pnpm install`, `lint`, `typecheck`, `test` en `pnpm dev` (pagina laadt) slagen

### Open / aandachtspunten

- next-intl (NL/EN) komt in Prompt 8, Supabase Auth ook.

## Prompt 2: database-schema — klaar (2026-11-15)

- Migratie `supabase/migrations/20261115000000_init_schema.sql`:
  shops, products, product_snapshots, shop_snapshots, advertisers, ads, emails,
  profiles, workspaces, workspace_members, plans, subscriptions, usage_events, api_keys,
  folders, folder_items (polymorf: ad/shop/email), tracked_brands
- Extra kolommen t.o.v. het plan: `shops.est_monthly_revenue_low/high` + `est_confidence`
  (bandbreedte), `ads.snapshot_url`, `ads.first_seen_at`, `folders.share_token`,
  `profiles.is_admin`, `subscriptions.provider` (stripe/mollie), `tracked_brands.daily_digest`
- Indexen op filterkolommen; full-text (`tsvector`, config `simple` i.v.m. NL/FR/EN) op
  `ads.body/title` en `products.title`; trigram-index op shop- en adverteerdersnamen
- RLS: openbare data alleen lezen voor `authenticated`; workspace-data alleen voor leden
  (`is_workspace_member()`, security definer); `plans` publiek. Schrijven alleen via service role
  (insert/update/delete ingetrokken voor anon/authenticated). `api_keys.key_hash` is niet selecteerbaar.
- Trigger: nieuwe gebruiker krijgt automatisch profiel + persoonlijke workspace (owner)
- Seed: 4 plannen, 3 shops, 7 producten, 3 adverteerders, 10 ads, snapshots
- Types gegenereerd naar `packages/db/src/database.gen.ts` (`pnpm db:types`)
- `pnpm test:db`: 7 RLS-integratietests tegen lokale Supabase (o.a. andermans folders niet leesbaar)
- CI: aparte job die Supabase start, reset, types-drift checkt en `test:db` draait

### Let op

- Omdat schrijven alleen via de service role mag, moeten web-acties (folder maken, merk volgen)
  via server actions/route handlers lopen die eerst auth + `checkAndRecordUsage` doen.

## Prompt 3: Shopify shop crawler — klaar (2026-11-15), met kanttekening

- `packages/core`:
  - `app-signatures.ts`: 64 apps/tools (o.a. Klaviyo, Judge.me, Loox, Recharge, Vitals, en NL-specifiek
    Kiyoh, WebwinkelKeur, Trusted Shops, Feedback Company) + `detectApps()`
  - `shopify-detect.ts`: `parseShopifyHomepage()` (Shopify ja/nee, naam, valuta, land, locale,
    thema via `Shopify.theme.schema_name`, myshopify-domein, apps)
  - `shopify-products.ts`: zod-schema voor `/products.json`, `toProductRecord()`, `extractProductHandles()`
  - `robots.ts`: robots.txt-parser (groepen, `*`, `$`, langste match, crawl-delay)
- `apps/workers`:
  - `http/polite-fetcher.ts`: max 1 req/s per domein (requests per domein in serie), robots.txt
    (+ crawl-delay), timeouts, retries met backoff + Retry-After, eigen User-Agent (`CRAWLER_CONTACT`),
    SSRF-bescherming (geen IP's/localhost/afwijkende poorten/privé-IP's, ook niet na redirects),
    401/403 en aanhoudende 429/430 => `BlockedError`
  - `crawler/detect-shop.ts` (shop.detect): homepage + `/meta.json`, upsert shop, koppelt ads
    met hetzelfde `landing_domain`. Blokkeert/weert ons => `blocked`. Domein bestaat niet => `dead`
    (alleen als DNS verder wél werkt). Wachtwoordpagina => `dead`. Netwerkstoring => status blijft, job faalt
    en wordt opnieuw geprobeerd.
  - `crawler/crawl-products.ts` (shop.crawl_products): pagineert `/products.json?limit=250&page=N`
  - `crawler/crawl-bestsellers.ts` (shop.crawl_bestsellers): zie kanttekening
  - `crawler/discovery.ts` (shop.discover): domeinen uit ads + `data/seed-domains.txt`;
    `requestLookup()` voor gebruikers (hoogste prioriteit). Dedupe via pg-boss `singletonKey` + policy `short`.
  - `register.ts`: queues + handlers; detect => crawl_products => crawl_bestsellers
  - CLI: `pnpm workers crawl --domain=<domein>` en `pnpm workers discover`
- Tests: 38 unit tests met fixtures (geen netwerk) + integratietest die een volledige crawl
  (nep-netwerk) naar de echte lokale Supabase schrijft (`pnpm test:db`)

### Kanttekening: bestsellers en robots.txt

De standaard robots.txt van elke Shopify-store bevat `Disallow: /collections/*sort_by*`.
"Respecteer robots.txt" en "lees `/collections/all?sort_by=best-selling`" gaan dus bijna nooit samen.
De crawler gebruikt `sort_by` alleen als robots.txt het toestaat, en valt anders terug op een eigen
bestseller-collectie van de winkel (`/collections/bestsellers/products.json`, `best-sellers`, `meest-verkocht`, ...).
Hebben ze die niet, dan is er geen bestsellerdata. Ook `/cart.js` is verboden (`Disallow: /cart`),
daarom gebruiken we `/meta.json` voor detectie.

### Niet getest

- Een echte NL-store crawlen lukte niet in de cloud-sessie: geen DNS en de proxy blokkeert webshops.
  Lokaal of op de VPS: `pnpm workers crawl --domain=<shop>`.

## Prompt 4: dagelijkse snapshots en sales-schatting — klaar (2026-11-15)

- `packages/core`:
  - `snapshot-diff.ts`: nieuwe/verdwenen producten, prijswijzigingen, uitverkochte varianten
    (+ sellout value), restocks, bestsellerverschuivingen
  - `reviews.ts`: reviewtelling uit JSON-LD AggregateRating, Judge.me- en Loox-badges
  - `estimation.ts`: signalen ads (spend × ROAS), uitverkopen en reviews, gewogen gecombineerd tot
    `{ low, mid, high, confidence, estimate: true }` (+ bestellingen); `growthScore()`; `estimateAov()`
- Migratie `20261115010000_snapshot_signals.sql`: extra signaalkolommen op `shop_snapshots`,
  orders-bandbreedte, `est_signals` en `est_updated_at` op `shops`
- `apps/workers`:
  - `snapshot/snapshot-shop.ts` (job `shop.snapshot`): homepage (reviews), alle producten,
    bestsellers, diff t.o.v. vorige snapshot, product- en shop-snapshots, schatting + growth_score
  - `repo/ad-stats.ts`: actieve ads => spend per maand
  - CLI: `pnpm workers snapshot --domain=<domein>` of `--all [--limit=50]`
- `docs/estimation.md`: uitleg van het model, aannames en hoe we het in de UI tonen
- Tests: groeiende/stabiele/dode reeksen, signalen, diff, reviews; snapshot-flow over twee dagen
  (in-memory) en integratietest: na twee runs staan schatting + growth_score in de lokale database

### Let op

- Het ads-signaal heeft `est_spend_low/high` op ads nodig; die vult Prompt 5 (Meta + `cpm.ts`).
  Tot dan hebben alleen de seed-ads een spend-schatting.
- De dagelijkse planning (alle shops, gespreid) komt in Prompt 7.
- Aannames (ROAS, factoren) zijn niet gekalibreerd. Zie "Bekende zwaktes" in docs/estimation.md.

## Prompt 5: Meta Ad Library ingest — gebouwd (2026-11-15), nog niet met echte API getest

- `packages/core/meta-ad-library.ts`: client voor de officiële `ads_archive`-endpoint
  (ad_type=ALL, ad_reached_countries, search_page_ids/search_terms, alle EU-velden),
  paginering via `after`-cursor, usage-headers (`x-app-usage`, `x-business-use-case-usage`) =>
  wachten boven 90%, rate-limit-codes (4/17/32/613/80004, 429, 5xx) => retry met backoff of
  `estimated_time_to_regain_access`, code 190 => `MetaTokenError` (geen retry)
- `mapMetaAd()`: landingsdomein uit link caption (of domein in de tekst; social/linkdiensten genegeerd),
  is_active = geen stopdatum of stopdatum in de toekomst, spend-schatting, landen
- **`ad_snapshot_url` bevat het access token** en wordt daarom niet opgeslagen; we slaan
  `https://www.facebook.com/ads/library/?id=<id>` op (publieke link). Ook niet in `raw`.
- `packages/core/cpm.ts`: CPM-band per land (NL €6–12) × frequentie 1,2–2,5 (bereik ≠ impressies)
- `apps/workers`:
  - `ads/ingest.ts`: `ingestAds` (adverteerders + ads upsert, landen samenvoegen, koppelen aan shops,
    adverteerder aan shop koppelen, onbekende domeinen => `shop.detect`), `syncAdvertiser`
    (job `ads.sync_advertiser`), `discoverAds` (job `ads.discover`, nieuwe adverteerders => sync)
  - `data/ad-keywords.nl.txt`: 21 zoekwoorden (NL/EN/FR)
  - CLI: `pnpm workers ads --page-id=<id>` en `pnpm workers ads --keyword=<woord> --country=NL`
  - Ads-jobs registreren alleen als `META_ACCESS_TOKEN` gezet is
- Tests: client (paginering, parameters, token-fout, rate limit, preventief wachten, token niet in fouten),
  mapping, CPM, ingest (in-memory) en integratietest met de echte client + opgeslagen responses naar Supabase

### Open

- Niet getest tegen de echte API: geen token, en `graph.facebook.com` is niet bereikbaar vanuit de
  cloud-sessie. Lokaal: token in `.env.local`, dan `pnpm workers ads --page-id=<page id>`.
- `media_type` is altijd `unknown`: de API geeft geen mediatype of thumbnails terug. Creatives tonen
  we via de Ad Library-link; echte thumbnails vragen om een aparte oplossing (niet scrapen).
- `cta` is leeg: de API geeft het CTA-type niet terug.
- De Graph API-versie staat op v23.0 (`META_API_VERSION`); controleer bij livegang de nieuwste versie.

## Prompt 6: e-mail library via seed-inboxen — klaar (2026-11-15)

- Migratie `20261115020000_email_library.sql`: `seed_inboxes` (uniek adres per shop, `subscribed_at`),
  extra kolommen op `emails` (seed_inbox_id, to_address, message_id uniek per shop, text_preview),
  `inbound_rejects`, privé storage-bucket `emails`
- `packages/core`:
  - `email-address.ts`: onraadbaar seed-adres (`<slug>-<6 tekens>@<domein>`), adressen uit headers
  - `email-sanitize.ts`: sanitizer (sanitize-html, allowlist) + tracking-pixels, afmeldlinks en
    seed-adres weg; `extractPreheader()`
  - `email-classify.ts`: welcome / flow / campaign + `flow_step`
  - `email-inbound.ts`: Postmark- en Mailgun-payloads, Basic-auth- en HMAC-handtekeningcheck
- `packages/db/email-ingest.ts`: gedeelde verwerking (koppelen, dedupe, opschonen, Storage, insert,
  herclassificeren) + seed-inbox beheer
- `apps/web`: `POST /api/inbound/postmark` en `/api/inbound/mailgun` (401 bij foute auth, 400 bij
  rommel, 200 bij onbekend adres zodat de provider niet blijft proberen). Next laadt nu de root-`.env.local`.
- `apps/workers`: IMAP-poller (`EMAIL_INBOUND_MODE=imap`), CLI `pnpm workers inbox ...`
- `docs/emails.md`: opzet, DNS, classificatie, tonen in sandboxed iframe, privacy
- Getest: unit tests (o.a. XSS-varianten), integratietest naar database + storage, en end-to-end:
  curl naar de draaiende web-app => mail in 3,8 s bij de juiste shop als `welcome`, stap 1

### Open

- Admin-pagina voor seed-inboxen: nu alleen CLI. Komt bij de admin-omgeving (Prompt 7/8, er is nog geen login).
- Niet getest met een echte provider/DNS (geen domein in de cloud-sessie). Het Postmark-formaat is
  nagebootst volgens hun docs.

## Prompt 7: job scheduler en monitoring — klaar (2026-11-15), Docker-image niet gebouwd

- Planning via pg-boss schedules (zie `docs/workers.md`): snapshots en adverteerder-syncs gespreid
  over 24 uur (hash per shop/pagina), gevolgde shops van betalende workspaces 2× per dag met
  voorrang, elk uur discovery + roterende zoekwoorden, dagelijks growth_score + opruimen
- Concurrency per jobtype (`CONCURRENCY_*`), max 1 job per domein via Postgres advisory lock,
  retries met backoff
- Migratie `20261115030000_job_monitoring.sql`: `job_runs`, `system_alerts`, `is_admin()`,
  `admin_queue_stats()` (pg-boss wachtrij), `prune_job_runs()`
- Alert als > 20% faalt (min. 10 jobs, cooldown 1 uur) naar `ALERT_WEBHOOK_URL` (n8n)
- Health-endpoint `:8080/health`
- Web: `/admin/jobs` en `/admin/inboxes` (seed-inboxen beheren, was nog open uit Prompt 6),
  tijdelijk achter Basic auth (`ADMIN_PASSWORD`, middleware)
- `apps/workers/Dockerfile`, `docker-compose.yml` (+ profiel `scale`), `.dockerignore`
- CLI: `pnpm workers enqueue <job> [--domain=x]`
- Getest: planner, buckets, alertlogica (unit); advisory lock, job_runs en alert + cooldown tegen
  Postgres (integratie); workers lokaal gestart: health 200, planner-jobs draaien en verschijnen in
  `/admin/jobs` (screenshot gecheckt); compose-file geldig

### Open

- `docker compose up` niet echt gedraaid: Docker Hub (429) en de AWS-mirror zijn geblokkeerd in de
  cloud-sessie. De Dockerfile-stappen (gefilterde install + `node --import tsx`) zijn in een lege map
  nagespeeld en werken; bouw het image op je VPS of lokaal.
- `/admin` gaat in Prompt 8 over op Supabase Auth + `profiles.is_admin`.

## Prompt 8: dashboard-basis, shops en shop-detail — klaar (2026-11-15)

- Migratie `20261115040000_dashboard.sql`: `shops.niche` + `shops.active_ads_count` (trigger op ads),
  `ads.run_days_final`, view `advertiser_stats`, `lookup_requests`, `shop_events`, `shop_facets()`
- Login: magic link (`/login`, `/auth/confirm`) en Google (`/auth/callback`, knop achter
  `NEXT_PUBLIC_GOOGLE_LOGIN`), uitloggen, middleware beschermt `/app` en `/admin`. Zie `docs/auth.md`.
- `/admin` nu via `profiles.is_admin` (Basic auth is weg); `pnpm workers admin --email=...`
- next-intl: NL standaard, EN via knop (cookie + profiel), 246 sleutels in `messages/{nl,en}.json`
- `packages/core/filters.ts`: zod-schema's voor shop-, ad-, e-mail- en adverteerderfilters
  (gedeeld met API/MCP), `parseFilters` (kapotte waarden vallen weg), `toQueryString`
- `packages/db/queries/*`: shops (lijst, detail, snapshots, producten, bestsellers, events, facets),
  ads, adverteerders, e-mails, folders, brandtracker, lookups
- Dashboard `/app`: sidebar, zoekbalk (naam => lijst, domein => shop, onbekend => lookup)
  - `/app/shops`: tabel met filters in de URL (land, niche, thema, app, omzet, ads, groei, eerst
    gezien), sorteren en paginering aan de serverkant
  - `/app/shops/[domain]`: tabs Overzicht (schatting als bandbreedte + betrouwbaarheid + uitleg,
    twee grafieken met hover en tabelweergave), Producten, Ads, E-mails, Tech; "Volg in Brandtracker"
    en "Opslaan in folder"
  - onbekend domein: lookup-status die elke 3 s ververst
- Workers: lookup-dispatcher (pakt `lookup_requests` op met voorrang), feed-events bij snapshots,
  ads en e-mails, niche per shop
- `/schattingen`: publieke uitleg van het schattingsmodel (NL/EN)
- Getest: unit + integratie (queries tegen de seed), en in de browser met Playwright: magic link
  uit de lokale mailbox, filteren, sorteren, shop-detail, volgen, opslaan, zoeken, lookup, EN,
  404 op /admin voor niet-admins, uitloggen

### Open

- Google-login niet getest (OAuth-client van de gebruiker nodig).
- Lookup van een echt domein blijft in de cloud-sessie op "ophalen" staan (geen netwerk naar shops).
- Logo's: letter-avatar; we laden geen afbeeldingen van externe sites.

## Volgende: Prompt 9 — ads library, e-mail library, folders en Brandtracker
