import { z } from "zod";
import { requireLeagueMember } from "@/lib/auth/require-league-member";
import { HttpError, errorResponse } from "@/lib/http/errors";
import { jsonOk } from "@/lib/http/responses";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import {
  getSeasonStandings,
  getWeeklyStandings,
} from "@/services/standings/standings-service";
import { scoreFinalGames } from "@/services/scoring/score-final-games";
import { ESPNNFLScheduleService } from "@/services/nfl/espn/ESPNNFLScheduleService";

type RouteContext = {
  params: Promise<{ leagueId: string }>;
};

const querySchema = z.discriminatedUnion("period", [
  z.object({
    period: z.literal("week"),
    season: z.coerce.number().int().min(2000).max(2200),
    weekNumber: z.coerce.number().int().min(1).max(18),
  }),
  z.object({
    period: z.literal("season"),
    season: z.coerce.number().int().min(2000).max(2200),
  }),
]);

export async function GET(request: Request, context: RouteContext) {
  try {
    const { leagueId } = await context.params;
    await requireLeagueMember(leagueId);
    const parsed = querySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    if (!parsed.success) {
      throw new HttpError(
        422,
        "INVALID_STANDINGS_REQUEST",
        "Select a valid week or season.",
      );
    }

    if (parsed.data.period === "week") {
      const schedule = await new ESPNNFLScheduleService().getRegularSeasonWeek(
        parsed.data.season,
        parsed.data.weekNumber,
      );
      await scoreFinalGames(schedule.week.id);
      const standings = await getWeeklyStandings(leagueId, schedule.week.id);
      return jsonOk({
        period: "week",
        season: parsed.data.season,
        weekNumber: parsed.data.weekNumber,
        standings,
      });
    }

    const supabase = await createSupabaseServerClient();
    const weeks = await supabase
      .from("nfl_weeks")
      .select("id")
      .eq("season", parsed.data.season)
      .eq("season_type", 2);
    if (weeks.error) {
      throw new HttpError(500, "STANDINGS_UNAVAILABLE", weeks.error.message);
    }
    for (const week of weeks.data) {
      await scoreFinalGames(week.id);
    }
    const standings = await getSeasonStandings(leagueId, parsed.data.season);
    return jsonOk({
      period: "season",
      season: parsed.data.season,
      standings,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
