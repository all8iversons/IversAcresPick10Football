import { describe, expect, it } from "vitest";
import { scorePick, scorePicks } from "@/domain/scoring";
import { rankStandings } from "@/domain/standings";

describe("pick scoring", () => {
  it("scores a correct pick as one point and an incorrect pick as zero", () => {
    expect(scorePick("home", "home", "away", "home_win")).toBe(1);
    expect(scorePick("away", "home", "away", "home_win")).toBe(0);
    expect(scorePick("away", "home", "away", "away_win")).toBe(1);
    expect(scorePick("home", "home", "away", "away_win")).toBe(0);
  });

  it("awards half a point for either selected team in a final tie", () => {
    expect(scorePick("home", "home", "away", "tie")).toBe(0.5);
    expect(scorePick("away", "home", "away", "tie")).toBe(0.5);
  });

  it("leaves non-final games unscored", () => {
    expect(scorePick("home", "home", "away", "undetermined")).toBeNull();
    const scored = scorePicks(
      [{ gameId: "game", selectedTeamId: "home", pointsAwarded: null }],
      new Map([
        [
          "game",
          {
            homeTeamId: "home",
            awayTeamId: "away",
            finalResult: "home_win",
            status: "in_progress",
          },
        ],
      ]),
    );
    expect(scored[0]?.pointsAwarded).toBeNull();
  });
});

describe("standard competition ranking", () => {
  it("assigns ranks 1, 1, 3 to tied scores", () => {
    expect(
      rankStandings([
        { participantId: "a", displayName: "A", points: 10 },
        { participantId: "b", displayName: "B", points: 10 },
        { participantId: "c", displayName: "C", points: 8 },
      ]).map(({ rank }) => rank),
    ).toEqual([1, 1, 3]);
  });
});
