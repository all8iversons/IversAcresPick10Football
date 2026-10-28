create extension if not exists pgtap with schema extensions;

begin;

select plan(6);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
)
values (
  '33333333-3333-4333-8333-333333333333',
  'authenticated',
  'authenticated',
  'picker@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Picker"}',
  now(),
  now(),
  false,
  false
);

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);
select * from public.create_league('Picker League', repeat('c', 64));

insert into public.nfl_weeks (
  id, season, season_type, week_number, deadline_utc, schedule_fetched_at
)
values (
  '44444444-4444-4444-8444-444444444444',
  2026,
  2,
  1,
  now() + interval '1 minute',
  now()
);

insert into public.nfl_games (
  id, source_event_id, week_id, home_team_id, home_team_name,
  away_team_id, away_team_name, kickoff_utc, venue_time_zone, status
)
select
  ('55555555-5555-4555-8555-' || lpad(number::text, 12, '0'))::uuid,
  'fixture-' || number,
  '44444444-4444-4444-8444-444444444444',
  'home-' || number,
  'Home ' || number,
  'away-' || number,
  'Away ' || number,
  now() + interval '1 day',
  'America/New_York',
  'scheduled'
from generate_series(1, 10) as series(number);

set local role authenticated;
select lives_ok(
  $$
    select public.submit_weekly_entry(
      (select id from public.leagues where created_by = auth.uid()),
      '44444444-4444-4444-8444-444444444444',
      (
        select jsonb_agg(jsonb_build_object(
          'gameId', game.id,
          'selectedTeamId', game.home_team_id
        ))
        from public.nfl_games game
        where game.week_id = '44444444-4444-4444-8444-444444444444'
      )
    )
  $$,
  'a valid ten-pick entry is persisted'
);
select is(
  (select count(*)::integer from public.team_picks),
  10,
  'a valid entry contains exactly ten picks'
);
select throws_ok(
  $$
    select public.submit_weekly_entry(
      (select id from public.leagues where created_by = auth.uid()),
      '44444444-4444-4444-8444-444444444444',
      '[]'::jsonb
    )
  $$,
  '22023',
  'Exactly 10 distinct games are required',
  'submission rejects entries that do not contain exactly ten games'
);
select is(
  (select count(*)::integer from public.weekly_entries),
  1,
  'an invalid replacement leaves the existing entry unchanged'
);

reset role;
update public.nfl_weeks
set deadline_utc = clock_timestamp() - interval '1 second'
where id = '44444444-4444-4444-8444-444444444444';
set local role authenticated;
select throws_ok(
  $$
    select public.submit_weekly_entry(
      (select id from public.leagues where created_by = auth.uid()),
      '44444444-4444-4444-8444-444444444444',
      (
        select jsonb_agg(jsonb_build_object(
          'gameId', game.id,
          'selectedTeamId', game.home_team_id
        ))
        from public.nfl_games game
        where game.week_id = '44444444-4444-4444-8444-444444444444'
      )
    )
  $$,
  'P0001',
  'PICKS_LOCKED',
  'submission is rejected after the deadline'
);
select is(
  (select count(*)::integer from public.team_picks),
  10,
  'a late replacement does not modify the existing entry'
);

select * from finish();
rollback;
