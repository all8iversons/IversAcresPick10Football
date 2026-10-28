import type { StandingView } from "@/services/standings/standings-service";

interface LeaderboardTableProps {
  standings: StandingView[];
  emptyMessage?: string;
}

export function LeaderboardTable({
  standings,
  emptyMessage = "No standings are available yet.",
}: LeaderboardTableProps) {
  if (standings.length === 0) {
    return (
      <p className="card" role="status">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="card table-scroll">
      <table>
        <caption className="visually-hidden">League standings</caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Participant</th>
            <th scope="col">Points</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((standing) => (
            <tr key={standing.participantId}>
              <td>{standing.rank}</td>
              <th scope="row">{standing.displayName}</th>
              <td>{standing.points.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
