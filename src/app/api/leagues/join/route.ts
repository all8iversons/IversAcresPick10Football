import { z } from "zod";
import { requireCurrentParticipant } from "@/lib/auth/current-participant";
import { errorResponse, HttpError } from "@/lib/http/errors";
import { jsonOk } from "@/lib/http/responses";
import { parseJson } from "@/lib/validation/json-body";
import { hashInviteCode } from "@/services/leagues/invite-codes";

const joinLeagueSchema = z
  .object({
    inviteCode: z.string().min(32).max(128),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const { supabase } = await requireCurrentParticipant();
    const body = await parseJson(request, joinLeagueSchema);
    const result = await supabase.rpc("join_league", {
      p_invite_code_hash: hashInviteCode(body.inviteCode),
    });

    if (result.error?.code === "P0002") {
      throw new HttpError(404, "INVALID_INVITE", "The invite code is invalid.");
    }
    if (result.error) {
      throw new HttpError(
        400,
        "LEAGUE_JOIN_FAILED",
        "The league could not be joined.",
      );
    }
    const league = result.data[0];
    if (!league) {
      throw new HttpError(404, "INVALID_INVITE", "The invite code is invalid.");
    }

    return jsonOk({
      league: {
        id: league.id,
        name: league.name,
        role: league.role,
        createdAt: league.created_at,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
