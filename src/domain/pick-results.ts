import { scorePick } from "@/domain/scoring";
import type { GameMatchup } from "@/domain/types";

export type PickOutcome = "win" | "loss" | "tie" | "pending";

type ResultGame = Pick<
  GameMatchup,
  "status" | "finalResult" | "homeTeam" | "awayTeam"
>;

export function getPickOutcome(
  game: ResultGame | undefined,
  selectedTeamId: string,
): PickOutcome {
  if (!game || game.status !== "final") return "pending";
  const points = scorePick(
    selectedTeamId,
    game.homeTeam.id,
    game.awayTeam.id,
    game.finalResult,
  );
  if (points === 1) return "win";
  if (points === 0) return "loss";
  if (points === 0.5) return "tie";
  return "pending";
}

export function summarizePickOutcomes(outcomes: readonly PickOutcome[]): {
  correct: number;
  finished: number;
} {
  return {
    correct: outcomes.filter((outcome) => outcome === "win").length,
    finished: outcomes.filter((outcome) => outcome !== "pending").length,
  };
}
