create table public.weekly_entries (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null,
  participant_id uuid not null,
  week_id uuid not null references public.nfl_weeks (id),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, participant_id, week_id),
  foreign key (league_id, participant_id)
    references public.league_memberships (league_id, participant_id)
    on delete cascade
);

create table public.team_picks (
  entry_id uuid not null references public.weekly_entries (id) on delete cascade,
  game_id uuid not null references public.nfl_games (id),
  selected_team_id text not null,
  points_awarded numeric check (points_awarded in (0, 0.5, 1)),
  primary key (entry_id, game_id)
);

alter table public.weekly_entries enable row level security;
alter table public.team_picks enable row level security;

create policy "league members can read entries after deadline or own entry"
  on public.weekly_entries for select to authenticated
  using (
    public.is_league_member(league_id)
    and (
      participant_id = (select auth.uid())
      or exists (
        select 1
        from public.nfl_weeks week
        where week.id = week_id and now() >= week.deadline_utc
      )
    )
  );

create policy "participants can read picks through visible entries"
  on public.team_picks for select to authenticated
  using (
    exists (
      select 1
      from public.weekly_entries entry
      where entry.id = entry_id
    )
  );

revoke all on public.weekly_entries, public.team_picks from anon, authenticated;
grant select on public.weekly_entries, public.team_picks to authenticated;
grant select, insert, update, delete on public.weekly_entries, public.team_picks to service_role;
