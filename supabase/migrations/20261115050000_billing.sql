-- Plannen, proefperiode, gebruikslimieten en betalingen (Prompt 10).

-- --- Plannen: bron van waarheid is packages/core/src/plans.ts (test bewaakt dat dit klopt) -------
insert into public.plans (id, name, monthly_price_cents, sort_order, limits) values
  ('free',    'Gratis',  0,     0, '{"shopLookupsPerWeek": 5, "adSearchesPerDay": 20, "folders": 1, "trackedBrands": 0, "emailHistoryDays": 7, "api": false, "apiCallsPerMonth": 0, "seats": 1, "extraSeatMonthlyEur": null}'),
  ('starter', 'Starter', 2900,  1, '{"shopLookupsPerWeek": 50, "adSearchesPerDay": null, "folders": null, "trackedBrands": 3, "emailHistoryDays": 30, "api": false, "apiCallsPerMonth": 0, "seats": 1, "extraSeatMonthlyEur": null}'),
  ('pro',     'Pro',     5900,  2, '{"shopLookupsPerWeek": null, "adSearchesPerDay": null, "folders": null, "trackedBrands": 15, "emailHistoryDays": null, "api": true, "apiCallsPerMonth": 10000, "seats": 1, "extraSeatMonthlyEur": null}'),
  ('agency',  'Agency',  11900, 3, '{"shopLookupsPerWeek": null, "adSearchesPerDay": null, "folders": null, "trackedBrands": 40, "emailHistoryDays": null, "api": true, "apiCallsPerMonth": 50000, "seats": 3, "extraSeatMonthlyEur": 20}')
on conflict (id) do update set name = excluded.name, monthly_price_cents = excluded.monthly_price_cents,
  sort_order = excluded.sort_order, limits = excluded.limits;

-- --- Abonnementen ---------------------------------------------------------------------------------
alter table public.subscriptions
  add column provider_customer_id text,
  -- Tijdstip van het laatst verwerkte provider-event: oudere events die later binnenkomen negeren we.
  add column provider_event_at timestamptz;

-- Eén proefabonnement per workspace.
create unique index subscriptions_one_trial_idx on public.subscriptions (workspace_id) where provider = 'manual';

-- Verwerkte webhooks (idempotentie: Stripe stuurt events soms meer dan eens).
create table public.billing_events (
  provider text not null,
  event_id text not null,
  type text not null,
  processed_at timestamptz not null default now(),
  primary key (provider, event_id)
);
alter table public.billing_events enable row level security;

-- --- Nieuwe gebruiker: ook 7 dagen gratis Pro, zonder creditcard -------------------------------------
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
  insert into public.subscriptions (workspace_id, plan_id, status, provider, trial_ends_at, current_period_start, current_period_end)
    values (ws_id, 'pro', 'trialing', 'manual', now() + interval '7 days', now(), now() + interval '7 days');
  return new;
end;
$$;

-- --- Gebruik tellen: controleren en vastleggen in één stap ------------------------------------------
create index usage_events_key_idx on public.usage_events (workspace_id, action, (metadata ->> 'key'), created_at);

/*
  Telt het gebruik van een actie sinds p_since en legt een nieuw event vast als dat binnen de
  limiet past. Een advisory lock per workspace+actie voorkomt dat twee gelijktijdige verzoeken
  allebei net onder de limiet blijven. Met p_key telt dezelfde sleutel (bv. hetzelfde domein)
  binnen de periode maar één keer. p_limit null = onbeperkt (wel vastleggen).
*/
create or replace function public.record_usage(
  p_workspace uuid,
  p_user uuid,
  p_action text,
  p_source text,
  p_since timestamptz,
  p_limit integer,
  p_quantity integer default 1,
  p_key text default null,
  p_record boolean default true
)
returns table (allowed boolean, used integer, duplicate boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_used integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_workspace::text || ':' || p_action, 0));

  select coalesce(sum(e.quantity), 0)::integer into v_used
    from public.usage_events e
   where e.workspace_id = p_workspace and e.action = p_action and e.created_at >= p_since;

  if p_key is not null and exists (
    select 1 from public.usage_events e
     where e.workspace_id = p_workspace and e.action = p_action and e.created_at >= p_since
       and e.metadata ->> 'key' = p_key
  ) then
    return query select true, v_used, true;
    return;
  end if;

  if p_limit is not null and v_used + p_quantity > p_limit then
    return query select false, v_used, false;
    return;
  end if;

  if p_record then
    insert into public.usage_events (workspace_id, user_id, action, source, quantity, metadata)
    values (p_workspace, p_user, p_action, p_source, p_quantity,
            case when p_key is null then null else jsonb_build_object('key', p_key) end);
    v_used := v_used + p_quantity;
  end if;
  return query select true, v_used, false;
end;
$$;
revoke all on function public.record_usage(uuid, uuid, text, text, timestamptz, integer, integer, text, boolean) from public, anon, authenticated;
grant execute on function public.record_usage(uuid, uuid, text, text, timestamptz, integer, integer, text, boolean) to service_role;

-- Bestaande gebruikers zonder abonnement blijven gratis (geen proef met terugwerkende kracht).
