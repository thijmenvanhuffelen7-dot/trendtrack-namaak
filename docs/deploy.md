# Deploy

Drie onderdelen, elk op de plek die erbij past:

| Onderdeel                                            | Waar                                   | Waarom                                 |
| ---------------------------------------------------- | -------------------------------------- | -------------------------------------- |
| Web-app (site, dashboard, REST API, OAuth, webhooks) | **Vercel**, regio `fra1`               | Next.js, schaalt vanzelf, EU           |
| Database, auth, opslag                               | **Supabase** (EU-regio, bv. Frankfurt) | Postgres + RLS + magic links           |
| Workers, MCP-server, HTTPS, backups                  | **VPS** met Docker (bv. Hetzner, EU)   | lange processen, vaste IP voor crawlen |

## Omgevingen en variabelen

Gebruik drie omgevingen: **lokaal** (`.env.local`), **staging** en **productie**. Elk heeft een eigen
Supabase-project, eigen Stripe-modus (test voor staging, live voor productie) en eigen geheimen.
Alle variabelen staan met uitleg in `.env.example`.

| Variabele                                                                   | Vercel      | VPS (`.env.production`) | Opmerking                                                                               |
| --------------------------------------------------------------------------- | ----------- | ----------------------- | --------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`                 | ✓           |                         | publiek                                                                                 |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`                                 | ✓ (server)  | ✓                       | **nooit** `NEXT_PUBLIC_`                                                                |
| `DATABASE_URL`                                                              |             | ✓                       | directe verbinding (poort 5432), niet de pooler: pg-boss gebruikt LISTEN/advisory locks |
| `NEXT_PUBLIC_SITE_URL`                                                      | ✓           |                         | `https://jouwdomein.nl` (zet ook `upgrade-insecure-requests` aan)                       |
| `WEB_PUBLIC_URL`, `MCP_PUBLIC_URL`                                          | ✓           | ✓                       | OAuth-metadata van de MCP-server                                                        |
| `NEXT_PUBLIC_MCP_URL`                                                       | ✓           |                         | getoond op /app/mcp                                                                     |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PORTAL_CONFIGURATION` | ✓           |                         | live-keys alleen in productie                                                           |
| `RATE_LIMIT_SALT`                                                           | ✓           |                         | verplicht in productie (`openssl rand -hex 32`)                                         |
| `META_ACCESS_TOKEN`, `META_*`                                               |             | ✓                       | zie runbook voor verlopen tokens                                                        |
| `EMAIL_*`, `INBOUND_WEBHOOK_SECRET` / `MAILGUN_*` / `IMAP_*`                | ✓ (webhook) | ✓ (imap)                | zie docs/emails.md                                                                      |
| `CRAWLER_CONTACT`                                                           |             | ✓                       | URL of mailadres in de User-Agent                                                       |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `GIT_SHA`                               | ✓           | ✓                       | optioneel                                                                               |
| `MCP_DOMAIN`, `CADDY_EMAIL`, `BACKUP_*`                                     |             | ✓                       | Caddy en backups                                                                        |
| `ALERT_WEBHOOK_URL`                                                         |             | ✓                       | melding bij veel mislukte jobs                                                          |

## 1. Supabase

1. Maak een project in een EU-regio. Noteer URL, anon key, service-role key en de database-URL.
2. Koppel en zet de migraties erop:
   ```bash
   pnpm exec supabase link --project-ref <ref>
   pnpm exec supabase db push
   ```
   Draai `supabase/seed.sql` **niet** op productie (dat is testdata).
3. Auth → URL-configuratie: Site URL `https://jouwdomein.nl`, redirect `https://jouwdomein.nl/auth/callback`.
   E-mailtemplates en SMTP: zie docs/auth.md. Google-login optioneel.
4. Maak jezelf admin: `update profiles set is_admin = true where email = '...';`

## 2. Vercel (web)

1. Importeer de repo, **Root Directory** `apps/web` (staat in `apps/web/vercel.json`: install vanuit de
   monorepo-root, regio `fra1`).
2. Zet de variabelen uit de tabel, per omgeving (Preview = staging, Production = productie).
3. Domein koppelen. Controleer daarna `https://jouwdomein.nl/api/health` → `{"ok":true}`.

## 3. Stripe (live)

1. Maak producten en prijzen met de lookup keys: `pnpm --filter web stripe:setup` met de live
   `STRIPE_SECRET_KEY` (zie docs/billing.md). Zet de uitgevoerde `STRIPE_PORTAL_CONFIGURATION` in Vercel.
2. Webhook-endpoint `https://jouwdomein.nl/api/stripe/webhook` met de events
   `checkout.session.completed`, `customer.subscription.created|updated|deleted` en
   `invoice.payment_failed`. Zet de signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Test met een echte betaling van € 1 (tijdelijke prijs) of in test-modus op staging; controleer dat de
   workspace naar het juiste plan gaat en terugvalt na opzeggen.

## 4. VPS (workers, MCP, HTTPS, backups)

1. Ubuntu met Docker. DNS: `MCP_DOMAIN` (A-record) naar de server. Firewall: alleen 22, 80 en 443.
2. ```bash
   git clone <repo> trendtrack && cd trendtrack
   cp .env.example .env.production   # invullen
   docker compose up -d --build
   ```
   Dit start `workers`, `mcp`, `caddy` (Let's Encrypt-certificaat voor `MCP_DOMAIN`) en `backup`.
3. Controle: `curl https://<MCP_DOMAIN>/health` en `docker compose exec workers curl -s localhost:8080/health`.
4. Meer workers: `docker compose --profile scale up -d --scale worker-extra=2`.
5. Updates: `git pull && docker compose up -d --build`.

## 5. Uptime en meldingen

Zet een uptime-check (bv. Better Stack, UptimeRobot of een n8n-workflow) op:

- `https://jouwdomein.nl/api/health` (web + database; `workersActiveLastHour` moet `true` zijn)
- `https://<MCP_DOMAIN>/health` (MCP-server + database)
- workers: `:8080/health` is alleen lokaal; gebruik `workersActiveLastHour` hierboven of een tunnel.

Fouten gaan naar Sentry (of GlitchTip) als `SENTRY_DSN` gezet is: web (serverfouten), workers
(onverwachte jobfouten, geen blokkades of netwerkfouten van shops) en MCP. Zonder DSN alleen in de logs.

## 6. Backups

- Supabase maakt zelf dagelijkse backups (Pro-plan: point-in-time recovery mogelijk).
- Daarnaast draait op de VPS `scripts/backup.sh` elke 24 uur: `pg_dump` van `public` en `auth` naar
  `./backups`, 14 dagen bewaard, optioneel gekopieerd met rclone (`BACKUP_RCLONE_REMOTE`).
- **Test het terugzetten** elk kwartaal op een lege database:
  `pg_restore --clean --if-exists --no-owner -d "$STAGING_DATABASE_URL" backups/trendtrack-<datum>.dump`.

## Na de eerste deploy

- [ ] `pnpm e2e` tegen staging: `E2E_BASE_URL=https://staging... E2E_MCP_URL=https://.../mcp pnpm e2e`
      (met staging-keys in de omgeving; de upgrade-stap gebruikt de staging-webhook-secret)
- [ ] MCP-connector toevoegen in Claude (Instellingen → Connectors → `https://<MCP_DOMAIN>/mcp`)
- [ ] Privacyverklaring en voorwaarden laten nakijken, bedrijfsgegevens invullen
- [ ] `NEXT_PUBLIC_CONTACT_EMAIL` en `CRAWLER_CONTACT` op echte adressen
