import "server-only";
import { ESPNNFLScheduleService } from "@/services/nfl/espn/ESPNNFLScheduleService";
import { scoreFinalGames } from "@/services/scoring/score-final-games";

// Pulls the latest results for a week, then awards points for final games.
// A schedule outage must not block showing previously stored points.
export async function refreshAndScoreWeek(
  season: number,
  weekNumber: number,
  weekId: string,
): Promise<void> {
  try {
    await new ESPNNFLScheduleService().getRegularSeasonWeek(season, weekNumber);
  } catch (error) {
    console.error("Could not refresh game results before scoring", error);
  }
  await scoreFinalGames(weekId);
}
