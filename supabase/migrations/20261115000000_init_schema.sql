-- =============================================================================
-- TrendTrack Benelux — basisschema
-- Openbare data (shops, products, ads, emails): lezen voor ingelogde gebruikers.
-- Workspace-data (folders, tracked_brands, api_keys, ...): lezen voor leden.
-- Alle writes lopen via de service role (server-side, na limiet-checks).
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.shop_status as enum ('active', 'blocked', 'dead');
create type public.ad_platform as enum ('meta', 'tiktok', 'google');
create type public.email_type as enum ('welcome', 'flow', 'campaign');
create type public.workspace_role as enum ('owner', 'admin', 'member');
create type public.folder_item_type as enum ('ad', 'shop', 'email');
create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid'
);

-- Generieke updated_at-trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Openbare data: shops & producten
-- ---------------------------------------------------------------------------
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique
    check (domain = lower(domain) and domain !~ '^www\.' and domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  name text,
  country text check (country ~ '^[A-Z]{2}$'),
  currency text check (currency ~ '^[A-Z]{3}$'),
  platform text,
  theme_name text,
  apps jsonb not null default '[]'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_crawled_at timestamptz,
  status public.shop_status not null default 'active',
  -- Schattingen: altijd bandbreedte + confidence (zie docs/estimation.md)
  est_monthly_revenue numeric(14, 2),
  est_monthly_revenue_low numeric(14, 2),
  est_monthly_revenue_high numeric(14, 2),
  est_monthly_orders integer,
  est_confidence real check (est_confidence between 0 and 1),
  growth_score real,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shops_country_idx on public.shops (country);
create index shops_growth_score_idx on public.shops (growth_score desc nulls last);
create index shops_status_idx on public.shops (status);
create index shops_theme_idx on public.shops (theme_name);
create index shops_first_seen_idx on public.shops (first_seen_at desc);
create index shops_revenue_idx on public.shops (est_monthly_revenue desc nulls last);
create index shops_apps_idx on public.shops using gin (apps jsonb_path_ops);
create index shops_name_trgm_idx on public.shops using gin (name extensions.gin_trgm_ops);
create trigger shops_updated_at before update on public.shops
  for each row execute function public.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  external_id text not null,
  handle text,
  title text not null,
  product_type text,
  vendor text,
  price_min numeric(12, 2),
  price_max numeric(12, 2),
  compare_at_price numeric(12, 2),
  image_url text,
  tags text[] not null default '{}',
  created_at_shop timestamptz,
  published_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  fts tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(product_type, '') || ' ' || coalesce(vendor, ''))
  ) stored,
  unique (shop_id, external_id)
);
create index products_shop_idx on public.products (shop_id);
create index products_type_idx on public.products (product_type);
create index products_published_idx on public.products (shop_id, published_at desc);
create index products_fts_idx on public.products using gin (fts);

create table public.product_snapshots (
  product_id uuid not null references public.products (id) on delete cascade,
  captured_on date not null,
  price numeric(12, 2),
  available_variants integer,
  inventory_signal jsonb,
  position_in_bestsellers integer,
  primary key (product_id, captured_on)
);
create index product_snapshots_date_idx on public.product_snapshots (captured_on);

create table public.shop_snapshots (
  shop_id uuid not null references public.shops (id) on delete cascade,
  captured_on date not null,
  product_count integer,
  new_products integer,
  est_daily_revenue numeric(14, 2),
  active_ads_count integer,
  primary key (shop_id, captured_on)
);
create index shop_snapshots_date_idx on public.shop_snapshots (captured_on);

-- ---------------------------------------------------------------------------
-- Openbare data: adverteerders & ads
-- ---------------------------------------------------------------------------
create table public.advertisers (
  id uuid primary key default gen_random_uuid(),
  platform public.ad_platform not null,
  page_id text not null,
  page_name text,
  shop_id uuid references public.shops (id) on delete set null,
  country text check (country ~ '^[A-Z]{2}$'),
  first_seen_at timestamptz not null default now(),
  last_synced_at timestamptz,
  unique (platform, page_id)
);
create index advertisers_shop_idx on public.advertisers (shop_id);
create index advertisers_name_trgm_idx on public.advertisers using gin (page_name extensions.gin_trgm_ops);

create table public.ads (
  id uuid primary key default gen_random_uuid(),
  platform public.ad_platform not null,
  external_id text not null,
  advertiser_id uuid references public.advertisers (id) on delete set null,
  shop_id uuid references public.shops (id) on delete set null,
  body text,
  title text,
  cta text,
  landing_url text,
  landing_domain text,
  media_type text check (media_type in ('image', 'video', 'carousel', 'unknown')),
  media_urls text[] not null default '{}',
  snapshot_url text,
  started_at timestamptz,
  ended_at timestamptz,
  is_active boolean not null default true,
  eu_total_reach bigint,
  -- Schatting (Meta geeft geen spend voor commerciële ads): reach/1000 × CPM-band
  est_spend_low numeric(14, 2),
  est_spend_high numeric(14, 2),
  countries text[] not null default '{}',
  languages text[] not null default '{}',
  raw jsonb,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fts tsvector generated always as (
    to_tsvector('simple', coalesce(body, '') || ' ' || coalesce(title, ''))
  ) stored,
  unique (platform, external_id)
);
create index ads_landing_domain_idx on public.ads (landing_domain);
create index ads_is_active_idx on public.ads (is_active, started_at desc);
create index ads_started_at_idx on public.ads (started_at desc);
create index ads_shop_idx on public.ads (shop_id);
create index ads_advertiser_idx on public.ads (advertiser_id);
create index ads_reach_idx on public.ads (eu_total_reach desc nulls last);
create index ads_countries_idx on public.ads using gin (countries);
create index ads_languages_idx on public.ads using gin (languages);
create index ads_fts_idx on public.ads using gin (fts);
create trigger ads_updated_at before update on public.ads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Openbare data: e-mails
-- ---------------------------------------------------------------------------
create table public.emails (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  from_address text not null,
  subject text,
  preheader text,
  html_storage_path text,
  received_at timestamptz not null,
  type public.email_type not null default 'campaign',
  flow_step integer,
  created_at timestamptz not null default now()
);
create index emails_shop_received_idx on public.emails (shop_id, received_at desc);
create index emails_type_idx on public.emails (type);
create index emails_received_idx on public.emails (received_at desc);

-- ---------------------------------------------------------------------------
-- Gebruikers & workspaces
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  locale text not null default 'nl' check (locale in ('nl', 'en')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workspaces_owner_idx on public.workspaces (owner_id);
create trigger workspaces_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);

-- Lidmaatschapscheck voor RLS. SECURITY DEFINER voorkomt recursie in policies
-- op workspace_members zelf.
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_workspace_member(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;

-- Nieuwe gebruiker: profiel + persoonlijke workspace aanmaken.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  ws_id uuid;
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  insert into public.workspaces (name, owner_id)
    values (coalesce(split_part(new.email, '@', 1), 'Mijn') || ' workspace', new.id)
    returning id into ws_id;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws_id, new.id, 'owner');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Plannen, abonnementen, gebruik, API-keys
-- ---------------------------------------------------------------------------
create table public.plans (
  id text primary key,                         -- 'free', 'starter', 'pro', 'agency'
  name text not null,
  monthly_price_cents integer not null default 0,
  limits jsonb not null default '{}'::jsonb,   -- bron van waarheid: packages/core/plans.ts
  is_public boolean not null default true,
  sort_order integer not null default 0
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  plan_id text not null references public.plans (id),
  status public.subscription_status not null,
  provider text not null default 'stripe' check (provider in ('stripe', 'mollie', 'manual')),
  provider_subscription_id text,
  billing_interval text check (billing_interval in ('month', 'quarter', 'year')),
  seats integer not null default 1,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_id)
);
create index subscriptions_workspace_idx on public.subscriptions (workspace_id, status);
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.usage_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  action text not null,            -- bv. 'shop_lookup', 'ad_search', 'api_call', 'mcp_call'
  source text not null default 'web' check (source in ('web', 'api', 'mcp', 'system')),
  quantity integer not null default 1,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index usage_events_ws_action_time_idx on public.usage_events (workspace_id, action, created_at desc);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  name text not null,
  prefix text not null,                   -- eerste tekens (bv. 'tt_live_ab12'), om te herkennen
  key_hash text not null unique,          -- sha-256 van de volledige key; de key zelf slaan we nooit op
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index api_keys_workspace_idx on public.api_keys (workspace_id);

-- ---------------------------------------------------------------------------
-- Folders & Brandtracker
-- ---------------------------------------------------------------------------
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  name text not null,
  share_token text unique,                -- leesbare deellink; null = niet gedeeld
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index folders_workspace_idx on public.folders (workspace_id);
create trigger folders_updated_at before update on public.folders
  for each row execute function public.set_updated_at();

create table public.folder_items (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.folders (id) on delete cascade,
  item_type public.folder_item_type not null,
  item_id uuid not null,                  -- polymorf: ads.id, shops.id of emails.id
  note text,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (folder_id, item_type, item_id)
);
create index folder_items_item_idx on public.folder_items (item_type, item_id);

create table public.tracked_brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  daily_digest boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, shop_id)
);
create index tracked_brands_shop_idx on public.tracked_brands (shop_id);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.product_snapshots enable row level security;
alter table public.shop_snapshots enable row level security;
alter table public.advertisers enable row level security;
alter table public.ads enable row level security;
alter table public.emails enable row level security;
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_events enable row level security;
alter table public.api_keys enable row level security;
alter table public.folders enable row level security;
alter table public.folder_items enable row level security;
alter table public.tracked_brands enable row level security;

-- Openbare data: alleen lezen, alleen ingelogd
create policy "shops_read" on public.shops for select to authenticated using (true);
create policy "products_read" on public.products for select to authenticated using (true);
create policy "product_snapshots_read" on public.product_snapshots for select to authenticated using (true);
create policy "shop_snapshots_read" on public.shop_snapshots for select to authenticated using (true);
create policy "advertisers_read" on public.advertisers for select to authenticated using (true);
create policy "ads_read" on public.ads for select to authenticated using (true);
create policy "emails_read" on public.emails for select to authenticated using (true);

-- Plannen zijn publiek (prijzenpagina)
create policy "plans_read" on public.plans for select to anon, authenticated using (is_public);

-- Eigen profiel
create policy "profiles_read_own" on public.profiles for select to authenticated
  using (id = (select auth.uid()));

-- Workspace-data: alleen leden
create policy "workspaces_read" on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));
create policy "workspace_members_read" on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy "subscriptions_read" on public.subscriptions for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy "usage_events_read" on public.usage_events for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy "api_keys_read" on public.api_keys for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy "folders_read" on public.folders for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy "folder_items_read" on public.folder_items for select to authenticated
  using (exists (
    select 1 from public.folders f
    where f.id = folder_id and public.is_workspace_member(f.workspace_id)
  ));
create policy "tracked_brands_read" on public.tracked_brands for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- Geen insert/update/delete-policies: schrijven gaat alleen via de service role.
-- Extra slot op de deur: anon/authenticated mogen niet schrijven, ook niet als
-- er later per ongeluk een te ruime policy bijkomt.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon, authenticated;

-- De hash van een API-key is nooit leesbaar voor clients.
revoke select on public.api_keys from anon, authenticated;
grant select (id, workspace_id, created_by, name, prefix, last_used_at, revoked_at, created_at)
  on public.api_keys to authenticated;

-- Anon ziet geen openbare data (alleen plannen); expliciet intrekken.
revoke select on all tables in schema public from anon;
grant select on public.plans to anon;
alter default privileges in schema public revoke select on tables from anon;
