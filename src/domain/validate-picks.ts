import type { GameMatchup, UserPick } from "@/domain/types";

export type PickValidationResult =
  | { valid: true }
  | {
      valid: false;
      code:
        | "PICK_COUNT"
        | "DUPLICATE_GAME"
        | "DUPLICATE_TEAM"
        | "UNKNOWN_GAME"
        | "INVALID_TEAM";
      message: string;
    };

export function validateWeeklyPicks(
  picks: readonly Pick<UserPick, "gameId" | "selectedTeamId">[],
  games: readonly GameMatchup[],
): PickValidationResult {
  if (picks.length !== 10) {
    return {
      valid: false,
      code: "PICK_COUNT",
      message: "Choose exactly 10 teams.",
    };
  }

  const gamesById = new Map(games.map((game) => [game.id, game]));
  const selectedGameIds = new Set<string>();
  const selectedTeamIds = new Set<string>();

  for (const pick of picks) {
    if (selectedGameIds.has(pick.gameId)) {
      return {
        valid: false,
        code: "DUPLICATE_GAME",
        message: "Choose only one team from each game.",
      };
    }
    selectedGameIds.add(pick.gameId);

    if (selectedTeamIds.has(pick.selectedTeamId)) {
      return {
        valid: false,
        code: "DUPLICATE_TEAM",
        message: "Each selected team must be distinct.",
      };
    }
    selectedTeamIds.add(pick.selectedTeamId);

    const game = gamesById.get(pick.gameId);
    if (!game) {
      return {
        valid: false,
        code: "UNKNOWN_GAME",
        message: "A selected game is not in this week's schedule.",
      };
    }
    if (
      pick.selectedTeamId !== game.homeTeam.id &&
      pick.selectedTeamId !== game.awayTeam.id
    ) {
      return {
        valid: false,
        code: "INVALID_TEAM",
        message: "A selected team is not playing in its selected game.",
      };
    }
  }

  return { valid: true };
}
