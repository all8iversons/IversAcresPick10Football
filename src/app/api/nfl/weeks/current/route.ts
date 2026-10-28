import { requireCurrentParticipant } from "@/lib/auth/current-participant";
import { errorResponse } from "@/lib/http/errors";
import { jsonOk } from "@/lib/http/responses";
import {
  ESPNNFLScheduleService,
  ScheduleUnavailableError,
} from "@/services/nfl/espn/ESPNNFLScheduleService";

export async function GET() {
  try {
    await requireCurrentParticipant();
    const schedule =
      await new ESPNNFLScheduleService().getCurrentRegularSeasonWeek();
    return jsonOk({
      week: {
        ...schedule.week,
        isLocked: Date.now() >= Date.parse(schedule.week.deadlineUtc),
      },
      games: schedule.games,
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
