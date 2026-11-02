update public.team_picks
set points_awarded = 0
where points_awarded = 0.5;

alter table public.team_picks
  drop constraint if exists team_picks_points_awarded_check;

alter table public.team_picks
  add constraint team_picks_points_awarded_check
  check (points_awarded in (0, 1));
