import { describe, expect, it } from "vitest";
import { deriveWeeklyDeadline, isDeadlineReached } from "@/domain/deadline";
import type { GameMatchup } from "@/domain/types";

function game(id: string, kickoffUtc: string): GameMatchup {
  return {
    id,
    sourceEventId: id,
    weekId: "week",
    homeTeam: { id: `${id}-home`, name: "Home" },
    awayTeam: { id: `${id}-away`, name: "Away" },
    kickoffUtc,
    venueTimeZone: "America/New_York",
    isThursdayNightGame: false,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    finalResult: "undetermined",
  };
}

describe("weekly deadline", () => {
  it("uses the only Thursday-local game even when its UTC date is Friday", () => {
    const deadline = deriveWeeklyDeadline([
      game("thursday", "2024-09-06T00:20:00Z"),
      game("sunday", "2024-09-08T17:00:00Z"),
    ]);
    expect(deadline).toBe("2024-09-06T00:20:00.000Z");
  });

  it("uses the latest kickoff among multiple Thursday-local games", () => {
    const deadline = deriveWeeklyDeadline([
      game("early", "2024-11-28T17:00:00Z"),
      game("late", "2024-11-29T01:20:00Z"),
      game("sunday", "2024-12-01T17:00:00Z"),
    ]);
    expect(deadline).toBe("2024-11-29T01:20:00.000Z");
  });

  it("falls back to the earliest kickoff when there is no Thursday game", () => {
    const deadline = deriveWeeklyDeadline([
      game("saturday", "2024-12-22T01:00:00Z"),
      game("sunday", "2024-12-22T17:00:00Z"),
    ]);
    expect(deadline).toBe("2024-12-22T01:00:00.000Z");
  });

  it("locks at kickoff, not one second before", () => {
    const deadline = "2024-09-06T00:20:00.000Z";
    const instant = Date.parse(deadline);
    expect(isDeadlineReached(deadline, instant - 1000)).toBe(false);
    expect(isDeadlineReached(deadline, instant)).toBe(true);
    expect(isDeadlineReached(deadline, instant + 1000)).toBe(true);
  });

  it("rejects an invalid deadline", () => {
    expect(() => isDeadlineReached("not-a-date", Date.now())).toThrow(
      "The stored deadline is not a valid UTC timestamp.",
    );
  });
});
