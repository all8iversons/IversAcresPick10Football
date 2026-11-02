export interface DefaultPickGame {
  id: string;
  homeTeamId: string;
  kickoffUtc: string;
}

export const REQUIRED_PICK_COUNT = 10;

// Players who miss the deadline get the home team of the first ten games,
// ordered by kickoff time (game id breaks ties for a stable result).
export function selectDefaultPicks(
  games: readonly DefaultPickGame[],
): { gameId: string; selectedTeamId: string }[] {
  if (games.length < REQUIRED_PICK_COUNT) return [];
  return [...games]
    .sort(
      (left, right) =>
        Date.parse(left.kickoffUtc) - Date.parse(right.kickoffUtc) ||
        left.id.localeCompare(right.id),
    )
    .slice(0, REQUIRED_PICK_COUNT)
    .map((game) => ({ gameId: game.id, selectedTeamId: game.homeTeamId }));
}
