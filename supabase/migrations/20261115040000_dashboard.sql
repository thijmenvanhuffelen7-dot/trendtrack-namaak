-- Dashboard (Prompt 8/9): niche en ad-tellingen op shops, lookups, events-feed, statistieken.

-- --- Shops: niche en actieve ads (gedenormaliseerd, voor filteren en sorteren) -------------
alter table public.shops
  add column niche text,                                   -- meest voorkomende product_type
  add column active_ads_count integer not null default 0;
create index shops_niche_idx on public.shops (niche);
create index shops_active_ads_idx on public.shops (active_ads_count desc);

create or replace function public.refresh_shop_ad_count(target uuid)
returns void language sql security definer set search_path = '' as $$
  update public.shops s
     set active_ads_count = (select count(*) from public.ads a where a.shop_id = target and a.is_active)
   where s.id = target;
$$;
revoke all on function public.refresh_shop_ad_count(uuid) from public, anon, authenticated;

create or replace function public.ads_refresh_shop_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.shop_id is not null then
    perform public.refresh_shop_ad_count(old.shop_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.shop_id is not null
     and (tg_op = 'INSERT' or new.shop_id is distinct from old.shop_id or new.is_active is distinct from old.is_active) then
    perform public.refresh_shop_ad_count(new.shop_id);
  end if;
  return null;
end;
$$;
create trigger ads_shop_count after insert or delete or update of shop_id, is_active on public.ads
  for each row execute function public.ads_refresh_shop_count();

-- --- Ads: looptijd van gestopte ads (voor het filter "loopt minstens N dagen") -------------
alter table public.ads
  add column run_days_final integer generated always as (
    case when ended_at is not null and started_at is not null
         then greatest(0, floor(extract(epoch from (ended_at - started_at)) / 86400))::integer end
  ) stored;
create index ads_run_days_idx on public.ads (run_days_final);

-- --- Adverteerders met tellingen -------------------------------------------------------------
create view public.advertiser_stats with (security_invoker = true) as
  select a.id, a.platform, a.page_id, a.page_name, a.shop_id, a.country, a.first_seen_at,
         s.domain as shop_domain, s.name as shop_name,
         count(ad.id) filter (where ad.is_active)::integer as active_ads,
         count(ad.id)::integer as total_ads,
         coalesce(sum(ad.eu_total_reach), 0)::bigint as total_reach,
         coalesce(sum(ad.est_spend_low), 0)::numeric(14, 2) as est_spend_low,
         coalesce(sum(ad.est_spend_high), 0)::numeric(14, 2) as est_spend_high,
         max(ad.started_at) as last_ad_started_at
    from public.advertisers a
    left join public.ads ad on ad.advertiser_id = a.id
    left join public.shops s on s.id = a.shop_id
   group by a.id, s.domain, s.name;
grant select on public.advertiser_stats to authenticated;

-- --- Lookups: een gebruiker zoekt een domein op dat we nog niet kennen ----------------------
create table public.lookup_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  requested_by uuid references auth.users (id) on delete set null,
  domain text not null,
  -- queued -> processing -> done | not_shopify | blocked | dead | failed
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'done', 'not_shopify', 'blocked', 'dead', 'failed')),
  shop_id uuid references public.shops (id) on delete set null,
  error text,
  source text not null default 'web' check (source in ('web', 'api', 'mcp')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lookup_requests_pending_idx on public.lookup_requests (created_at) where status in ('queued', 'processing');
create index lookup_requests_ws_idx on public.lookup_requests (workspace_id, created_at desc);
create index lookup_requests_domain_idx on public.lookup_requests (domain);
create trigger lookup_requests_updated_at before update on public.lookup_requests
  for each row execute function public.set_updated_at();
alter table public.lookup_requests enable row level security;
create policy "lookup_requests_read" on public.lookup_requests for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- --- Events: wat er verandert bij een shop (Brandtracker-feed, prijswijzigingen) ------------
create table public.shop_events (
  id bigint generated always as identity primary key,
  shop_id uuid not null references public.shops (id) on delete cascade,
  type text not null
    check (type in ('new_ad', 'stopped_ad', 'new_product', 'removed_product', 'price_change', 'new_email')),
  occurred_at timestamptz not null default now(),
  ref_id uuid,                 -- ads.id, products.id of emails.id
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);
create index shop_events_shop_time_idx on public.shop_events (shop_id, occurred_at desc);
create index shop_events_time_idx on public.shop_events (occurred_at desc);
alter table public.shop_events enable row level security;
create policy "shop_events_read" on public.shop_events for select to authenticated using (true);

-- --- Gedeelde folders: publiek leesbaar via token, alleen via de server (service role) ------
create index folders_share_token_idx on public.folders (share_token) where share_token is not null;

-- Nieuwe tabellen: schrijven blijft alleen via de service role.
revoke insert, update, delete, truncate on public.lookup_requests, public.shop_events from anon, authenticated;
revoke select on public.lookup_requests, public.shop_events from anon;

-- --- Backfill -----------------------------------------------------------------------------------
update public.shops s set
  active_ads_count = (select count(*) from public.ads a where a.shop_id = s.id and a.is_active),
  niche = (select p.product_type from public.products p
            where p.shop_id = s.id and p.product_type is not null
            group by p.product_type order by count(*) desc, p.product_type limit 1);

-- --- Filteropties voor het dashboard (landen, niches, thema's die echt voorkomen) -------------
create or replace function public.shop_facets()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'countries', (select coalesce(jsonb_agg(c order by c), '[]') from (select distinct country c from public.shops where country is not null) x),
    'niches',    (select coalesce(jsonb_agg(n order by n), '[]') from (select distinct niche n from public.shops where niche is not null) x),
    'themes',    (select coalesce(jsonb_agg(t order by t), '[]') from (select distinct theme_name t from public.shops where theme_name is not null) x)
  );
$$;
grant execute on function public.shop_facets() to authenticated;
