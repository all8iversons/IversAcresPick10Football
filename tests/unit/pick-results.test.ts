import { describe, expect, it } from "vitest";
import { getPickOutcome, summarizePickOutcomes } from "@/domain/pick-results";

const game = {
  status: "final",
  finalResult: "home_win",
  homeTeam: { id: "home", name: "Home" },
  awayTeam: { id: "away", name: "Away" },
} as Parameters<typeof getPickOutcome>[0];

describe("pick results", () => {
  it("classifies finished picks", () => {
    expect(getPickOutcome(game, "home")).toBe("win");
    expect(getPickOutcome(game, "away")).toBe("loss");
  });

  it("treats unfinished games as pending", () => {
    expect(
      getPickOutcome({ ...game!, status: "scheduled" }, "home"),
    ).toBe("pending");
    expect(getPickOutcome(undefined, "home")).toBe("pending");
  });

  it("summarizes correct over finished", () => {
    expect(summarizePickOutcomes(["win", "loss", "tie", "pending"])).toEqual({
      correct: 1,
      finished: 3,
    });
  });
});
