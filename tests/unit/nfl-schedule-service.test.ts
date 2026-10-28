import { describe, expect, it } from "vitest";
import weekFixture from "@/../tests/fixtures/espn/regular-season-week.json";
import tieFixture from "@/../tests/fixtures/espn/regular-season-tie.json";
import { normalizeScoreboard } from "@/services/nfl/espn/normalize";

describe("ESPN schedule normalization", () => {
  it("validates the requested week and normalizes UTC matchups and deadline", () => {
    const schedule = normalizeScoreboard(weekFixture, 2024, 1, "week-id");
    expect(schedule.games).toHaveLength(2);
    expect(schedule.deadlineUtc).toBe("2024-09-06T00:20:00.000Z");
    expect(schedule.games[0]).toMatchObject({
      sourceEventId: "401671800",
      kickoffUtc: "2024-09-06T00:20:00.000Z",
      venueTimeZone: "America/Chicago",
      isThursdayNightGame: true,
      status: "final",
      finalResult: "home_win",
    });
  });

  it("detects a final tie from equal valid scores, not winner flags", () => {
    const schedule = normalizeScoreboard(tieFixture, 2022, 1, "week-id");
    expect(schedule.games[0]).toMatchObject({
      status: "final",
      homeScore: 20,
      awayScore: 20,
      finalResult: "tie",
    });
  });

  it("normalizes the ESPN WSH abbreviation to Washington's stadium time zone", () => {
    const wshFixture = structuredClone(weekFixture);
    wshFixture.events[0].competitions[0].competitors[0].team.abbreviation =
      "WSH";

    const schedule = normalizeScoreboard(wshFixture, 2024, 1, "week-id");

    expect(schedule.games[0]?.venueTimeZone).toBe("America/New_York");
  });

  it("rejects a response for the wrong season or week", () => {
    expect(() => normalizeScoreboard(weekFixture, 2023, 1, "week-id")).toThrow(
      "ESPN scoreboard response does not match the requested regular-season week.",
    );
    expect(() => normalizeScoreboard(weekFixture, 2024, 2, "week-id")).toThrow(
      "ESPN scoreboard response does not match the requested regular-season week.",
    );
  });

  it("rejects missing or malformed scoreboard data", () => {
    expect(() => normalizeScoreboard({}, 2024, 1, "week-id")).toThrow(
      "ESPN scoreboard response is missing season or week metadata.",
    );
  });
});
