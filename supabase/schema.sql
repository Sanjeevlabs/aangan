-- Aangan schema. Run in Supabase SQL editor.
-- RLS is scoped by family_id throughout. One seeded demo family; no auth flow yet.

create table if not exists families (
  id text primary key,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists members (
  id text primary key,
  family_id text references families(id) on delete cascade,
  display_name text not null,
  language text default 'en'
);

create table if not exists cards (
  id text primary key,
  family_id text references families(id) on delete cascade,
  type text check (type in ('photo', 'audio', 'video')),
  caption text not null,
  summary text default '',
  lang text default 'en',
  taken_at timestamptz not null,
  ritual_slug text,
  media_path text,
  thumbnail_path text,
  created_at timestamptz default now()
);

create table if not exists ritual_configs (
  slug text primary key,
  title text not null,
  config jsonb not null,
  version int default 1
);

create table if not exists llm_cache (
  key text primary key,
  response jsonb not null,
  cost_usd numeric default 0,
  created_at timestamptz default now()
);

alter table families enable row level security;
alter table members enable row level security;
alter table cards enable row level security;
alter table ritual_configs enable row level security;
alter table llm_cache enable row level security;

-- Demo: single family id passed as app.current_family_id. Replace with
-- Supabase Auth uid -> membership lookup when auth lands.
create policy "family scope" on families for all using (id = current_setting('app.current_family_id', true));
create policy "family scope" on members for all using (family_id = current_setting('app.current_family_id', true));
create policy "family scope" on cards for all using (family_id = current_setting('app.current_family_id', true));
create policy "read configs" on ritual_configs for select using (true);
create policy "no direct cache access" on llm_cache for select using (false);

insert into families (id, name) values ('demo-family', 'Demo Family')
on conflict (id) do nothing;
