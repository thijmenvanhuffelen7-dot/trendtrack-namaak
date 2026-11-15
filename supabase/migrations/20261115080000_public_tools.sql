-- Gratis tools op de publieke site (Prompt 13): limiet per IP-adres.
-- We bewaren alleen een gezouten hash van het IP-adres, nooit het adres zelf.
create table public.public_rate_counters (
  ip_hash text not null,
  tool text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (ip_hash, tool, window_start)
);
alter table public.public_rate_counters enable row level security;

create or replace function public.public_rate_hit(p_ip_hash text, p_tool text, p_per_hour integer)
returns table (allowed boolean, used integer, reset_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_start timestamptz := date_trunc('hour', now());
  v_count integer;
begin
  insert into public.public_rate_counters as c (ip_hash, tool, window_start, count)
    values (p_ip_hash, p_tool, v_start, 1)
    on conflict (ip_hash, tool, window_start) do update set count = c.count + 1
    returning c.count into v_count;
  return query select v_count <= p_per_hour, v_count, v_start + interval '1 hour';
end;
$$;
revoke all on function public.public_rate_hit(text, text, integer) from public, anon, authenticated;
grant execute on function public.public_rate_hit(text, text, integer) to service_role;

-- Opruimen via de dagelijkse onderhoudsjob.
create or replace function public.prune_public_rate_counters()
returns bigint language sql security definer set search_path = ''
as $$
  with d as (delete from public.public_rate_counters where window_start < now() - interval '2 days' returning 1)
  select count(*) from d;
$$;
revoke all on function public.prune_public_rate_counters() from public, anon, authenticated;
grant execute on function public.prune_public_rate_counters() to service_role;
