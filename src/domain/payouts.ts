export interface WeeklyParticipantScore {
  participantId: string;
  points: number;
}

export interface SeasonParticipantScore {
  participantId: string;
  points: number;
}

export interface Payout {
  participantId: string;
  amount: number;
}

export interface WeeklyPayoutResult {
  outcome: "jackpot" | "runner_up" | "rollover";
  payouts: Payout[];
  rolloverAmount: number;
}

export interface SeasonPayoutResult {
  payouts: Payout[];
  remainingAmount: number;
}

function validateAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError("Pot amount must be a finite non-negative number.");
  }
}

function validateScores(
  scores: readonly WeeklyParticipantScore[],
  maxPoints?: number,
): void {
  if (scores.length === 0) {
    throw new RangeError("At least one participant score is required.");
  }

  const participantIds = new Set<string>();
  for (const score of scores) {
    if (!score.participantId || participantIds.has(score.participantId)) {
      throw new RangeError("Participant IDs must be non-empty and unique.");
    }
    if (
      !Number.isFinite(score.points) ||
      score.points < 0 ||
      score.points * 2 !== Math.round(score.points * 2) ||
      (maxPoints !== undefined && score.points > maxPoints)
    ) {
      throw new RangeError("Participant score is outside the valid range.");
    }
    participantIds.add(score.participantId);
  }
}

function splitPayout(
  amount: number,
  participantIds: readonly string[],
): Payout[] {
  const perParticipant = amount / participantIds.length;
  return [...participantIds]
    .sort((left, right) => left.localeCompare(right))
    .map((participantId) => ({ participantId, amount: perParticipant }));
}

export function calculateWeeklyPayout(
  potAmount: number,
  scores: readonly WeeklyParticipantScore[],
): WeeklyPayoutResult {
  validateAmount(potAmount);
  validateScores(scores, 10);

  const perfectScores = scores.filter((score) => score.points === 10);
  if (perfectScores.length > 0) {
    return {
      outcome: "jackpot",
      payouts: splitPayout(
        potAmount,
        perfectScores.map((score) => score.participantId),
      ),
      rolloverAmount: 0,
    };
  }

  const runnerUpScores = scores.filter((score) => score.points >= 9);
  if (runnerUpScores.length > 0) {
    const highestRunnerUpScore = Math.max(
      ...runnerUpScores.map((score) => score.points),
    );
    return {
      outcome: "runner_up",
      payouts: splitPayout(
        potAmount / 2,
        runnerUpScores
          .filter((score) => score.points === highestRunnerUpScore)
          .map((score) => score.participantId),
      ),
      rolloverAmount: potAmount / 2,
    };
  }

  return {
    outcome: "rollover",
    payouts: [],
    rolloverAmount: potAmount,
  };
}

export function calculateSeasonEndPayout(
  remainingAmount: number,
  scores: readonly SeasonParticipantScore[],
): SeasonPayoutResult {
  validateAmount(remainingAmount);
  validateScores(scores);

  const highestScore = Math.max(...scores.map((score) => score.points));
  const leaders = scores
    .filter((score) => score.points === highestScore)
    .map((score) => score.participantId);

  return {
    payouts: splitPayout(remainingAmount, leaders),
    remainingAmount: 0,
  };
}
