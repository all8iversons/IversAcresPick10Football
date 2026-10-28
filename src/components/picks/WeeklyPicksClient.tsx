"use client";

import Link from "next/link";
import { useWeeklyPicks } from "@/hooks/use-weekly-picks";
import { MatchupRow } from "@/components/picks/MatchupRow";
import { PickCount } from "@/components/picks/PickCount";

interface WeeklyPicksClientProps {
  leagueId: string;
  season: number;
  weekNumber: number;
}

export function WeeklyPicksClient({
  leagueId,
  season,
  weekNumber,
}: WeeklyPicksClientProps) {
  const {
    week,
    games,
    picks,
    loading,
    saving,
    submitted,
    error,
    now,
    selectedByGame,
    selectTeam,
    submit,
  } = useWeeklyPicks(leagueId, season, weekNumber);
  const isLocked =
    !week ||
    now === null ||
    now >= Date.parse(week.deadlineUtc) ||
    week.isLocked;
  const deadlineLabel = week
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "full",
        timeStyle: "short",
      }).format(new Date(week.deadlineUtc))
    : "";

  if (loading) {
    return (
      <p className="content" role="status">
        Loading the NFL schedule...
      </p>
    );
  }
  if (!week) {
    return (
      <main className="content stack">
        <Link href="/leagues">Back to leagues</Link>
        <section className="card" role="alert">
          <h1>Schedule unavailable</h1>
          <p>{error ?? "The schedule could not be loaded."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <header className="site-header">
        <Link className="brand" href="/leagues">
          Ivers Acres Pick 10
        </Link>
        <Link
          href={`/leagues/${leagueId}/weeks/${week.season}/${week.weekNumber}/results`}
        >
          My results
        </Link>
        <Link href={`/leagues/${leagueId}/standings`}>Standings</Link>
      </header>
      <section className="content stack">
        <Link href="/leagues">Back to leagues</Link>
        <div>
          <p className="eyebrow">Season {week.season}</p>
          <h1>Week {week.weekNumber} picks</h1>
          <p>
            Deadline: <time dateTime={week.deadlineUtc}>{deadlineLabel}</time>
          </p>
          <p className="muted">
            Schedule status: {week.scheduleStatus}
            {week.scheduleStatus === "stale" &&
              ` (last updated ${new Date(week.scheduleFetchedAt).toLocaleString()})`}
          </p>
        </div>

        <PickCount count={picks.length} limit={10} />
        {isLocked && (
          <p className="card" role="status">
            Picks are locked for this week. Entries cannot be changed after
            kickoff.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {submitted && <p role="status">Your picks have been saved.</p>}

        <div className="stack">
          {games.map((game) => (
            <MatchupRow
              key={game.id}
              game={game}
              selectedTeamId={selectedByGame.get(game.id)}
              disabled={
                isLocked || (!selectedByGame.has(game.id) && picks.length >= 10)
              }
              onSelect={selectTeam}
            />
          ))}
        </div>
        {games.length === 0 && (
          <p className="card" role="status">
            No matchups are available for this week.
          </p>
        )}
        <button
          className="button"
          disabled={isLocked || saving || picks.length !== 10}
          onClick={() => void submit()}
          type="button"
        >
          {saving
            ? "Saving picks..."
            : submitted
              ? "Update picks"
              : "Submit picks"}
        </button>
      </section>
    </main>
  );
}
