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

  // Every pick on a game is worth the same for a given selected team, so
  // update by game and team instead of by individual pick. Picks that already
  // have points are left alone.
  const updates = gamesResult.data.flatMap((game) =>
    [game.home_team_id, game.away_team_id].flatMap((teamId) => {
      const points = scorePick(
        teamId,
        game.home_team_id,
        game.away_team_id,
        game.final_result,
      );
      return points === null ? [] : [{ gameId: game.id, teamId, points }];
    }),
  );

  const results = await Promise.all(
    updates.map((update) =>
      database
        .from("team_picks")
        .update({ points_awarded: update.points })
        .eq("game_id", update.gameId)
        .eq("selected_team_id", update.teamId)
        .is("points_awarded", null),
    ),
  );
  for (const result of results) {
    if (result.error) throw result.error;
  }
}
