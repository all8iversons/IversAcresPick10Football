import { HttpError } from "@/lib/http/errors";
import { requireCurrentParticipant } from "@/lib/auth/current-participant";

export async function requireLeagueMember(leagueId: string) {
  const { supabase, user } = await requireCurrentParticipant();
  const { data, error } = await supabase
    .from("league_memberships")
    .select("role")
    .eq("league_id", leagueId)
    .eq("participant_id", user.id)
    .maybeSingle();

  if (error) throw new HttpError(500, "AUTHORIZATION_FAILED", error.message);
  if (!data) {
    throw new HttpError(404, "LEAGUE_NOT_FOUND", "League not found.");
  }
  return { supabase, user, role: data.role };
}
