# MCP-server

`apps/mcp`: remote MCP-server (officiële TypeScript SDK), Streamable HTTP op `/mcp`, stateless.

## Tools

| Tool                                                              | Wat                                                                              | Alleen lezen |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------ |
| `list_filters`                                                    | landen, niches, thema's (eerst aanroepen bij een categorie als "sieraden")       | ja           |
| `search_shops`                                                    | shops op land, niche, thema, app, omzet, ads, groei                              | ja           |
| `get_shop`                                                        | schattingen, tech, samenvatting ads/e-mails, laatste 7 dagen                     | ja           |
| `get_shop_products`                                               | producten, nieuwste of duurste eerst                                             | ja           |
| `search_ads`                                                      | ads; `group_by: "shop"` telt per shop (voor "welke shops draaien de meeste ...") | ja           |
| `get_ad`, `search_advertisers`, `get_advertiser`, `search_emails` |                                                                                  | ja           |
| `lookup_domain`                                                   | onbekend domein laten ophalen                                                    | nee          |
| `track_brand`, `get_brand_changes`                                | Brandtracker                                                                     | nee / ja     |

- Max 50 items per antwoord, meer via `cursor`. Lange teksten worden ingekort.
- Elke call loopt via `checkAndRecordUsage` (`api_call`, source `mcp`): hetzelfde maandquotum
  als de REST API. Zonder Pro/Agency krijgt de AI een nette uitleg met upgrade-link.
- Queries en serializers komen uit `packages/db` (`@trendtrack/db/public-api`), gedeeld met de REST API.
- Elke call wordt gelogd als JSON-regel (tool, workspace, duur, ok).

## Authenticatie

1. **OAuth 2.1** (voor Claude, ChatGPT, Cursor). De web-app is de autorisatieserver:
   - `GET /.well-known/oauth-protected-resource` (MCP-server) wijst naar de web-app
   - `GET /.well-known/oauth-authorization-server`, `POST /oauth/register` (dynamic client registration),
     `GET /oauth/authorize` (inloggen + toestemming), `POST /oauth/token` (code + PKCE S256, refresh met rotatie)
   - Tokens en codes alleen gehasht in de database. Access-token 1 uur, refresh-token 30 dagen.
   - Redirect-URI's: alleen https of http op localhost. Onbekende redirect = foutpagina, geen doorsturen.
   - Verbonden apps intrekken op `/app/mcp`.
2. **API-key**: `Authorization: Bearer tt_live_...` (dezelfde keys als de REST API).

Zonder token: `401` met `WWW-Authenticate: Bearer resource_metadata="..."`, zodat clients de flow starten.

## Lokaal

```bash
pnpm mcp                                        # http://localhost:3333/mcp
npx @modelcontextprotocol/inspector             # UI; kies Streamable HTTP + de URL
npx @modelcontextprotocol/inspector --cli http://localhost:3333/mcp --transport http \
  --method tools/list --header "Authorization: Bearer tt_live_..."
```

## Productie

- Draai `apps/mcp` met Docker (`docker compose up -d mcp`) achter HTTPS (zie docs/runbook.md).
- Zet `MCP_PUBLIC_URL=https://mcp.jouwdomein.nl`, `WEB_PUBLIC_URL=https://jouwdomein.nl` en in de
  web-app `NEXT_PUBLIC_MCP_URL`. Claude en ChatGPT kunnen alleen een publieke https-URL toevoegen.
