import { z } from "zod";
import { requireLeagueMember } from "@/lib/auth/require-league-member";
import { errorResponse, HttpError } from "@/lib/http/errors";
import { jsonOk } from "@/lib/http/responses";
import {
  ESPNNFLScheduleService,
  ScheduleUnavailableError,
} from "@/services/nfl/espn/ESPNNFLScheduleService";

type RouteContext = {
  params: Promise<{ leagueId: string; season: string; weekNumber: string }>;
};

const weekParametersSchema = z.object({
  season: z.coerce.number().int().min(2000).max(2200),
  weekNumber: z.coerce.number().int().min(1).max(18),
});

export async function GET(_request: Request, context: RouteContext) {
  try {
    const {
      leagueId,
      season: seasonText,
      weekNumber: weekText,
    } = await context.params;
    const { supabase, user } = await requireLeagueMember(leagueId);
    const parsedParams = weekParametersSchema.safeParse({
      season: seasonText,
      weekNumber: weekText,
    });
    if (!parsedParams.success) {
      throw new HttpError(422, "INVALID_WEEK", "Select a valid NFL week.");
    }
    const schedule = await new ESPNNFLScheduleService().getRegularSeasonWeek(
      parsedParams.data.season,
      parsedParams.data.weekNumber,
    );
    const entryResult = await supabase
      .from("weekly_entries")
      .select("id, submitted_at, updated_at")
      .eq("league_id", leagueId)
      .eq("participant_id", user.id)
      .eq("week_id", schedule.week.id)
      .maybeSingle();
    if (entryResult.error) {
      throw new HttpError(500, "ENTRY_UNAVAILABLE", entryResult.error.message);
    }

    let myEntry = null;
    if (entryResult.data) {
      const picksResult = await supabase
        .from("team_picks")
        .select("game_id, selected_team_id, points_awarded")
        .eq("entry_id", entryResult.data.id);
      if (picksResult.error) {
        throw new HttpError(
          500,
          "ENTRY_UNAVAILABLE",
          picksResult.error.message,
        );
      }
      myEntry = {
        id: entryResult.data.id,
        submittedAt: entryResult.data.submitted_at,
        updatedAt: entryResult.data.updated_at,
        picks: picksResult.data.map((pick) => ({
          gameId: pick.game_id,
          selectedTeamId: pick.selected_team_id,
          pointsAwarded: pick.points_awarded,
        })),
      };
    }

    const now = Date.now();
    return jsonOk({
      week: {
        ...schedule.week,
        isLocked: now >= Date.parse(schedule.week.deadlineUtc),
      },
      games: schedule.games,
      myEntry,
    });
  } catch (error) {
    if (error instanceof ScheduleUnavailableError) {
      return Response.json(
        { error: { code: "SCHEDULE_UNAVAILABLE", message: error.message } },
        { status: 503 },
      );
    }
    return errorResponse(error);
  }
}
