import {
  getPickOutcome,
  summarizePickOutcomes,
  type PickOutcome,
} from "@/domain/pick-results";
import type { GameMatchup } from "@/domain/types";

interface PickResultsListProps {
  picks: readonly { gameId: string; selectedTeamId: string }[];
  games: readonly GameMatchup[];
}

const outcomeDisplay: Record<
  PickOutcome,
  { symbol: string; label: string; className: string } | null
> = {
  win: { symbol: "✓", label: "Correct", className: "pick-result-win" },
  loss: { symbol: "✗", label: "Incorrect", className: "pick-result-loss" },
  tie: { symbol: "½", label: "Tied game", className: "pick-result-tie" },
  pending: null,
};

export function PickResultsList({ picks, games }: PickResultsListProps) {
  const entries = picks.map((pick) => {
    const game = games.find((scheduledGame) => scheduledGame.id === pick.gameId);
    const teamName =
      game?.homeTeam.id === pick.selectedTeamId
        ? game.homeTeam.name
        : game?.awayTeam.id === pick.selectedTeamId
          ? game.awayTeam.name
          : "Unknown team";
    return {
      gameId: pick.gameId,
      teamName,
      outcome: getPickOutcome(game, pick.selectedTeamId),
    };
  });
  const { correct, finished } = summarizePickOutcomes(
    entries.map((entry) => entry.outcome),
  );

  return (
    <>
      <p className="pick-total">
        Week total:{" "}
        <strong aria-label={`${correct} correct of ${finished} finished games`}>
          {correct}/{finished}
        </strong>
      </p>
      <ul className="pick-results">
        {entries.map((entry) => {
          const display = outcomeDisplay[entry.outcome];
          return (
            <li key={entry.gameId}>
              {display && (
                <span
                  aria-label={display.label}
                  className={display.className}
                  role="img"
                >
                  {display.symbol}
                </span>
              )}{" "}
              {entry.teamName}
            </li>
          );
        })}
      </ul>
    </>
  );
}
