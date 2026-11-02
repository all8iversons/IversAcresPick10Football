import { describe, expect, it } from "vitest";
import { selectDefaultPicks } from "@/domain/default-picks";

const games = Array.from({ length: 12 }, (_, index) => ({
  id: `game-${String(index).padStart(2, "0")}`,
  homeTeamId: `home-${index}`,
  kickoffUtc: new Date(Date.UTC(2026, 8, 10, 12 + index)).toISOString(),
}));

describe("default picks", () => {
  it("picks the home teams of the first ten games by kickoff", () => {
    const picks = selectDefaultPicks([...games].reverse());
    expect(picks).toHaveLength(10);
    expect(picks.map((pick) => pick.selectedTeamId)).toEqual(
      games.slice(0, 10).map((game) => game.homeTeamId),
    );
  });

  it("breaks kickoff ties by game id", () => {
    const sameTime = games.map((game) => ({
      ...game,
      kickoffUtc: games[0]!.kickoffUtc,
    }));
    expect(selectDefaultPicks([...sameTime].reverse())[0]?.gameId).toBe(
      "game-00",
    );
  });

  it("returns nothing when fewer than ten games exist", () => {
    expect(selectDefaultPicks(games.slice(0, 9))).toEqual([]);
  });
});
