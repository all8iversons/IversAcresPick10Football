import type { FinalResult, UserPick } from "@/domain/types";

export function scorePick(
  selectedTeamId: string,
  homeTeamId: string,
  awayTeamId: string,
  finalResult: FinalResult,
): number | null {
  if (finalResult === "undetermined") return null;
  if (finalResult === "tie") {
    return selectedTeamId === homeTeamId || selectedTeamId === awayTeamId
      ? 0.5
      : null;
  }
  if (finalResult === "home_win") {
    return selectedTeamId === homeTeamId ? 1 : 0;
  }
  return selectedTeamId === awayTeamId ? 1 : 0;
}

export function scorePicks(
  picks: readonly UserPick[],
  results: ReadonlyMap<
    string,
    {
      homeTeamId: string;
      awayTeamId: string;
      finalResult: FinalResult;
      status: string;
    }
  >,
): UserPick[] {
  return picks.map((pick) => {
    const game = results.get(pick.gameId);
    if (!game || game.status !== "final") {
      return { ...pick, pointsAwarded: null };
    }
    return {
      ...pick,
      pointsAwarded: scorePick(
        pick.selectedTeamId,
        game.homeTeamId,
        game.awayTeamId,
        game.finalResult,
      ),
    };
  });
}
