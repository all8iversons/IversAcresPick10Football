import { describe, expect, it } from "vitest";
import {
  calculateSeasonEndPayout,
  calculateWeeklyPayout,
} from "@/domain/payouts";
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
    expect(scorePick("other", "home", "away", "tie")).toBeNull();
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

describe("payout calculations", () => {
  it("splits the full pot among perfect scores", () => {
    expect(
      calculateWeeklyPayout(100, [
        { participantId: "a", points: 10 },
        { participantId: "b", points: 10 },
        { participantId: "c", points: 9 },
      ]),
    ).toEqual({
      outcome: "jackpot",
      payouts: [
        { participantId: "a", amount: 50 },
        { participantId: "b", amount: 50 },
      ],
      rolloverAmount: 0,
    });
  });

  it("splits half the pot among 9-point scores and rolls over the rest", () => {
    expect(
      calculateWeeklyPayout(100, [
        { participantId: "a", points: 9 },
        { participantId: "b", points: 9 },
        { participantId: "c", points: 8 },
      ]),
    ).toEqual({
      outcome: "runner_up",
      payouts: [
        { participantId: "a", amount: 25 },
        { participantId: "b", amount: 25 },
      ],
      rolloverAmount: 50,
    });
  });

  it("awards the runner-up payout to the highest score of at least 9", () => {
    expect(
      calculateWeeklyPayout(100, [
        { participantId: "a", points: 9.5 },
        { participantId: "b", points: 9 },
        { participantId: "c", points: 8.5 },
      ]),
    ).toEqual({
      outcome: "runner_up",
      payouts: [{ participantId: "a", amount: 50 }],
      rolloverAmount: 50,
    });
  });

  it("rolls over the full pot when no participant scores at least 9", () => {
    expect(
      calculateWeeklyPayout(100, [
        { participantId: "a", points: 8 },
        { participantId: "b", points: 7 },
      ]),
    ).toEqual({
      outcome: "rollover",
      payouts: [],
      rolloverAmount: 100,
    });
  });

  it("splits the season-end balance among leaders", () => {
    expect(
      calculateSeasonEndPayout(90, [
        { participantId: "a", points: 100 },
        { participantId: "b", points: 100 },
        { participantId: "c", points: 99 },
      ]),
    ).toEqual({
      payouts: [
        { participantId: "a", amount: 45 },
        { participantId: "b", amount: 45 },
      ],
      remainingAmount: 0,
    });
  });

  it("rejects invalid pot amounts and weekly scores", () => {
    expect(() =>
      calculateWeeklyPayout(-1, [{ participantId: "a", points: 10 }]),
    ).toThrow(RangeError);
    expect(() =>
      calculateWeeklyPayout(100, [{ participantId: "a", points: 11 }]),
    ).toThrow(RangeError);
    expect(() =>
      calculateWeeklyPayout(100, [{ participantId: "a", points: 9.25 }]),
    ).toThrow(RangeError);
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
