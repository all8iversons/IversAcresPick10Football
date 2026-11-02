import "server-only";
import { selectDefaultPicks } from "@/domain/default-picks";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";

// Fills in entries for league members who did not submit before the deadline.
// Safe to call repeatedly and concurrently: existing entries are never changed.
export async function assignDefaultPicks(
  leagueId: string,
  weekId: string,
): Promise<void> {
  const database = createSupabaseAdminClient();
  const weekResult = await database
    .from("nfl_weeks")
    .select("deadline_utc")
    .eq("id", weekId)
    .maybeSingle();
  if (weekResult.error) throw weekResult.error;
  if (!weekResult.data) return;
  const deadlineUtc = weekResult.data.deadline_utc;
  const deadline = Date.parse(deadlineUtc);
  if (Date.now() < deadline) return;

  const [membersResult, entriesResult, gamesResult] = await Promise.all([
    database
      .from("league_memberships")
      .select("participant_id, joined_at")
      .eq("league_id", leagueId),
    database
      .from("weekly_entries")
      .select("participant_id")
      .eq("league_id", leagueId)
      .eq("week_id", weekId),
    database
      .from("nfl_games")
      .select("id, home_team_id, kickoff_utc")
      .eq("week_id", weekId),
  ]);
  if (membersResult.error) throw membersResult.error;
  if (entriesResult.error) throw entriesResult.error;
  if (gamesResult.error) throw gamesResult.error;

  const submitted = new Set(
    entriesResult.data.map((entry) => entry.participant_id),
  );
  const missing = membersResult.data.filter(
    (member) =>
      !submitted.has(member.participant_id) &&
      Date.parse(member.joined_at) < deadline,
  );
  if (missing.length === 0) return;

  const picks = selectDefaultPicks(
    gamesResult.data.map((game) => ({
      id: game.id,
      homeTeamId: game.home_team_id,
      kickoffUtc: game.kickoff_utc,
    })),
  );
  if (picks.length === 0) return;

  const insertedEntries = await database.from("weekly_entries").upsert(
    missing.map((member) => ({
      league_id: leagueId,
      participant_id: member.participant_id,
      week_id: weekId,
      submitted_at: deadlineUtc,
      updated_at: deadlineUtc,
    })),
    { onConflict: "league_id,participant_id,week_id", ignoreDuplicates: true },
  );
  if (insertedEntries.error) throw insertedEntries.error;

  const entryRows = await database
    .from("weekly_entries")
    .select("id")
    .eq("league_id", leagueId)
    .eq("week_id", weekId)
    .in(
      "participant_id",
      missing.map((member) => member.participant_id),
    );
  if (entryRows.error) throw entryRows.error;

  const pickRows = await database.from("team_picks").upsert(
    entryRows.data.flatMap((entry) =>
      picks.map((pick) => ({
        entry_id: entry.id,
        game_id: pick.gameId,
        selected_team_id: pick.selectedTeamId,
      })),
    ),
    { onConflict: "entry_id,game_id", ignoreDuplicates: true },
  );
  if (pickRows.error) throw pickRows.error;
}
