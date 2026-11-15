# Inloggen en rechten

De web-app gebruikt Supabase Auth via `@supabase/ssr` (sessie in cookies, ververst door `src/middleware.ts`).

## Magic link (standaard)

1. Gebruiker vult een e-mailadres in op `/login`.
2. Supabase mailt een link naar `/auth/confirm?token_hash=...&type=email` (template in
   `supabase/templates/magic_link.html`). Die werkt ook als je de mail in een andere browser opent.
3. Nieuwe gebruikers krijgen automatisch een profiel en een eigen workspace (database-trigger).

Lokaal komen mails in Mailpit: http://127.0.0.1:54324.

**Productie:** zet in het Supabase-dashboard (Authentication → Emails) dezelfde template voor
"Magic Link" en "Confirm signup", stel een eigen SMTP-provider in (de ingebouwde mailer is beperkt
tot een paar mails per uur) en zet Site URL + Redirect URLs op je eigen domein
(`https://jouwdomein.nl/auth/callback`). Zet `NEXT_PUBLIC_SITE_URL`.

## Google

1. Google Cloud Console → APIs & Services → Credentials → OAuth client (Web).
   Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
   (lokaal: `http://127.0.0.1:54321/auth/v1/callback`).
2. Supabase-dashboard → Authentication → Providers → Google: client ID en secret invullen.
   Lokaal: in `supabase/config.toml` onder `[auth.external.google]` `enabled = true` en de
   client ID/secret via `env(...)`.
3. Zet `NEXT_PUBLIC_GOOGLE_LOGIN=true`; dan verschijnt de knop "Doorgaan met Google".

De terugkeer loopt via `/auth/callback?code=...`.

## Wie mag wat

- `/app/*` en `/admin/*`: alleen ingelogd (middleware stuurt anders naar `/login?next=...`).
- Lezen in het dashboard gaat met de sessie van de gebruiker, dus via RLS.
- Schrijven (folder maken, shop volgen, lookup aanvragen) gaat via server actions: eerst
  `getSession()`, dan de service client. Zo komen de limieten uit Prompt 10 op één plek.
- `/admin`: alleen `profiles.is_admin`. Anderen krijgen een 404. Server actions in admin checken
  het opnieuw.

Eerste admin maken (na één keer inloggen):

```bash
pnpm workers admin --email=jij@voorbeeld.nl
```

## Taal

Nederlands is de standaard, Engels via de knop in de sidebar. De keuze staat in de cookie `locale`
en in `profiles.locale`. Teksten: `apps/web/messages/nl.json` en `en.json` (zelfde sleutels).
