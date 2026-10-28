import type { GameMatchup } from "@/domain/types";
import { PickCard } from "@/components/picks/PickCard";

interface MatchupRowProps {
  game: GameMatchup;
  selectedTeamId: string | undefined;
  disabled: boolean;
  onSelect(gameId: string, teamId: string): void;
}

function localKickoff(instant: string): string {
  const parsed = new Date(instant);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error("Schedule contains an invalid kickoff timestamp.");
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(parsed);
}

export function MatchupRow({
  game,
  selectedTeamId,
  disabled,
  onSelect,
}: MatchupRowProps) {
  return (
    <article
      className="matchup card"
      aria-label={`${game.awayTeam.name} at ${game.homeTeam.name}`}
    >
      <div className="matchup-meta">
        <time dateTime={game.kickoffUtc}>{localKickoff(game.kickoffUtc)}</time>
        <span>{game.status.replace("_", " ")}</span>
      </div>
      <div className="matchup-teams">
        <PickCard
          teamId={game.awayTeam.id}
          teamName={game.awayTeam.name}
          selected={selectedTeamId === game.awayTeam.id}
          disabled={disabled}
          onToggle={(teamId) => onSelect(game.id, teamId)}
        />
        <span aria-hidden="true" className="versus">
          at
        </span>
        <PickCard
          teamId={game.homeTeam.id}
          teamName={game.homeTeam.name}
          selected={selectedTeamId === game.homeTeam.id}
          disabled={disabled}
          onToggle={(teamId) => onSelect(game.id, teamId)}
        />
      </div>
      {game.status === "final" && (
        <p className="muted" aria-label="Final score">
          Final: {game.awayTeam.name} {game.awayScore} – {game.homeTeam.name}{" "}
          {game.homeScore}
        </p>
      )}
    </article>
  );
}
