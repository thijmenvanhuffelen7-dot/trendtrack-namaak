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

- `supabase start` is nog niet gedraaid (geen Docker-daemon in de cloud-sessie); doe dit lokaal of in Prompt 2.
- next-intl (NL/EN) komt in Prompt 8, Supabase Auth ook.

## Volgende: Prompt 2 — database-schema
