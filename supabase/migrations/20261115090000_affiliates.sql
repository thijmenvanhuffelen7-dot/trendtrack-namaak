-- Affiliate-programma (Prompt 13): 30% terugkerend op betaalde abonnementen.
-- De ?ref=-code komt via een cookie in de Stripe-metadata en zo op het abonnement.

create table public.affiliates (
  code text primary key check (code ~ '^[a-z0-9_-]{3,40}$'),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  commission_pct int not null default 30 check (commission_pct between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.affiliates enable row level security;
-- Een affiliate ziet alleen zijn eigen rij; aanmaken gaat via de service role.
create policy affiliates_own on public.affiliates for select to authenticated using (user_id = auth.uid());

alter table public.subscriptions add column referral_code text;
create index subscriptions_referral_idx on public.subscriptions (referral_code) where referral_code is not null;

-- Overzicht voor een affiliate: aantallen, geen gegevens van de klanten zelf.
create or replace function public.affiliate_stats(p_code text)
returns table (signups bigint, paying bigint)
language sql stable security definer set search_path = public as $$
  select count(*)::bigint,
         count(*) filter (where status in ('active', 'past_due'))::bigint
  from public.subscriptions where referral_code = p_code;
$$;
revoke all on function public.affiliate_stats(text) from public, anon, authenticated;
