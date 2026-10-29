import { z } from "zod";
import { requireLeagueMember } from "@/lib/auth/require-league-member";
import { errorResponse, HttpError } from "@/lib/http/errors";
import { jsonOk } from "@/lib/http/responses";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
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
    const isLocked = now >= Date.parse(schedule.week.deadlineUtc);
    const membershipsResult = await supabase
      .from("league_memberships")
      .select("participant_id")
      .eq("league_id", leagueId);
    if (membershipsResult.error) {
      throw new HttpError(
        500,
        "PARTICIPANTS_UNAVAILABLE",
        membershipsResult.error.message,
      );
    }

    const participantIds = membershipsResult.data.map(
      (membership) => membership.participant_id,
    );
    const [profilesResult, submittedEntriesResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", participantIds),
      createSupabaseAdminClient()
        .from("weekly_entries")
        .select("participant_id")
        .eq("league_id", leagueId)
        .eq("week_id", schedule.week.id),
    ]);
    if (profilesResult.error) {
      throw new HttpError(
        500,
        "PARTICIPANTS_UNAVAILABLE",
        profilesResult.error.message,
      );
    }
    if (submittedEntriesResult.error) {
      throw new HttpError(
        500,
        "SUBMISSION_STATUS_UNAVAILABLE",
        submittedEntriesResult.error.message,
      );
    }

    const nameByParticipant = new Map(
      profilesResult.data.map((profile) => [
        profile.id,
        profile.display_name.trim() || "League member",
      ]),
    );
    const submittedParticipantIds = new Set(
      submittedEntriesResult.data.map((entry) => entry.participant_id),
    );
    const submissionStatuses = participantIds
      .map((participantId) => ({
        participantId,
        participantName:
          nameByParticipant.get(participantId) ?? "League member",
        isCurrentUser: participantId === user.id,
        hasSubmitted: submittedParticipantIds.has(participantId),
      }))
      .sort(
        (left, right) =>
          Number(right.isCurrentUser) - Number(left.isCurrentUser) ||
          left.participantName.localeCompare(right.participantName),
      );

    let otherEntries: {
      participantId: string;
      participantName: string;
      picks: { gameId: string; selectedTeamId: string }[];
    }[] = [];

    if (isLocked) {
      const entriesResult = await supabase
        .from("weekly_entries")
        .select("id, participant_id")
        .eq("league_id", leagueId)
        .eq("week_id", schedule.week.id)
        .neq("participant_id", user.id);
      if (entriesResult.error) {
        throw new HttpError(
          500,
          "ENTRIES_UNAVAILABLE",
          entriesResult.error.message,
        );
      }

      if (entriesResult.data.length > 0) {
        const entryIds = entriesResult.data.map((entry) => entry.id);
        const otherParticipantIds = [
          ...new Set(entriesResult.data.map((entry) => entry.participant_id)),
        ];
        const [picksResult, profilesResult] = await Promise.all([
          supabase
            .from("team_picks")
            .select("entry_id, game_id, selected_team_id")
            .in("entry_id", entryIds),
          supabase
            .from("profiles")
            .select("id, display_name")
            .in("id", otherParticipantIds),
        ]);
        if (picksResult.error) {
          throw new HttpError(
            500,
            "ENTRIES_UNAVAILABLE",
            picksResult.error.message,
          );
        }
        if (profilesResult.error) {
          throw new HttpError(
            500,
            "PARTICIPANTS_UNAVAILABLE",
            profilesResult.error.message,
          );
        }

        const nameByParticipant = new Map(
          profilesResult.data.map((profile) => [
            profile.id,
            profile.display_name.trim() || "League member",
          ]),
        );
        const picksByEntry = new Map<
          string,
          { gameId: string; selectedTeamId: string }[]
        >();
        for (const pick of picksResult.data) {
          const entryPicks = picksByEntry.get(pick.entry_id) ?? [];
          entryPicks.push({
            gameId: pick.game_id,
            selectedTeamId: pick.selected_team_id,
          });
          picksByEntry.set(pick.entry_id, entryPicks);
        }

        otherEntries = entriesResult.data.map((entry) => ({
          participantId: entry.participant_id,
          participantName:
            nameByParticipant.get(entry.participant_id) ?? "League member",
          picks: picksByEntry.get(entry.id) ?? [],
        }));
      }
    }

    return jsonOk({
      week: {
        ...schedule.week,
        isLocked,
      },
      games: schedule.games,
      myEntry,
      otherEntries,
      submissionStatuses,
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
