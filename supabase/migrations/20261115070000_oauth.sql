-- OAuth 2.1 voor de MCP-server (Prompt 12): dynamic client registration, PKCE, tokens.
-- Tokens en codes staan alleen gehasht in de database.

create table public.oauth_clients (
  client_id text primary key,
  client_name text not null,
  redirect_uris text[] not null check (cardinality(redirect_uris) between 1 and 10),
  created_at timestamptz not null default now()
);

create table public.oauth_codes (
  code_hash text primary key,
  client_id text not null references public.oauth_clients (client_id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  scope text not null default 'mcp',
  resource text,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table public.oauth_tokens (
  token_hash text primary key,
  kind text not null check (kind in ('access', 'refresh')),
  client_id text not null references public.oauth_clients (client_id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null default 'mcp',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index oauth_tokens_ws_idx on public.oauth_tokens (workspace_id);

alter table public.oauth_clients enable row level security;
alter table public.oauth_codes enable row level security;
alter table public.oauth_tokens enable row level security;
-- Geen policies: alleen de service role (web-app en MCP-server).
