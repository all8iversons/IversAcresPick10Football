import { z } from "zod";
import { validateWeeklyPicks } from "@/domain/validate-picks";
import { requireLeagueMember } from "@/lib/auth/require-league-member";
import { errorResponse, HttpError } from "@/lib/http/errors";
import { jsonOk } from "@/lib/http/responses";
import { parseJson } from "@/lib/validation/json-body";
import {
  ESPNNFLScheduleService,
  ScheduleUnavailableError,
} from "@/services/nfl/espn/ESPNNFLScheduleService";

type RouteContext = {
  params: Promise<{ leagueId: string; season: string; weekNumber: string }>;
};

const pickSubmissionSchema = z
  .object({
    picks: z
      .array(
        z
          .object({
            gameId: z.string().uuid(),
            selectedTeamId: z.string().min(1).max(64),
          })
          .strict(),
      )
      .length(10),
  })
  .strict();
const weekParametersSchema = z.object({
  season: z.coerce.number().int().min(2000).max(2200),
  weekNumber: z.coerce.number().int().min(1).max(18),
});

export async function PUT(request: Request, context: RouteContext) {
  try {
    const {
      leagueId,
      season: seasonText,
      weekNumber: weekText,
    } = await context.params;
    const { supabase } = await requireLeagueMember(leagueId);
    const { picks } = await parseJson(request, pickSubmissionSchema);
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
    const result = validateWeeklyPicks(picks, schedule.games);
    if (!result.valid) {
      throw new HttpError(422, result.code, result.message);
    }

    const submission = await supabase.rpc("submit_weekly_entry", {
      p_league_id: leagueId,
      p_week_id: schedule.week.id,
      p_picks: picks,
    });
    if (submission.error?.message === "PICKS_LOCKED") {
      throw new HttpError(
        409,
        "PICKS_LOCKED",
        "Picks can no longer be changed for this week.",
      );
    }
    if (submission.error?.code === "22023") {
      throw new HttpError(
        422,
        "INVALID_PICKS",
        "The submitted picks do not match this week's schedule.",
      );
    }
    if (submission.error?.code === "P0002") {
      throw new HttpError(
        404,
        "WEEK_NOT_FOUND",
        "The requested week could not be found.",
      );
    }
    if (submission.error) {
      throw new HttpError(
        500,
        "SUBMISSION_FAILED",
        "The entry could not be saved.",
      );
    }

    const entry = await supabase
      .from("weekly_entries")
      .select("id, submitted_at")
      .eq("id", submission.data)
      .single();
    if (entry.error) {
      throw new HttpError(500, "SUBMISSION_FAILED", entry.error.message);
    }
    return jsonOk({
      entry: {
        id: entry.data.id,
        submittedAt: entry.data.submitted_at,
        picks,
      },
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
