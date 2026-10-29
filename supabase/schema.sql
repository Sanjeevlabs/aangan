-- Aangan schema — full PRD table list. Run ONCE in the Supabase SQL editor.
-- This script is IDEMPOTENT: every object is created IF NOT EXISTS and every
-- policy is dropped before creation, so re-running it is always safe.
--
-- RLS is ENABLED on every table with NO anonymous policies (deny by default).
-- V1 has no Supabase Auth: ALL database and storage access goes through
-- Next.js server routes using the server-only SUPABASE_SECRET_KEY (service
-- role, bypasses RLS). The anon key is never used for data access.
-- Only ritual_configs stays public-read (static festival guides).
-- M5 (privacy set) adds invite-code claims; until then the app stays in
-- mock mode (MOCK=true) and the mock store is the seam.
-- Mirrors lib/schemas.ts, lib/store.ts and lib/llm-server.ts.

-- ---------------------------------------------------------------- families
create table if not exists families (
  id text primary key,
  name text not null,
  default_home_image_ref text,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------- members
-- PRD: members(+home_image, lang, display_lang, tz). Legacy `language`
-- column kept for the Day-1 schema; app reads lang + displayLang.
create table if not exists members (
  id text primary key,
  family_id text references families(id) on delete cascade,
  first_name text not null default '',
  display_name text not null,
  role text check (role in ('elder', 'adult', 'child')) default 'adult',
  language text default 'en',
  lang text default 'en',
  display_lang text default 'en' check (char_length(display_lang) between 2 and 12),
  tz text default 'UTC',
  birthday text,
  home_image_ref text,
  home_palette text[] default '{}',
  created_at timestamptz default now()
);
alter table members add column if not exists first_name text not null default '';
alter table members add column if not exists role text check (role in ('elder', 'adult', 'child')) default 'adult';
alter table members add column if not exists lang text default 'en';
alter table members add column if not exists display_lang text default 'en';
-- Major-language support: codes come from lib/languages.ts (app-validated).
alter table members drop constraint if exists members_display_lang_check;
alter table members add constraint members_display_lang_check check (char_length(display_lang) between 2 and 12);
alter table members add column if not exists tz text default 'UTC';
alter table members add column if not exists birthday text;
alter table members add column if not exists home_image_ref text;
alter table members add column if not exists home_palette text[] default '{}';
alter table members add column if not exists photo_ref text;
alter table members add column if not exists email text;
create unique index if not exists members_email_idx on members (lower(email)) where email is not null;

-- ------------------------------------------------------------ relationships
-- Guided Bond adds, e.g. ('arjun','dadi','parent'). No culture in logic:
-- relation is a free-text edge label resolved by the M3 kinship resolver.
create table if not exists relationships (
  id text primary key,
  family_id text references families(id) on delete cascade,
  member_id text references members(id) on delete cascade,
  relation_member_id text references members(id) on delete cascade,
  relation text not null,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------------- cards
-- PRD: cards(+transcript, transcript_lang, segments). peaks/segments are
-- jsonb number arrays; palette is text[]. Legacy media_path/thumbnail_path
-- kept from the Day-1 schema; app writes media_ref (session ref today,
-- storage path after the Supabase swap).
create table if not exists cards (
  id text primary key,
  family_id text references families(id) on delete cascade,
  type text check (type in ('photo', 'audio', 'video')),
  caption text not null default '',
  summary text default '',
  lang text default 'en',
  taken_at timestamptz not null,
  ritual_slug text,
  source text default 'upload' check (source in ('upload', 'today', 'glasses', 'ritual', 'agent')),
  media_path text,
  thumbnail_path text,
  media_ref text,
  peaks jsonb default '[]',
  palette text[] default '{}',
  transcript text default '',
  transcript_lang text default 'en',
  segments jsonb default '[]',
  created_at timestamptz default now()
);
alter table cards add column if not exists source text default 'upload' check (source in ('upload', 'today', 'glasses', 'ritual', 'agent'));
alter table cards add column if not exists media_ref text;
alter table cards add column if not exists peaks jsonb default '[]';
alter table cards add column if not exists palette text[] default '{}';
alter table cards add column if not exists transcript text default '';
alter table cards add column if not exists transcript_lang text default 'en';
alter table cards add column if not exists segments jsonb default '[]';
alter table cards add column if not exists author_id text references members(id) on delete set null;
alter table cards add column if not exists cover_ref text;
alter table cards add column if not exists addressed_to text references members(id) on delete set null;

-- ------------------------------------------------------------------- media
-- Private-bucket objects referenced by cards. storage_path is the object key
-- inside family-media; rows are metadata only.
create table if not exists media (
  id text primary key,
  family_id text references families(id) on delete cascade,
  card_id text references cards(id) on delete set null,
  kind text check (kind in ('photo', 'audio', 'video')),
  bytes bigint default 0,
  mime text default '',
  duration_seconds numeric,
  taken_at timestamptz,
  taken_at_source text default 'now',
  source text default 'upload',
  palette text[] default '{}',
  peaks jsonb default '[]',
  storage_path text,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------------- plays
-- Two-way voice Heard loop: plays(card, member, played_at).
create table if not exists plays (
  id text primary key,
  family_id text references families(id) on delete cascade,
  card_id text references cards(id) on delete cascade,
  member_id text references members(id) on delete cascade,
  played_at timestamptz not null default now(),
  created_at timestamptz default now()
);
create index if not exists plays_card_idx on plays (card_id, played_at desc);

-- --------------------------------------------------------------- reactions
-- Exactly three kinds; one per member per card (unique pair → latest wins).
create table if not exists reactions (
  id text primary key,
  family_id text references families(id) on delete cascade,
  card_id text references cards(id) on delete cascade,
  member_id text references members(id) on delete cascade,
  kind text check (kind in ('love', 'laugh', 'bless')),
  created_at timestamptz default now()
);
create unique index if not exists reactions_card_member_uidx on reactions (card_id, member_id);

-- -------------------------------------------------------------- daily_roles
-- Ikigai role per elder per day (ritual agent assigns in M4).
create table if not exists daily_roles (
  id text primary key,
  family_id text references families(id) on delete cascade,
  member_id text references members(id) on delete cascade,
  role_date date not null,
  prompt text not null default '',
  created_at timestamptz default now()
);
create unique index if not exists daily_roles_member_day_uidx on daily_roles (family_id, member_id, role_date);

-- ----------------------------------------------------------- ritual_configs
-- Data-driven festival specifics live in JSON rows/files, never in code.
create table if not exists ritual_configs (
  slug text primary key,
  title text not null,
  culture_notes text default '',
  steps jsonb not null default '[]',
  config jsonb,
  version int default 1
);
alter table ritual_configs add column if not exists culture_notes text default '';
alter table ritual_configs add column if not exists steps jsonb not null default '[]';

-- -------------------------------------------------------------- ritual_runs
create table if not exists ritual_runs (
  id text primary key,
  family_id text references families(id) on delete cascade,
  ritual_slug text references ritual_configs(slug),
  occasion_date date,
  status text default 'open' check (status in ('open', 'collecting', 'delivered', 'done')),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------------ wishes
-- Wishes AND blessings from members/elders (kind: wish|blessing).
create table if not exists wishes (
  id text primary key,
  family_id text references families(id) on delete cascade,
  ritual_run_id text references ritual_runs(id) on delete set null,
  card_id text references cards(id) on delete set null,
  member_id text references members(id) on delete cascade,
  kind text check (kind in ('wish', 'blessing')),
  created_at timestamptz default now()
);

-- ---------------------------------------------------------- gather_sessions
-- A family evening: date + per-member local times, invites, playlist.
create table if not exists gather_sessions (
  id text primary key,
  family_id text references families(id) on delete cascade,
  title text default '',
  starts_at timestamptz,
  invites jsonb default '[]',
  playlist jsonb default '[]',
  created_at timestamptz default now()
);

-- -------------------------------------------------------------- suggestions
-- Agent proposals; actions execute only on approval (glass Review card).
create table if not exists suggestions (
  id text primary key,
  family_id text references families(id) on delete cascade,
  goal text default '',
  payload jsonb default '{}',
  status text default 'pending' check (status in ('pending', 'approved', 'rejected', 'done')),
  created_at timestamptz default now()
);

-- --------------------------------------------------------------- agent_runs
create table if not exists agent_runs (
  id text primary key,
  family_id text references families(id) on delete cascade,
  goal text default '',
  tools jsonb default '[]',
  status text default 'done',
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------- llm_calls
-- Spend ledger mirror: model, purpose, cost, cache hits. Server is the only
-- writer; clients have no direct access.
create table if not exists llm_calls (
  id text primary key,
  family_id text references families(id) on delete cascade,
  model text not null default '',
  purpose text default '',
  cost_usd numeric default 0,
  cached boolean default false,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------ kinship_cache
-- PRD: kinship_cache(path, display_lang). Deterministic BFS path → terms;
-- the model runs only on a cache miss (M3). Terms are generic kinship words.
create table if not exists kinship_cache (
  path text not null,
  display_lang text not null default 'en' check (display_lang in ('en', 'hi-latn', 'hi-deva')),
  terms jsonb default '{}',
  created_at timestamptz default now(),
  primary key (path, display_lang)
);

-- ----------------------------------------------------------------- invites
-- Expiring invite codes (7 days). Service-role only until M5 privacy set.
create table if not exists invites (
  id text primary key,
  family_id text references families(id) on delete cascade,
  code text unique not null,
  expires_at timestamptz not null,
  created_by text references members(id) on delete set null,
  created_at timestamptz default now()
);

-- Legacy Day-1 model cache table; kept untouched for backward compatibility.
create table if not exists llm_cache (
  key text primary key,
  response jsonb not null,
  cost_usd numeric default 0,
  created_at timestamptz default now()
);

-- --------------------------------------------------------------------- RLS
alter table families enable row level security;
alter table members enable row level security;
alter table relationships enable row level security;
alter table cards enable row level security;
alter table media enable row level security;
alter table plays enable row level security;
alter table reactions enable row level security;
alter table daily_roles enable row level security;
alter table ritual_configs enable row level security;
alter table ritual_runs enable row level security;
alter table wishes enable row level security;
alter table gather_sessions enable row level security;
alter table suggestions enable row level security;
alter table agent_runs enable row level security;
alter table llm_calls enable row level security;
alter table kinship_cache enable row level security;
alter table invites enable row level security;
alter table llm_cache enable row level security;

-- Server-only model: RLS stays ENABLED everywhere, but NO policy grants
-- anything to anon/authenticated, so direct client access is denied by
-- default. The drops below also clean up policies from earlier revisions,
-- keeping re-runs idempotent. Server routes use the service role (bypasses
-- RLS) and enforce family scoping + validation in code.
drop policy if exists "family scope" on families;
drop policy if exists "family scope" on members;
drop policy if exists "family scope" on relationships;
drop policy if exists "family scope" on cards;
drop policy if exists "family scope" on media;
drop policy if exists "family scope" on plays;
drop policy if exists "family scope" on reactions;
drop policy if exists "family scope" on daily_roles;
drop policy if exists "family scope" on ritual_runs;
drop policy if exists "family scope" on wishes;
drop policy if exists "family scope" on gather_sessions;
drop policy if exists "family scope" on suggestions;
drop policy if exists "family scope" on agent_runs;
drop policy if exists "no direct cache access" on llm_calls;
drop policy if exists "kinship read" on kinship_cache;
drop policy if exists "no direct invite access" on invites;
drop policy if exists "no direct cache access" on llm_cache;

-- Sole exception: static festival guides are public-read.
drop policy if exists "read configs" on ritual_configs;
create policy "read configs" on ritual_configs for select using (true);

-- ----------------------------------------------------------------- storage
-- PRIVATE bucket for family media. No storage policies at all: direct
-- client access (read AND write) is denied by default. Upload flow:
-- the server validates the family, then issues a short-lived signed upload
-- URL (createSignedUploadUrl); downloads go through server-issued signed
-- URLs. Only the service role (SUPABASE_SECRET_KEY) touches the bucket.
insert into storage.buckets (id, name, public)
values ('family-media', 'family-media', false)
on conflict (id) do nothing;

drop policy if exists "anon upload to family bucket" on storage.objects;

-- -------------------------------------------------------------------- seed
insert into families (id, name) values ('demo-family', 'Demo Family')
on conflict (id) do nothing;

insert into members (id, family_id, first_name, display_name, role, lang, display_lang, tz, birthday)
values
  ('dadi', 'demo-family', 'Dadi', 'Dadi', 'elder', 'hi', 'hi-deva', 'Asia/Kolkata', '01-22'),
  ('arjun', 'demo-family', 'Arjun', 'Dad', 'adult', 'en', 'en', 'America/New_York', '07-30'),
  ('leo', 'demo-family', 'Leo', 'Leo', 'child', 'en', 'en', 'America/New_York', '11-09'),
  ('aria', 'demo-family', 'Aria', 'Aria', 'child', 'en', 'hi-latn', 'America/Chicago', '03-14')
on conflict (id) do nothing;
