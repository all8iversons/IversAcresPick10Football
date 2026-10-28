revoke all on function public.is_league_member(uuid) from public;
grant execute on function public.is_league_member(uuid) to authenticated;

create policy "league members can read their leagues"
  on public.leagues for select to authenticated
  using (public.is_league_member(id));

create policy "league members can read memberships"
  on public.league_memberships for select to authenticated
  using (public.is_league_member(league_id));

create policy "participants can read profiles of league members"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1
      from public.league_memberships membership
      where membership.participant_id = id
        and public.is_league_member(membership.league_id)
    )
  );
