create or replace function public.submit_weekly_entry(
  p_league_id uuid,
  p_week_id uuid,
  p_picks jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_entry_id uuid;
  v_deadline timestamptz;
  v_pick_count integer;
  v_distinct_game_count integer;
  v_distinct_team_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;
  if not public.is_league_member(p_league_id) then
    raise exception using errcode = 'P0002', message = 'League not found';
  end if;
  if jsonb_typeof(p_picks) <> 'array' then
    raise exception using errcode = '22023', message = 'Picks must be an array';
  end if;

  select week.deadline_utc into v_deadline
  from public.nfl_weeks week
  where week.id = p_week_id and week.season_type = 2
  for update;

  if v_deadline is null then
    raise exception using errcode = 'P0002', message = 'Week not found';
  end if;
  if clock_timestamp() >= v_deadline then
    raise exception using errcode = 'P0001', message = 'PICKS_LOCKED';
  end if;

  select
    count(*),
    count(distinct pick.value ->> 'gameId'),
    count(distinct pick.value ->> 'selectedTeamId')
    into v_pick_count, v_distinct_game_count, v_distinct_team_count
  from jsonb_array_elements(p_picks) as pick(value);

  if v_pick_count <> 10
    or v_distinct_game_count <> 10
    or v_distinct_team_count <> 10
  then
    raise exception using errcode = '22023', message = 'Exactly 10 distinct games are required';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_picks) as pick(value)
    left join public.nfl_games game
      on game.id = (pick.value ->> 'gameId')::uuid
      and game.week_id = p_week_id
    where game.id is null
      or (pick.value ->> 'selectedTeamId') not in (game.home_team_id, game.away_team_id)
  ) then
    raise exception using errcode = '22023', message = 'A pick does not match a game in this week';
  end if;

  insert into public.weekly_entries (league_id, participant_id, week_id)
  values (p_league_id, v_user_id, p_week_id)
  on conflict (league_id, participant_id, week_id)
  do update set updated_at = clock_timestamp(), submitted_at = clock_timestamp()
  returning id into v_entry_id;

  delete from public.team_picks where entry_id = v_entry_id;

  insert into public.team_picks (entry_id, game_id, selected_team_id)
  select
    v_entry_id,
    (pick.value ->> 'gameId')::uuid,
    pick.value ->> 'selectedTeamId'
  from jsonb_array_elements(p_picks) as pick(value);

  return v_entry_id;
end;
$$;

revoke all on function public.submit_weekly_entry(uuid, uuid, jsonb) from public;
grant execute on function public.submit_weekly_entry(uuid, uuid, jsonb) to authenticated;
