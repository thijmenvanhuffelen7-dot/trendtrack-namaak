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

## Volgende: Prompt 4 — dagelijkse snapshots en sales-schatting
