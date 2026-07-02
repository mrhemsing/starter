create table if not exists public.toetheslab_mlb_completed_starts (
  season text not null,
  date date not null,
  game_pk bigint not null,
  game_date timestamptz not null,
  venue text not null,
  away_team jsonb not null,
  home_team jsonb not null,
  pitcher_mlb_id bigint not null,
  pitcher_name text not null,
  team text not null,
  opponent text not null,
  side text not null check (side in ('home', 'away')),
  result text not null check (result in ('W', 'L', 'ND')),
  line jsonb not null,
  pitch_event_count integer not null default 0,
  arsenal jsonb not null default '[]'::jsonb,
  pitch_events jsonb not null default '[]'::jsonb,
  archived_at timestamptz not null default now(),
  primary key (date, game_pk, pitcher_mlb_id)
);

alter table public.toetheslab_mlb_completed_starts
  add column if not exists pitch_event_count integer not null default 0,
  add column if not exists arsenal jsonb not null default '[]'::jsonb,
  add column if not exists pitch_events jsonb not null default '[]'::jsonb;

create index if not exists toetheslab_mlb_completed_starts_season_date_idx
  on public.toetheslab_mlb_completed_starts (season, date, game_pk);

create index if not exists toetheslab_mlb_completed_starts_pitcher_date_idx
  on public.toetheslab_mlb_completed_starts (pitcher_mlb_id, date);

create table if not exists public.toetheslab_pitcher_archive_arsenals (
  season text not null,
  pitcher_mlb_id bigint not null,
  pitcher_name text not null,
  team text not null,
  arsenal jsonb not null,
  starts integer not null,
  pitch_events integer not null,
  first_start_date date not null,
  last_start_date date not null,
  start_date date not null,
  end_date date not null,
  archived_at timestamptz not null,
  source text not null default 'mlb-stats-api',
  primary key (season, pitcher_mlb_id)
);

create index if not exists toetheslab_pitcher_archive_arsenals_pitcher_idx
  on public.toetheslab_pitcher_archive_arsenals (pitcher_mlb_id, season);

create table if not exists public.toetheslab_mlb_archive_manifests (
  season text primary key,
  start_date date not null,
  end_date date not null,
  archived_at timestamptz not null,
  source text not null,
  counts jsonb not null,
  dates jsonb not null,
  synced_at timestamptz not null default now()
);

create table if not exists public.toetheslab_featured_start_highlights (
  start_id text primary key,
  video_id text not null,
  is_short boolean not null default false,
  source text not null default 'curated' check (source in ('curated', 'youtube-search')),
  title text,
  resolved_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.toetheslab_statcast_pitch_event_enrichments (
  season text not null,
  date date not null,
  game_pk bigint not null,
  pitcher_mlb_id bigint not null,
  pitch_number integer not null,
  pitch_event_id text not null,
  pitch_type text not null,
  result text not null,
  statcast jsonb not null,
  enriched_at timestamptz not null,
  source text not null default 'baseball-savant',
  primary key (date, game_pk, pitcher_mlb_id, pitch_number)
);

create index if not exists toetheslab_statcast_pitch_event_enrichments_pitcher_date_idx
  on public.toetheslab_statcast_pitch_event_enrichments (pitcher_mlb_id, date);

create table if not exists public.toetheslab_canonical_start_records (
  date date not null,
  start_id text not null,
  game_pk bigint not null,
  pitcher_mlb_id bigint not null,
  status text not null check (status in ('scheduled', 'live', 'final')),
  frozen boolean not null default false,
  record jsonb not null,
  updated_at timestamptz not null,
  primary key (date, start_id)
);

create index if not exists toetheslab_canonical_start_records_date_game_pitcher_idx
  on public.toetheslab_canonical_start_records (date, game_pk, pitcher_mlb_id);

create index if not exists toetheslab_canonical_start_records_pitcher_date_idx
  on public.toetheslab_canonical_start_records (pitcher_mlb_id, date);

create table if not exists public.toetheslab_canonical_slate_states (
  date date primary key,
  state text not null check (state in ('empty', 'pregame', 'active', 'complete')),
  counts jsonb not null,
  updated_at timestamptz not null
);

create table if not exists public.toetheslab_canonical_pitcher_season_aggregates (
  season text not null,
  pitcher_mlb_id bigint not null,
  pitcher_name text not null,
  team text not null,
  starts integer not null,
  totals jsonb not null,
  averages jsonb not null,
  decisions jsonb not null,
  updated_at timestamptz not null,
  primary key (season, pitcher_mlb_id)
);

alter table public.toetheslab_mlb_completed_starts enable row level security;
alter table public.toetheslab_mlb_archive_manifests enable row level security;
alter table public.toetheslab_pitcher_archive_arsenals enable row level security;
alter table public.toetheslab_featured_start_highlights enable row level security;
alter table public.toetheslab_statcast_pitch_event_enrichments enable row level security;
alter table public.toetheslab_canonical_start_records enable row level security;
alter table public.toetheslab_canonical_slate_states enable row level security;
alter table public.toetheslab_canonical_pitcher_season_aggregates enable row level security;

drop policy if exists "toetheslab service archive read" on public.toetheslab_mlb_completed_starts;
drop policy if exists "toetheslab service archive write" on public.toetheslab_mlb_completed_starts;
drop policy if exists "toetheslab service manifest read" on public.toetheslab_mlb_archive_manifests;
drop policy if exists "toetheslab service manifest write" on public.toetheslab_mlb_archive_manifests;
drop policy if exists "toetheslab service pitcher arsenal read" on public.toetheslab_pitcher_archive_arsenals;
drop policy if exists "toetheslab service pitcher arsenal write" on public.toetheslab_pitcher_archive_arsenals;
drop policy if exists "toetheslab service highlight read" on public.toetheslab_featured_start_highlights;
drop policy if exists "toetheslab service highlight write" on public.toetheslab_featured_start_highlights;
drop policy if exists "toetheslab service statcast pitch read" on public.toetheslab_statcast_pitch_event_enrichments;
drop policy if exists "toetheslab service statcast pitch write" on public.toetheslab_statcast_pitch_event_enrichments;
drop policy if exists "toetheslab service canonical starts read" on public.toetheslab_canonical_start_records;
drop policy if exists "toetheslab service canonical starts write" on public.toetheslab_canonical_start_records;
drop policy if exists "toetheslab service canonical slate read" on public.toetheslab_canonical_slate_states;
drop policy if exists "toetheslab service canonical slate write" on public.toetheslab_canonical_slate_states;
drop policy if exists "toetheslab service canonical aggregates read" on public.toetheslab_canonical_pitcher_season_aggregates;
drop policy if exists "toetheslab service canonical aggregates write" on public.toetheslab_canonical_pitcher_season_aggregates;

create policy "toetheslab service archive read"
  on public.toetheslab_mlb_completed_starts for select
  using (auth.role() = 'service_role');

create policy "toetheslab service archive write"
  on public.toetheslab_mlb_completed_starts for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "toetheslab service manifest read"
  on public.toetheslab_mlb_archive_manifests for select
  using (auth.role() = 'service_role');

create policy "toetheslab service manifest write"
  on public.toetheslab_mlb_archive_manifests for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "toetheslab service pitcher arsenal read"
  on public.toetheslab_pitcher_archive_arsenals for select
  using (auth.role() = 'service_role');

create policy "toetheslab service pitcher arsenal write"
  on public.toetheslab_pitcher_archive_arsenals for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "toetheslab service highlight read"
  on public.toetheslab_featured_start_highlights for select
  using (auth.role() = 'service_role');

create policy "toetheslab service highlight write"
  on public.toetheslab_featured_start_highlights for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "toetheslab service statcast pitch read"
  on public.toetheslab_statcast_pitch_event_enrichments for select
  using (auth.role() = 'service_role');

create policy "toetheslab service statcast pitch write"
  on public.toetheslab_statcast_pitch_event_enrichments for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "toetheslab service canonical starts read"
  on public.toetheslab_canonical_start_records for select
  using (auth.role() = 'service_role');

create policy "toetheslab service canonical starts write"
  on public.toetheslab_canonical_start_records for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "toetheslab service canonical slate read"
  on public.toetheslab_canonical_slate_states for select
  using (auth.role() = 'service_role');

create policy "toetheslab service canonical slate write"
  on public.toetheslab_canonical_slate_states for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "toetheslab service canonical aggregates read"
  on public.toetheslab_canonical_pitcher_season_aggregates for select
  using (auth.role() = 'service_role');

create policy "toetheslab service canonical aggregates write"
  on public.toetheslab_canonical_pitcher_season_aggregates for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
