alter table public.leagues
  add column invite_code text;

update public.leagues
set invite_code = encode(extensions.gen_random_bytes(32), 'hex');

update public.leagues
set invite_code_hash = encode(
  extensions.digest(invite_code, 'sha256'),
  'hex'
);

alter table public.leagues
  alter column invite_code set not null;

create unique index leagues_invite_code_key
  on public.leagues (invite_code);

drop function public.create_league(text, text);

create function public.create_league(
  p_name text,
  p_invite_code_hash text,
  p_invite_code text
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
  if p_invite_code is null
    or length(p_invite_code) not between 32 and 128
    or p_invite_code_hash is distinct from encode(
      extensions.digest(p_invite_code, 'sha256'),
      'hex'
    )
  then
    raise exception using errcode = '22023', message = 'Invalid invite code';
  end if;

  insert into public.leagues (name, invite_code, invite_code_hash, created_by)
  values (btrim(p_name), p_invite_code, p_invite_code_hash, v_user_id)
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

revoke all on function public.create_league(text, text, text) from public;
grant execute on function public.create_league(text, text, text) to authenticated;
