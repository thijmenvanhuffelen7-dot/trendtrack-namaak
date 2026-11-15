-- E-mail library: één uniek seed-adres per shop, waarmee wij ons inschrijven op de nieuwsbrief.
create table public.seed_inboxes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null unique references public.shops (id) on delete cascade,
  -- volledig adres, lowercase, bv. zilverzand-k3m9x2@inbox.voorbeeld.nl
  address text not null unique check (address = lower(address) and address like '%@%'),
  -- wanneer we ons (handmatig) hebben ingeschreven; nodig voor welcome-detectie
  subscribed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.emails
  add column seed_inbox_id uuid references public.seed_inboxes (id) on delete set null,
  add column to_address text,
  add column message_id text,
  add column text_preview text,
  add constraint emails_message_id_unique unique (shop_id, message_id);

-- Mails die binnenkwamen op een adres dat we niet kennen (typo, oude shop): bewaren voor debug.
create table public.inbound_rejects (
  id bigint generated always as identity primary key,
  to_addresses text[] not null,
  from_address text,
  subject text,
  reason text not null,
  received_at timestamptz not null default now()
);

alter table public.seed_inboxes enable row level security;
alter table public.inbound_rejects enable row level security;
-- Geen policies: alleen de service role (admin/CLI/workers) mag hierbij.

-- Privé bucket voor de (opgeschoonde) HTML van mails.
insert into storage.buckets (id, name, public) values ('emails', 'emails', false)
on conflict (id) do nothing;

create policy "emails_bucket_read" on storage.objects for select to authenticated
  using (bucket_id = 'emails');
