-- Monitoring van achtergrondjobs (pg-boss) voor /admin/jobs en alerting.
create table public.job_runs (
  id bigint generated always as identity primary key,
  job_id uuid,
  job_name text not null,
  job_key text,                 -- bv. domein of page_id
  status text not null check (status in ('running', 'succeeded', 'failed')),
  attempt integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  error text,
  result jsonb
);
create index job_runs_started_idx on public.job_runs (started_at desc);
create index job_runs_name_started_idx on public.job_runs (job_name, started_at desc);
create index job_runs_failed_idx on public.job_runs (started_at desc) where status = 'failed';

-- Wanneer we voor het laatst een melding stuurden (om spam te voorkomen).
create table public.system_alerts (
  key text primary key,
  last_sent_at timestamptz not null,
  last_payload jsonb
);

alter table public.job_runs enable row level security;
alter table public.system_alerts enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = (select auth.uid())), false);
$$;
grant execute on function public.is_admin() to authenticated;

create policy "job_runs_admin_read" on public.job_runs for select to authenticated using (public.is_admin());

-- Wachtrij-statistieken uit pg-boss (schema pgboss bestaat pas als de workers één keer draaiden).
create or replace function public.admin_queue_stats()
returns table (name text, state text, jobs bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if to_regclass('pgboss.job') is null then
    return;
  end if;
  return query execute
    'select j.name::text, j.state::text, count(*)::bigint from pgboss.job j group by 1, 2 order by 1, 2';
end;
$$;
revoke all on function public.admin_queue_stats() from public, anon, authenticated;
grant execute on function public.admin_queue_stats() to service_role;

-- Oude runs opruimen (aanroepen vanuit de scheduler).
create or replace function public.prune_job_runs(keep_days integer default 30)
returns bigint language sql security definer set search_path = ''
as $$
  with d as (delete from public.job_runs where started_at < now() - make_interval(days => keep_days) returning 1)
  select count(*) from d;
$$;
revoke all on function public.prune_job_runs(integer) from public, anon, authenticated;
grant execute on function public.prune_job_runs(integer) to service_role;
