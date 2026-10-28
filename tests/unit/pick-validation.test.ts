import { describe, expect, it } from "vitest";
import { validateWeeklyPicks } from "@/domain/validate-picks";
import type { GameMatchup } from "@/domain/types";

function gamesFor(count: number): GameMatchup[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `game-${index}`,
    sourceEventId: `event-${index}`,
    weekId: "week-1",
    homeTeam: { id: `home-${index}`, name: `Home ${index}` },
    awayTeam: { id: `away-${index}`, name: `Away ${index}` },
    kickoffUtc: `2026-09-${String(index + 1).padStart(2, "0")}T17:00:00Z`,
    venueTimeZone: "America/New_York",
    isThursdayNightGame: false,
    status: "scheduled" as const,
    homeScore: null,
    awayScore: null,
    finalResult: "undetermined" as const,
  }));
}

function validPicks(games: GameMatchup[]) {
  return games.slice(0, 10).map((game) => ({
    gameId: game.id,
    selectedTeamId: game.homeTeam.id,
  }));
}

describe("weekly pick validation", () => {
  it("accepts exactly ten distinct teams from ten games", () => {
    const games = gamesFor(10);
    expect(validateWeeklyPicks(validPicks(games), games)).toEqual({
      valid: true,
    });
  });

  it.each([9, 11])("rejects %i picks", (count) => {
    const games = gamesFor(11);
    const picks = games.slice(0, count).map((game) => ({
      gameId: game.id,
      selectedTeamId: game.homeTeam.id,
    }));
    expect(validateWeeklyPicks(picks, games)).toMatchObject({
      valid: false,
      code: "PICK_COUNT",
    });
  });

  it("rejects both sides of one game", () => {
    const games = gamesFor(10);
    const picks = validPicks(games);
    picks[1] = { gameId: games[0].id, selectedTeamId: games[0].awayTeam.id };
    expect(validateWeeklyPicks(picks, games)).toMatchObject({
      valid: false,
      code: "DUPLICATE_GAME",
    });
  });

  it("rejects a team that is not playing in the selected game", () => {
    const games = gamesFor(10);
    const picks = validPicks(games);
    picks[0] = { gameId: games[0].id, selectedTeamId: "unrelated-team" };
    expect(validateWeeklyPicks(picks, games)).toMatchObject({
      valid: false,
      code: "INVALID_TEAM",
    });
  });

  it("rejects a game not in the active week's schedule", () => {
    const games = gamesFor(10);
    const picks = validPicks(games);
    picks[0] = { gameId: "different-week-game", selectedTeamId: "home-0" };
    expect(validateWeeklyPicks(picks, games)).toMatchObject({
      valid: false,
      code: "UNKNOWN_GAME",
    });
  });
});
