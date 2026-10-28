import { rankStandings } from "@/domain/standings";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { HttpError } from "@/lib/http/errors";

export interface StandingView {
  participantId: string;
  displayName: string;
  points: number;
  rank: number;
}

async function getMemberships(leagueId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("league_memberships")
    .select("participant_id")
    .eq("league_id", leagueId);
  if (error) throw new HttpError(500, "STANDINGS_UNAVAILABLE", error.message);
  return { supabase, participantIds: data.map((row) => row.participant_id) };
}

async function getProfiles(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  participantIds: string[],
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", participantIds);
  if (error) throw new HttpError(500, "STANDINGS_UNAVAILABLE", error.message);
  return new Map(data.map((profile) => [profile.id, profile.display_name]));
}

async function getPicksForEntries(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  entryIds: string[],
): Promise<Array<{ entry_id: string; points_awarded: number | null }>> {
  if (entryIds.length === 0) return [];
  const { data, error } = await supabase
    .from("team_picks")
    .select("entry_id, points_awarded")
    .in("entry_id", entryIds);
  if (error) {
    throw new HttpError(500, "STANDINGS_UNAVAILABLE", error.message);
  }
  return data;
}

export async function getWeeklyStandings(
  leagueId: string,
  weekId: string,
): Promise<StandingView[]> {
  const { supabase, participantIds } = await getMemberships(leagueId);
  const names = await getProfiles(supabase, participantIds);
  if (participantIds.length === 0) return [];

  const entries = await supabase
    .from("weekly_entries")
    .select("id, participant_id")
    .eq("league_id", leagueId)
    .eq("week_id", weekId)
    .in("participant_id", participantIds);
  if (entries.error) {
    throw new HttpError(500, "STANDINGS_UNAVAILABLE", entries.error.message);
  }
  const entryIds = entries.data.map((entry) => entry.id);
  const picks = await getPicksForEntries(supabase, entryIds);

  const participantByEntry = new Map(
    entries.data.map((entry) => [entry.id, entry.participant_id]),
  );
  const totals = new Map(participantIds.map((id) => [id, 0]));
  for (const pick of picks) {
    const participantId = participantByEntry.get(pick.entry_id);
    if (participantId && pick.points_awarded !== null) {
      totals.set(
        participantId,
        (totals.get(participantId) ?? 0) + Number(pick.points_awarded),
      );
    }
  }

  return rankStandings(
    participantIds.map((participantId) => ({
      participantId,
      displayName: names.get(participantId) || "Participant",
      points: totals.get(participantId) ?? 0,
    })),
  );
}

export async function getSeasonStandings(
  leagueId: string,
  season: number,
): Promise<StandingView[]> {
  const { supabase, participantIds } = await getMemberships(leagueId);
  const names = await getProfiles(supabase, participantIds);
  if (participantIds.length === 0) return [];

  const weeks = await supabase
    .from("nfl_weeks")
    .select("id")
    .eq("season", season)
    .eq("season_type", 2);
  if (weeks.error) {
    throw new HttpError(500, "STANDINGS_UNAVAILABLE", weeks.error.message);
  }
  const weekIds = weeks.data.map((week) => week.id);
  if (weekIds.length === 0) {
    return rankStandings(
      participantIds.map((participantId) => ({
        participantId,
        displayName: names.get(participantId) || "Participant",
        points: 0,
      })),
    );
  }

  const games = await supabase
    .from("nfl_games")
    .select("id, week_id, status")
    .in("week_id", weekIds);
  if (games.error) {
    throw new HttpError(500, "STANDINGS_UNAVAILABLE", games.error.message);
  }
  const gamesByWeek = new Map<string, typeof games.data>();
  for (const game of games.data) {
    const weekGames = gamesByWeek.get(game.week_id) ?? [];
    weekGames.push(game);
    gamesByWeek.set(game.week_id, weekGames);
  }
  const completedWeekIds = [...gamesByWeek.entries()]
    .filter(
      ([, weekGames]) =>
        weekGames.length > 0 &&
        weekGames.every(
          (game) => game.status === "final" || game.status === "cancelled",
        ),
    )
    .map(([weekId]) => weekId);
  if (completedWeekIds.length === 0) {
    return rankStandings(
      participantIds.map((participantId) => ({
        participantId,
        displayName: names.get(participantId) || "Participant",
        points: 0,
      })),
    );
  }

  const entries = await supabase
    .from("weekly_entries")
    .select("id, participant_id")
    .eq("league_id", leagueId)
    .in("week_id", completedWeekIds)
    .in("participant_id", participantIds);
  if (entries.error) {
    throw new HttpError(500, "STANDINGS_UNAVAILABLE", entries.error.message);
  }
  const entryIds = entries.data.map((entry) => entry.id);
  const picks = await getPicksForEntries(supabase, entryIds);

  const participantByEntry = new Map(
    entries.data.map((entry) => [entry.id, entry.participant_id]),
  );
  const totals = new Map(participantIds.map((id) => [id, 0]));
  for (const pick of picks) {
    const participantId = participantByEntry.get(pick.entry_id);
    if (participantId && pick.points_awarded !== null) {
      totals.set(
        participantId,
        (totals.get(participantId) ?? 0) + Number(pick.points_awarded),
      );
    }
  }

  return rankStandings(
    participantIds.map((participantId) => ({
      participantId,
      displayName: names.get(participantId) || "Participant",
      points: totals.get(participantId) ?? 0,
    })),
  );
}
