update public.team_picks pick
set points_awarded = 0.5
from public.nfl_games game
where game.id = pick.game_id
  and game.status = 'final'
  and game.final_result = 'tie'
  and pick.points_awarded is not null;

alter table public.team_picks
  drop constraint if exists team_picks_points_awarded_check;

alter table public.team_picks
  add constraint team_picks_points_awarded_check
  check (points_awarded in (0, 0.5, 1));
