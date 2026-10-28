import "server-only";
import { scorePick } from "@/domain/scoring";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";

export async function scoreFinalGames(weekId: string): Promise<void> {
  const database = createSupabaseAdminClient();
  const gamesResult = await database
    .from("nfl_games")
    .select("id, home_team_id, away_team_id, final_result, status")
    .eq("week_id", weekId)
    .eq("status", "final");
  if (gamesResult.error) throw gamesResult.error;
  if (gamesResult.data.length === 0) return;

  const resultByGame = new Map(
    gamesResult.data.map((game) => [
      game.id,
      {
        homeTeamId: game.home_team_id,
        awayTeamId: game.away_team_id,
        finalResult: game.final_result,
        status: game.status,
      },
    ]),
  );
  const picksResult = await database
    .from("team_picks")
    .select("entry_id, game_id, selected_team_id")
    .in("game_id", [...resultByGame.keys()]);
  if (picksResult.error) throw picksResult.error;

  for (const pick of picksResult.data) {
    const game = resultByGame.get(pick.game_id);
    if (!game) continue;
    const points = scorePick(
      pick.selected_team_id,
      game.homeTeamId,
      game.awayTeamId,
      game.finalResult,
    );
    if (points === null) continue;

    const update = await database
      .from("team_picks")
      .update({ points_awarded: points })
      .eq("entry_id", pick.entry_id)
      .eq("game_id", pick.game_id);
    if (update.error) throw update.error;
  }
}
