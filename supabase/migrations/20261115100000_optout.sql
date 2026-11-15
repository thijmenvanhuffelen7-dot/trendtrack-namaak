-- Opt-out (Prompt 14): eigenaren kunnen vragen hun shop niet meer te volgen.
-- Een admin keurt goed; daarna zijn de shopgegevens weg en raakt geen enkele job het domein nog aan.

create table public.optout_requests (
  id uuid primary key default gen_random_uuid(),
  domain text not null check (domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  email text not null check (length(email) between 3 and 254),
  reason text check (length(reason) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index optout_requests_pending_idx on public.optout_requests (created_at) where status = 'pending';

create table public.opted_out_domains (
  domain text primary key,
  request_id uuid references public.optout_requests (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Alleen de service role (web-acties en workers); geen policies = geen toegang voor gebruikers.
alter table public.optout_requests enable row level security;
alter table public.opted_out_domains enable row level security;

create or replace function public.is_opted_out(p_domain text)
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.opted_out_domains where domain = p_domain);
$$;

-- Vangnet: een afgemelde shop kan niet opnieuw in de database komen, ook niet via een vergeten codepad.
create or replace function public.shops_block_opted_out()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.is_opted_out(new.domain) then
    raise exception 'domein % is afgemeld (opt-out)', new.domain using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger shops_block_opted_out before insert or update of domain on public.shops
  for each row execute function public.shops_block_opted_out();

-- Nieuwe lookups voor een afgemeld domein worden meteen afgesloten.
create or replace function public.lookups_block_opted_out()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.is_opted_out(new.domain) then
    new.status := 'blocked';
    new.error := 'Deze shop is op verzoek van de eigenaar verwijderd.';
  end if;
  return new;
end;
$$;
create trigger lookups_block_opted_out before insert on public.lookup_requests
  for each row execute function public.lookups_block_opted_out();

-- Goedkeuren: domein op de lijst, shop en alles eraan verwijderen (cascade), ads ontkoppelen (set null).
create or replace function public.approve_optout(p_request uuid, p_admin uuid, p_note text default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_domain text;
  v_deleted int;
begin
  update public.optout_requests
     set status = 'approved', decided_by = p_admin, decided_at = now(), admin_note = p_note
   where id = p_request and status = 'pending'
   returning domain into v_domain;
  if v_domain is null then
    raise exception 'verzoek % bestaat niet of is al behandeld', p_request;
  end if;
  insert into public.opted_out_domains (domain, request_id) values (v_domain, p_request)
    on conflict (domain) do nothing;
  with d as (delete from public.shops where domain = v_domain returning 1) select count(*) into v_deleted from d;
  update public.lookup_requests set status = 'blocked', error = 'Deze shop is op verzoek van de eigenaar verwijderd.'
   where domain = v_domain and status in ('queued', 'processing');
  return v_deleted;
end;
$$;
revoke all on function public.approve_optout(uuid, uuid, text) from public, anon, authenticated;
