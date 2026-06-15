create table if not exists public.frontfive_mlb_completed_starts (
  season text generated always as (left(date, 4)) stored,
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
  archived_at timestamptz not null default now(),
  primary key (date, game_pk, pitcher_mlb_id)
);

create index if not exists frontfive_mlb_completed_starts_season_date_idx
  on public.frontfive_mlb_completed_starts (season, date, game_pk);

create table if not exists public.frontfive_mlb_archive_manifests (
  season text primary key,
  start_date date not null,
  end_date date not null,
  archived_at timestamptz not null,
  source text not null,
  counts jsonb not null,
  dates jsonb not null,
  synced_at timestamptz not null default now()
);

alter table public.frontfive_mlb_completed_starts enable row level security;
alter table public.frontfive_mlb_archive_manifests enable row level security;

drop policy if exists "frontfive service archive read" on public.frontfive_mlb_completed_starts;
drop policy if exists "frontfive service archive write" on public.frontfive_mlb_completed_starts;
drop policy if exists "frontfive service manifest read" on public.frontfive_mlb_archive_manifests;
drop policy if exists "frontfive service manifest write" on public.frontfive_mlb_archive_manifests;

create policy "frontfive service archive read"
  on public.frontfive_mlb_completed_starts for select
  using (auth.role() = 'service_role');

create policy "frontfive service archive write"
  on public.frontfive_mlb_completed_starts for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "frontfive service manifest read"
  on public.frontfive_mlb_archive_manifests for select
  using (auth.role() = 'service_role');

create policy "frontfive service manifest write"
  on public.frontfive_mlb_archive_manifests for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
