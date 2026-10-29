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
    otherEntries,
    submissionStatuses,
    otherEntriesLoaded,
    loading,
    saving,
    submitted,
    error,
    now,
    selectedByGame,
    refreshingStatuses,
    selectTeam,
    refreshStatuses,
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

        <nav className="card stack" aria-labelledby="previous-weeks-heading">
          <h2 id="previous-weeks-heading">Previous weeks</h2>
          {week.weekNumber === 1 ? (
            <p className="muted">No previous weeks are available this season.</p>
          ) : (
            <div className="week-links">
              {Array.from({ length: week.weekNumber - 1 }, (_, index) => {
                const previousWeek = week.weekNumber - index - 1;
                return (
                  <Link
                    className="button"
                    href={`/leagues/${leagueId}/weeks/${week.season}/${previousWeek}`}
                    key={previousWeek}
                  >
                    Week {previousWeek}
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        <PickCount count={picks.length} limit={10} />
        <section
          className="card stack"
          aria-labelledby="submission-status-heading"
        >
          <h2 id="submission-status-heading">League submission status</h2>
          <p className="muted">
            {isLocked
              ? "Pick details are now available."
              : "Pick details stay hidden until the deadline."}
          </p>
          <button
            className="button"
            disabled={refreshingStatuses}
            onClick={() => void refreshStatuses()}
            type="button"
          >
            {refreshingStatuses ? "Refreshing..." : "Refresh status"}
          </button>
          {submissionStatuses.map((status) => (
            <p key={status.participantId}>
              {status.isCurrentUser ? "You" : status.participantName}:{" "}
              {status.hasSubmitted ? "Submitted" : "Not submitted"}
            </p>
          ))}
        </section>
        {isLocked && (
          <p className="card" role="status">
            Picks are locked for this week. Entries cannot be changed after
            kickoff.
          </p>
        )}
        {isLocked && (
          <section className="stack" aria-labelledby="league-picks-heading">
            <h2 id="league-picks-heading">League picks</h2>
            {!otherEntriesLoaded ? (
              <p className="muted" role="status">
                Loading league picks...
              </p>
            ) : otherEntries.length === 0 ? (
              <p className="muted">No other league picks were submitted.</p>
            ) : (
              otherEntries.map((entry) => (
                <article className="card stack" key={entry.participantId}>
                  <h3>{entry.participantName}</h3>
                  <ul>
                    {entry.picks.map((pick) => {
                      const game = games.find(
                        (scheduledGame) => scheduledGame.id === pick.gameId,
                      );
                      const selectedTeam =
                        game?.homeTeam.id === pick.selectedTeamId
                          ? game.homeTeam.name
                          : game?.awayTeam.id === pick.selectedTeamId
                            ? game.awayTeam.name
                            : "Unknown team";
                      return <li key={pick.gameId}>{selectedTeam}</li>;
                    })}
                  </ul>
                </article>
              ))
            )}
          </section>
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
