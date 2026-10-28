import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLeagueMember } from "@/lib/auth/require-league-member";

type ResultsPageProps = {
  params: Promise<{ leagueId: string; season: string; weekNumber: string }>;
};

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { leagueId, season: seasonText, weekNumber: weekText } = await params;
  const { supabase, user } = await requireLeagueMember(leagueId);
  const season = Number(seasonText);
  const weekNumber = Number(weekText);
  if (!Number.isInteger(season) || !Number.isInteger(weekNumber)) notFound();

  const week = await supabase
    .from("nfl_weeks")
    .select("id, deadline_utc")
    .eq("season", season)
    .eq("season_type", 2)
    .eq("week_number", weekNumber)
    .maybeSingle();
  if (week.error)
    throw new Error(`Could not load results: ${week.error.message}`);
  if (!week.data) notFound();

  const entry = await supabase
    .from("weekly_entries")
    .select("id")
    .eq("league_id", leagueId)
    .eq("participant_id", user.id)
    .eq("week_id", week.data.id)
    .maybeSingle();
  if (entry.error)
    throw new Error(`Could not load your entry: ${entry.error.message}`);

  let picks: Array<{
    selected_team_id: string;
    points_awarded: number | null;
    game_id: string;
  }> = [];
  if (entry.data) {
    const pickRows = await supabase
      .from("team_picks")
      .select("game_id, selected_team_id, points_awarded")
      .eq("entry_id", entry.data.id);
    if (pickRows.error)
      throw new Error(`Could not load your results: ${pickRows.error.message}`);
    picks = pickRows.data;
  }

  let gameById = new Map<
    string,
    {
      id: string;
      home_team_name: string;
      away_team_name: string;
      home_score: number | null;
      away_score: number | null;
      status: string;
    }
  >();
  if (picks.length > 0) {
    const games = await supabase
      .from("nfl_games")
      .select(
        "id, home_team_name, away_team_name, home_score, away_score, status",
      )
      .in(
        "id",
        picks.map((pick) => pick.game_id),
      );
    if (games.error)
      throw new Error(`Could not load game results: ${games.error.message}`);
    gameById = new Map(games.data.map((game) => [game.id, game]));
  }
  const points = picks.reduce(
    (total, pick) => total + (pick.points_awarded ?? 0),
    0,
  );

  return (
    <main className="page-shell">
      <header className="site-header">
        <Link className="brand" href="/leagues">
          Ivers Acres Pick 10
        </Link>
        <Link
          href={`/leagues/${leagueId}/standings?period=week&season=${season}&weekNumber=${weekNumber}`}
        >
          Weekly standings
        </Link>
      </header>
      <section className="content stack">
        <h1>Week {weekNumber} results</h1>
        {picks.length === 0 ? (
          <p className="card" role="status">
            You have no picks for this week.
          </p>
        ) : (
          <>
            <p className="card">
              Points earned: <strong>{points.toFixed(1)}</strong>
            </p>
            <ul className="stack">
              {picks.map((pick) => {
                const game = gameById.get(pick.game_id);
                return (
                  <li className="card" key={pick.game_id}>
                    <strong>
                      {game?.away_team_name} at {game?.home_team_name}
                    </strong>
                    <span>
                      {" "}
                      — selected team {pick.selected_team_id};{" "}
                      {game?.status === "final"
                        ? `${pick.points_awarded?.toFixed(1) ?? "0.0"} points`
                        : "not final"}
                    </span>
                    {game?.status === "final" && (
                      <p className="muted">
                        Final: {game.away_score}–{game.home_score}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
