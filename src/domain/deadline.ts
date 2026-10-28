import type { GameMatchup } from "@/domain/types";

export function getLocalWeekday(instant: string, timeZone: string): string {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Invalid kickoff instant: ${instant}`);
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone,
  }).format(date);
}

export function deriveWeeklyDeadline(games: readonly GameMatchup[]): string {
  if (games.length === 0) {
    throw new Error("Cannot determine a deadline for a week without games.");
  }

  const thursdayGames = games
    .filter(
      (game) =>
        getLocalWeekday(game.kickoffUtc, game.venueTimeZone) === "Thursday",
    )
    .sort(
      (left, right) =>
        Date.parse(left.kickoffUtc) - Date.parse(right.kickoffUtc),
    );
  const selectedGame =
    thursdayGames.at(-1) ??
    [...games].sort(
      (left, right) =>
        Date.parse(left.kickoffUtc) - Date.parse(right.kickoffUtc),
    )[0];

  if (!selectedGame || !Number.isFinite(Date.parse(selectedGame.kickoffUtc))) {
    throw new Error("Schedule contains no valid kickoff timestamps.");
  }

  return new Date(selectedGame.kickoffUtc).toISOString();
}

export function isDeadlineReached(deadlineUtc: string, now: number): boolean {
  const deadline = Date.parse(deadlineUtc);
  if (!Number.isFinite(deadline)) {
    throw new Error("The stored deadline is not a valid UTC timestamp.");
  }
  return now >= deadline;
}
