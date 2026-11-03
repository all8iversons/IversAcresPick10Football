import "server-only";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { ESPNNFLScheduleService } from "@/services/nfl/espn/ESPNNFLScheduleService";
import { scoreFinalGames } from "@/services/scoring/score-final-games";

async function isWeekComplete(weekId: string): Promise<boolean> {
  const result = await createSupabaseAdminClient()
    .from("nfl_games")
    .select("status")
    .eq("week_id", weekId);
  if (result.error) throw result.error;
  return (
    result.data.length > 0 &&
    result.data.every(
      (game) => game.status === "final" || game.status === "cancelled",
    )
  );
}

// Pulls the latest results for a week, then awards points for final games.
// Weeks that are already complete are not fetched again. A schedule outage
// must not block showing previously stored points.
export async function refreshAndScoreWeek(
  season: number,
  weekNumber: number,
  weekId: string,
): Promise<void> {
  try {
    if (!(await isWeekComplete(weekId))) {
      await new ESPNNFLScheduleService().getRegularSeasonWeek(
        season,
        weekNumber,
      );
    }
  } catch (error) {
    console.error("Could not refresh game results before scoring", error);
  }
  await scoreFinalGames(weekId);
}
