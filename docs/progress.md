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

## Volgende: Prompt 3 — Shopify shop crawler
