create extension if not exists pgtap with schema extensions;
create schema if not exists tests;

begin;

select plan(3);

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
values
  (
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'member-one@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Member One"}',
    now(),
    now(),
    false,
    false
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'member-two@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Member Two"}',
    now(),
    now(),
    false,
    false
  );

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
select * from public.create_league('Member One League', repeat('a', 64));

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
select * from public.create_league('Member Two League', repeat('b', 64));

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;
select is(
  (select count(*)::integer from public.leagues),
  1,
  'a participant can only read leagues they belong to'
);
select is(
  (select count(*)::integer from public.league_memberships),
  1,
  'a participant can only read memberships for their leagues'
);
reset role;

select * from public.join_league(repeat('b', 64));
set local role authenticated;
select is(
  (select count(*)::integer from public.leagues),
  2,
  'joining with a valid invite code grants access to that league'
);

select * from finish();
rollback;
