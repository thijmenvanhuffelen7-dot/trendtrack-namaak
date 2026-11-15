# TrendTrack Benelux

E-commerce intelligence platform (zoals trendtrack.io), gericht op de Benelux: NL/BE-webshops en
ads die in de EU draaien. Gebruikers onderzoeken en volgen Shopify-stores, hun producten, hun
Meta-ads en hun e-mails via een webdashboard, een publieke REST API en een MCP-server.

Het bouwplan staat in 14 prompts; de voortgang staat in `docs/progress.md`. Lees die eerst.

## Mappenstructuur

```
apps/web        Next.js (App Router) + Tailwind v4 + shadcn/ui. Dashboard, publieke site, REST API (/api/v1)
apps/workers    Node + TypeScript. Crawlers en jobs via pg-boss (wachtrij in Postgres)
apps/mcp        Remote MCP-server (@modelcontextprotocol/sdk, Streamable HTTP op /mcp)
packages/db     Supabase-client, gegenereerde types (database.gen.ts) en gedeelde queries
packages/core   Gedeelde logica: schattingsmodellen, URL-normalisatie, types, plannen
supabase/       Supabase CLI-config, migraties en seed
data/           Seedlijsten (domeinen, ad-zoekwoorden)
docs/           progress.md, estimation.md, auth.md, emails.md, workers.md
```

Workspace-packages exporteren TypeScript-bron (`exports: ./src/index.ts`); er is geen build-stap
voor packages. Next transpileert ze via `transpilePackages`, workers en mcp draaien via `tsx`.

## Codeerregels

- TypeScript `strict` (+ `noUncheckedIndexedAccess`). Geen `any` zonder reden in een comment.
- Valideer alle externe invoer (HTTP, env, API-responses, job-payloads) met **zod**.
- **Geen secrets in code.** Alles via env; voorbeeld in `.env.example`, echte waarden in `.env.local`.
  De service-role key nooit in de browser of in `NEXT_PUBLIC_*`.
- Kleine, pure functies met unit tests (Vitest, `*.test.ts` naast de code).
  Tests doen geen echte netwerkcalls: gebruik fixtures.
- Geschatte getallen (omzet, spend) altijd als bandbreedte `{ low, mid, high, confidence, estimate: true }`.
- Data alleen via officiële/publieke bronnen. Geen scraping van de Meta Ad Library-website.
  Shops die blokkeren markeren we als `blocked`, we omzeilen dat niet.
- Logica die web, API en MCP delen hoort in `packages/core` of `packages/db`, niet gedupliceerd.
- Web: lezen met de sessie van de gebruiker (`getSession().db`, RLS); schrijven via server actions
  met `serviceDb()` na `getSession()`. UI-teksten via next-intl (`messages/nl.json` en `en.json`,
  zelfde sleutels). Filters en queries komen uit `packages/core/filters.ts` en `packages/db/queries`.
- Commit na elke afgeronde stap en werk `docs/progress.md` bij.

## Lokaal draaien

Vereist: Node 22+, pnpm 10, Docker (voor Supabase lokaal).

```bash
pnpm install
cp .env.example .env.local        # vul de keys in
pnpm db:start                     # lokale Supabase (Docker); toont de keys
pnpm dev                          # web-app op http://localhost:3000
pnpm --filter workers dev         # workers (DATABASE_URL nodig)
pnpm mcp                          # MCP-server op http://localhost:3333/mcp
docker compose up -d --build      # workers op een VPS (zie docs/workers.md)
```

## Testen en checks

```bash
pnpm lint
pnpm typecheck
pnpm test            # alle Vitest-projecten
pnpm format:check
pnpm test:db         # integratietests tegen de lokale Supabase (mogen testdata wissen)
pnpm db:reset        # migraties + seed opnieuw
pnpm db:types        # TS-types genereren naar packages/db/src/database.gen.ts
```

CI (`.github/workflows/ci.yml`) draait lint, typecheck, tests en format-check.
