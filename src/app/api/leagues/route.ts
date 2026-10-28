import { z } from "zod";
import { requireCurrentParticipant } from "@/lib/auth/current-participant";
import { errorResponse, HttpError } from "@/lib/http/errors";
import { jsonOk } from "@/lib/http/responses";
import { parseJson } from "@/lib/validation/json-body";
import {
  createInviteCode,
  hashInviteCode,
} from "@/services/leagues/invite-codes";

const createLeagueSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
  })
  .strict();

export async function GET() {
  try {
    const { supabase, user } = await requireCurrentParticipant();
    const memberships = await supabase
      .from("league_memberships")
      .select("league_id, role")
      .eq("participant_id", user.id);
    if (memberships.error) {
      throw new HttpError(
        500,
        "LEAGUES_UNAVAILABLE",
        memberships.error.message,
      );
    }

    if (memberships.data.length === 0) return jsonOk({ leagues: [] });
    const leagues = await supabase
      .from("leagues")
      .select("id, name, invite_code, created_at")
      .in(
        "id",
        memberships.data.map((membership) => membership.league_id),
      );
    if (leagues.error) {
      throw new HttpError(500, "LEAGUES_UNAVAILABLE", leagues.error.message);
    }

    const roleByLeague = new Map(
      memberships.data.map((membership) => [
        membership.league_id,
        membership.role,
      ]),
    );
    return jsonOk({
      leagues: leagues.data.map((league) => ({
        id: league.id,
        name: league.name,
        inviteCode: league.invite_code,
        role: roleByLeague.get(league.id) ?? "member",
        createdAt: league.created_at,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireCurrentParticipant();
    const body = await parseJson(request, createLeagueSchema);
    const inviteCode = createInviteCode();
    const result = await supabase.rpc("create_league", {
      p_name: body.name,
      p_invite_code_hash: hashInviteCode(inviteCode),
      p_invite_code: inviteCode,
    });
    if (result.error) {
      throw new HttpError(
        400,
        "LEAGUE_CREATE_FAILED",
        "The league could not be created.",
      );
    }
    const league = result.data[0];
    if (!league) {
      throw new HttpError(
        500,
        "LEAGUE_CREATE_FAILED",
        "The league was not returned.",
      );
    }
    return jsonOk(
      {
        league: {
          id: league.id,
          name: league.name,
          role: league.role,
          createdAt: league.created_at,
        },
        inviteCode,
      },
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
