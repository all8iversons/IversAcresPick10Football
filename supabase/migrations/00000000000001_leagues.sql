create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  invite_code_hash text not null unique,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.league_memberships (
  league_id uuid not null references public.leagues (id) on delete cascade,
  participant_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (league_id, participant_id)
);

alter table public.leagues enable row level security;
alter table public.league_memberships enable row level security;

create or replace function public.is_league_member(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.league_memberships membership
    where membership.league_id = p_league_id
      and membership.participant_id = (select auth.uid())
  );
$$;

create or replace function public.create_league(
  p_name text,
  p_invite_code_hash text
)
returns table (id uuid, name text, role text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'League name must be 1 to 80 characters';
  end if;
  if p_invite_code_hash is null or length(p_invite_code_hash) < 64 then
    raise exception using errcode = '22023', message = 'Invalid invite code hash';
  end if;

  insert into public.leagues (name, invite_code_hash, created_by)
  values (btrim(p_name), p_invite_code_hash, v_user_id)
  returning public.leagues.id into v_league_id;

  insert into public.league_memberships (league_id, participant_id, role)
  values (v_league_id, v_user_id, 'owner');

  return query
    select league.id, league.name, membership.role, league.created_at
    from public.leagues league
    join public.league_memberships membership
      on membership.league_id = league.id
    where league.id = v_league_id and membership.participant_id = v_user_id;
end;
$$;

create or replace function public.join_league(p_invite_code_hash text)
returns table (id uuid, name text, role text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_league_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  select league.id into v_league_id
  from public.leagues league
  where league.invite_code_hash = p_invite_code_hash;

  if v_league_id is null then
    raise exception using errcode = 'P0002', message = 'Invalid invite code';
  end if;

  insert into public.league_memberships (league_id, participant_id)
  values (v_league_id, v_user_id)
  on conflict (league_id, participant_id) do nothing;

  return query
    select league.id, league.name, membership.role, league.created_at
    from public.leagues league
    join public.league_memberships membership
      on membership.league_id = league.id
    where league.id = v_league_id and membership.participant_id = v_user_id;
end;
$$;

revoke all on public.leagues, public.league_memberships from anon, authenticated;
grant select on public.leagues, public.league_memberships to authenticated;
revoke all on function public.create_league(text, text) from public;
revoke all on function public.join_league(text) from public;
grant execute on function public.create_league(text, text) to authenticated;
grant execute on function public.join_league(text) to authenticated;
