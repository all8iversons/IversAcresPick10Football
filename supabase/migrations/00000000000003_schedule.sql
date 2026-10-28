create table public.nfl_weeks (
  id uuid primary key default gen_random_uuid(),
  season integer not null check (season between 2000 and 2200),
  season_type integer not null check (season_type = 2),
  week_number integer not null check (week_number between 1 and 18),
  deadline_utc timestamptz not null,
  schedule_fetched_at timestamptz not null default now(),
  schedule_status text not null default 'available'
    check (schedule_status in ('available', 'stale', 'unavailable')),
  unique (season, season_type, week_number)
);

create table public.nfl_games (
  id uuid primary key default gen_random_uuid(),
  source_event_id text not null unique,
  week_id uuid not null references public.nfl_weeks (id) on delete cascade,
  home_team_id text not null,
  home_team_name text not null,
  away_team_id text not null,
  away_team_name text not null,
  kickoff_utc timestamptz not null,
  venue_time_zone text not null,
  is_thursday_night_game boolean not null default false,
  status text not null check (
    status in ('scheduled', 'in_progress', 'final', 'postponed', 'cancelled', 'unknown')
  ),
  home_score numeric,
  away_score numeric,
  final_result text not null default 'undetermined'
    check (final_result in ('home_win', 'away_win', 'tie', 'undetermined')),
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id),
  check (
    status <> 'final'
    or (home_score is not null and away_score is not null)
  )
);

create index nfl_games_week_kickoff_idx
  on public.nfl_games (week_id, kickoff_utc);

alter table public.nfl_weeks enable row level security;
alter table public.nfl_games enable row level security;

create policy "authenticated participants can read schedule"
  on public.nfl_weeks for select to authenticated
  using (true);

create policy "authenticated participants can read games"
  on public.nfl_games for select to authenticated
  using (true);

revoke all on public.nfl_weeks, public.nfl_games from anon, authenticated;
grant select on public.nfl_weeks, public.nfl_games to authenticated;
grant select, insert, update, delete on public.nfl_weeks, public.nfl_games to service_role;
