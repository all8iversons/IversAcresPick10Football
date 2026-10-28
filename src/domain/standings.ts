export interface StandingInput {
  participantId: string;
  displayName: string;
  points: number;
}

export interface RankedStanding extends StandingInput {
  rank: number;
}

export function rankStandings(
  standings: readonly StandingInput[],
): RankedStanding[] {
  const sorted = [...standings].sort(
    (left, right) =>
      right.points - left.points ||
      left.displayName.localeCompare(right.displayName),
  );
  let previousPoints: number | undefined;
  let currentRank = 0;

  return sorted.map((standing, index) => {
    if (standing.points !== previousPoints) {
      currentRank = index + 1;
      previousPoints = standing.points;
    }
    return { ...standing, rank: currentRank };
  });
}
