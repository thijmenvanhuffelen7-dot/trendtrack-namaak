-- Publieke REST API (Prompt 11): rate limiting per API-key.

-- Vaste vensters: per seconde en per UTC-dag. Oude rijen ruimt de dagelijkse onderhoudsjob op.
create table public.api_rate_counters (
  key_id uuid not null references public.api_keys (id) on delete cascade,
  bucket text not null check (bucket in ('second', 'day')),
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key_id, bucket, window_start)
);
alter table public.api_rate_counters enable row level security;

/*
  Telt één request voor een key. Eerst het secondevenster; zit dat vol, dan telt het niet mee
  voor de dag. Geeft terug of het mag, de tellers en wanneer het dagvenster reset.
*/
create or replace function public.api_rate_hit(p_key uuid, p_per_second integer, p_per_day integer)
returns table (allowed boolean, second_count integer, day_count integer, day_reset timestamptz, limited_by text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_sec integer;
  v_day integer;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
begin
  insert into public.api_rate_counters as c (key_id, bucket, window_start, count)
    values (p_key, 'second', date_trunc('second', now()), 1)
    on conflict (key_id, bucket, window_start) do update set count = c.count + 1
    returning c.count into v_sec;
  if v_sec > p_per_second then
    select coalesce((select count from public.api_rate_counters where key_id = p_key and bucket = 'day' and window_start = v_day_start), 0) into v_day;
    return query select false, v_sec, v_day, v_day_start + interval '1 day', 'second'::text;
    return;
  end if;
  insert into public.api_rate_counters as c (key_id, bucket, window_start, count)
    values (p_key, 'day', v_day_start, 1)
    on conflict (key_id, bucket, window_start) do update set count = c.count + 1
    returning c.count into v_day;
  return query select v_day <= p_per_day, v_sec, v_day, v_day_start + interval '1 day',
    case when v_day > p_per_day then 'day' else null end;
end;
$$;
revoke all on function public.api_rate_hit(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.api_rate_hit(uuid, integer, integer) to service_role;

create or replace function public.prune_api_rate_counters()
returns bigint language sql security definer set search_path = ''
as $$
  with d as (delete from public.api_rate_counters where window_start < now() - interval '2 days' returning 1)
  select count(*) from d;
$$;
revoke all on function public.prune_api_rate_counters() from public, anon, authenticated;
grant execute on function public.prune_api_rate_counters() to service_role;
