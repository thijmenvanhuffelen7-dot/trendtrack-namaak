# Workers: planning, monitoring en draaien op een VPS

## Planning (pg-boss schedules, tijdzone Europe/Amsterdam)

| Wanneer         | Job                           | Wat                                                                                                                                                                                                                |
| --------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| elk uur :05     | `scheduler.hourly_shops`      | `shop.snapshot` voor 1/24 van de actieve shops (vast uur per shop via hash). Shops in de Brandtracker van een betalende workspace (actief of proef, niet gratis): twee keer per dag en met voorrang (priority 10). |
| elk uur :15     | `scheduler.hourly_ads`        | `ads.sync_advertiser` voor 1/24 van de adverteerders; die van gevolgde shops eerst.                                                                                                                                |
| elk uur :25     | `scheduler.hourly_discovery`  | `shop.discover` (nieuwe domeinen uit ads + seedlijst → `shop.detect`) en `ads.discover` voor de volgende `KEYWORDS_PER_HOUR` zoekwoorden × `META_COUNTRIES`.                                                       |
| dagelijks 03:30 | `scheduler.daily_maintenance` | growth_score herberekenen voor alle actieve shops; `job_runs` ouder dan 30 dagen opruimen.                                                                                                                         |
| elke 10 min     | `monitor.failures`            | Alert als > 20% van de jobs in het afgelopen uur faalde (min. 10 jobs), max. één melding per uur.                                                                                                                  |

Handmatig: `pnpm workers enqueue scheduler.hourly_shops` of `pnpm workers enqueue shop.snapshot --domain=x.nl`.

## Limieten

- **Concurrency per jobtype**: `CONCURRENCY_*` (aantal parallelle workers per proces).
- **Per domein max 1 tegelijk**: Postgres advisory lock (`withDomainLock`), werkt ook met meerdere
  servers. Is een domein bezig, dan faalt de job met `DomainBusyError` en probeert pg-boss het
  later opnieuw (retry met backoff, max 5).
- **Per domein max 1 request/s**: `PoliteFetcher` (Prompt 3).
- Ads-jobs staan alleen aan als `META_ACCESS_TOKEN` gezet is.

## Monitoring

- Elke run staat in `job_runs` (status, duur, fout, resultaat).
- `/admin/jobs`: per jobtype het foutpercentage en de gemiddelde duur (24 uur), de wachtrij van pg-boss,
  recente fouten en de laatste 50 runs. Beveiligd met `ADMIN_PASSWORD` (Basic auth) tot Prompt 8.
- `GET :8080/health`: 200 als de database bereikbaar is, met tijd van de laatste run. Gebruik dit voor
  Docker en je uptime-check.
- Alerts: `ALERT_WEBHOOK_URL` krijgt `POST { source, text, stats }`. Maak in n8n een Webhook-node →
  e-mail/Slack. Zonder URL komt de melding alleen in de logs.

## Op een VPS (Docker)

```bash
git clone <repo> && cd trendtrack-namaak
cp .env.example .env.production   # invullen; DATABASE_URL = de Supabase-connection string (geen 127.0.0.1!)
docker compose up -d --build
docker compose ps                 # status "healthy"
curl localhost:8080/health
docker compose logs -f workers
```

- Gebruik voor `DATABASE_URL` de **session pooler** of directe verbinding van Supabase, niet de
  transaction pooler: pg-boss en advisory locks hebben sessies nodig.
- Meer capaciteit: `docker compose --profile scale up -d --scale worker-extra=2` (extra workers zonder scheduler).
- Docker Hub rate limits? Bouw met een andere bron: `--build-arg NODE_IMAGE=<mirror>/node:22-slim`.
