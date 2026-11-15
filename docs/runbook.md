# Runbook

Wat te doen als er iets misgaat. Eerst altijd: `/admin/jobs` (fouten per jobtype) en de health-checks.

## Snel overzicht

| Signaal                  | Waar kijken                                                                |
| ------------------------ | -------------------------------------------------------------------------- |
| Site of API down         | `https://jouwdomein.nl/api/health`, Vercel → Deployments → Logs            |
| MCP-connector werkt niet | `https://<MCP_DOMAIN>/health`, `docker compose logs --tail=200 mcp caddy`  |
| Data ververst niet       | `/admin/jobs`, `docker compose logs --tail=200 workers`                    |
| Veel mislukte jobs       | melding via `ALERT_WEBHOOK_URL`, daarna `/admin/jobs` → recente fouten     |
| Betaling komt niet door  | Stripe → Developers → Webhooks → endpoint → mislukte events opnieuw sturen |

## Workers herstarten

```bash
cd ~/trendtrack
docker compose ps
docker compose restart workers          # herstart; lopende jobs worden opnieuw opgepakt (pg-boss)
docker compose logs -f --tail=100 workers
```

Na een code-update: `git pull && docker compose up -d --build workers mcp`.

Een job handmatig starten (bv. na een storing):

```bash
docker compose exec workers pnpm cli enqueue scheduler.hourly_shops
docker compose exec workers pnpm cli enqueue shop.snapshot --domain=voorbeeld.nl
```

Hangt de wachtrij (jobs blijven "active")? pg-boss zet ze na de timeout terug. Kijk in `/admin/jobs` naar
de wachtrij; een herstart van de workers is veilig.

## Meta-token verlopen

Symptoom: alle `ads.*`-jobs falen met `OAuthException` / code 190, of de alert meldt veel fouten bij ads.

1. Maak een nieuw token: Meta for Developers → je app → Tools → Graph API Explorer, of beter een
   **system user token** in Business Manager (verloopt niet) met toegang tot de Ad Library API.
   De Ad Library API vereist een geverifieerde identiteit bij Meta.
2. Zet het in `.env.production` (`META_ACCESS_TOKEN=...`).
3. `docker compose up -d workers` (leest de env opnieuw in).
4. Controleer: `docker compose exec workers pnpm cli enqueue scheduler.hourly_ads` en kijk in
   `/admin/jobs` of `ads.sync_advertiser` slaagt.

Ads die in de tussentijd zijn gemist halen we vanzelf in: de sync haalt per adverteerder de actuele ads op.

## Shop blokkeert ons

Normaal gedrag: de shop krijgt status `blocked` en we proberen het niet opnieuw te omzeilen. Niets doen.

## Opt-out-verzoek

`/admin/opt-out`. Controleer of het e-mailadres bij het domein hoort (het label "zelfde domein"), of mail de
eigenaar via het adres op de website. Goedkeuren verwijdert de shop met alle producten, snapshots,
schattingen en mails, zet het domein op de blokkadelijst (geen enkele job, lookup of gratis tool raakt
het nog aan) en kan niet ongedaan worden gemaakt. Reageer binnen 5 werkdagen.

## Database vol of traag

- Grootste tabellen: `select relname, pg_size_pretty(pg_total_relation_size(relid)) from pg_statio_user_tables order by pg_total_relation_size(relid) desc limit 10;`
- `job_runs` ouder dan 30 dagen en de rate-counters worden dagelijks opgeruimd (`scheduler.daily_maintenance`).
- `product_snapshots` groeit het hardst; overweeg snapshots ouder dan 18 maanden te aggregeren.

## Backup terugzetten

```bash
ls -lh backups/
pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" backups/trendtrack-<datum>.dump
```

Eerst op staging testen. Bij een echte calamiteit: Supabase-dashboard → Database → Backups
(point-in-time restore op het Pro-plan) is meestal sneller.

## Geheim gelekt

1. Service-role key: Supabase → Settings → API → **roll** de JWT-secret (alle sessies worden uitgelogd).
   Daarna nieuwe keys in Vercel en `.env.production`, redeploy en `docker compose up -d`.
2. Stripe-key: rollen in het Stripe-dashboard. Webhook-secret: endpoint opnieuw aanmaken.
3. API-key of OAuth-token van een klant: de klant trekt hem in onder /app/api of /app/mcp; als admin kun je
   `api_keys.revoked_at` of `oauth_tokens` direct bijwerken.
