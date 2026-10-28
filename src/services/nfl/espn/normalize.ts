import type { FinalResult, GameMatchup, GameStatus } from "@/domain/types";
import { deriveWeeklyDeadline } from "@/domain/deadline";

export interface NormalizedSchedule {
  season: number;
  seasonType: 2;
  weekNumber: number;
  deadlineUtc: string;
  games: GameMatchup[];
}

const TEAM_TIME_ZONES: Readonly<Record<string, string>> = {
  ARI: "America/Phoenix",
  ATL: "America/New_York",
  BAL: "America/New_York",
  BUF: "America/New_York",
  CAR: "America/New_York",
  CHI: "America/Chicago",
  CIN: "America/New_York",
  CLE: "America/New_York",
  DAL: "America/Chicago",
  DEN: "America/Denver",
  DET: "America/New_York",
  GB: "America/Chicago",
  HOU: "America/Chicago",
  IND: "America/New_York",
  JAX: "America/New_York",
  KC: "America/Chicago",
  LAC: "America/Los_Angeles",
  LAR: "America/Los_Angeles",
  LV: "America/Los_Angeles",
  MIA: "America/New_York",
  MIN: "America/Chicago",
  NE: "America/New_York",
  NO: "America/Chicago",
  NYG: "America/New_York",
  NYJ: "America/New_York",
  PHI: "America/New_York",
  PIT: "America/New_York",
  SEA: "America/Los_Angeles",
  SF: "America/Los_Angeles",
  TB: "America/New_York",
  TEN: "America/Chicago",
  WAS: "America/New_York",
  WSH: "America/New_York",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseScore(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getTeamTimeZone(abbreviation: string): string {
  const timeZone = TEAM_TIME_ZONES[abbreviation];
  if (!timeZone) {
    throw new Error(
      `No stadium time zone is configured for team ${abbreviation}.`,
    );
  }
  return timeZone;
}

function getVenueTimeZone(
  competition: Record<string, unknown>,
  homeTeamAbbreviation: string,
): string {
  const venue = isRecord(competition.venue) ? competition.venue : null;
  const address = venue && isRecord(venue.address) ? venue.address : null;
  const city = address && readString(address.city);
  const internationalVenueTimeZones: Readonly<Record<string, string>> = {
    "Frankfurt am Main": "Europe/Berlin",
    Frankfurt: "Europe/Berlin",
    London: "Europe/London",
    "Mexico City": "America/Mexico_City",
    Munich: "Europe/Berlin",
    "Sao Paulo": "America/Sao_Paulo",
    "São Paulo": "America/Sao_Paulo",
  };

  if (city && internationalVenueTimeZones[city]) {
    return internationalVenueTimeZones[city];
  }
  return getTeamTimeZone(homeTeamAbbreviation);
}

function parseStatus(value: unknown): GameStatus {
  if (!isRecord(value) || !isRecord(value.type)) return "unknown";
  const type = value.type;
  const state = readString(type.state);
  const name = readString(type.name);
  if (type.completed === true || name === "STATUS_FINAL") return "final";
  if (state === "in") return "in_progress";
  if (state === "pre") return "scheduled";
  if (name?.includes("POSTPONED")) return "postponed";
  if (name?.includes("CANCEL")) return "cancelled";
  return "unknown";
}

function parseFinalResult(
  status: GameStatus,
  homeScore: number | null,
  awayScore: number | null,
): FinalResult {
  if (status !== "final" || homeScore === null || awayScore === null) {
    return "undetermined";
  }
  if (homeScore === awayScore) return "tie";
  return homeScore > awayScore ? "home_win" : "away_win";
}

function parseEvent(value: unknown, weekId: string): GameMatchup {
  if (!isRecord(value)) throw new Error("ESPN event is malformed.");
  const sourceEventId = readString(value.id);
  const kickoffUtc = readString(value.date);
  const competitions = asArray(value.competitions);
  const competition = competitions[0];
  if (
    !sourceEventId ||
    !kickoffUtc ||
    !Number.isFinite(Date.parse(kickoffUtc))
  ) {
    throw new Error("ESPN event is missing its ID or UTC kickoff timestamp.");
  }
  if (!isRecord(competition))
    throw new Error(`ESPN event ${sourceEventId} has no competition.`);

  const competitors = asArray(competition.competitors);
  const home = competitors.find(
    (competitor) => isRecord(competitor) && competitor.homeAway === "home",
  );
  const away = competitors.find(
    (competitor) => isRecord(competitor) && competitor.homeAway === "away",
  );
  if (!isRecord(home) || !isRecord(away)) {
    throw new Error(
      `ESPN event ${sourceEventId} does not have a home and away team.`,
    );
  }
  const homeTeam = isRecord(home.team) ? home.team : null;
  const awayTeam = isRecord(away.team) ? away.team : null;
  const homeId = homeTeam && readString(homeTeam.id);
  const awayId = awayTeam && readString(awayTeam.id);
  const homeName =
    homeTeam && (readString(homeTeam.displayName) ?? readString(homeTeam.name));
  const awayName =
    awayTeam && (readString(awayTeam.displayName) ?? readString(awayTeam.name));
  const homeAbbreviation = homeTeam && readString(homeTeam.abbreviation);
  if (
    !homeId ||
    !awayId ||
    !homeName ||
    !awayName ||
    !homeAbbreviation ||
    homeId === awayId
  ) {
    throw new Error(`ESPN event ${sourceEventId} has invalid team data.`);
  }

  const status = parseStatus(competition.status);
  const homeScore = parseScore(home.score);
  const awayScore = parseScore(away.score);

  return {
    id: sourceEventId,
    sourceEventId,
    weekId,
    homeTeam: { id: homeId, name: homeName },
    awayTeam: { id: awayId, name: awayName },
    kickoffUtc: new Date(kickoffUtc).toISOString(),
    venueTimeZone: getVenueTimeZone(competition, homeAbbreviation),
    isThursdayNightGame: false,
    status,
    homeScore,
    awayScore,
    finalResult: parseFinalResult(status, homeScore, awayScore),
  };
}

export function normalizeScoreboard(
  payload: unknown,
  expectedSeason: number,
  expectedWeek: number,
  weekId: string,
): NormalizedSchedule {
  if (
    !isRecord(payload) ||
    !isRecord(payload.season) ||
    !isRecord(payload.week)
  ) {
    throw new Error(
      "ESPN scoreboard response is missing season or week metadata.",
    );
  }
  if (
    payload.season.year !== expectedSeason ||
    payload.season.type !== 2 ||
    payload.week.number !== expectedWeek
  ) {
    throw new Error(
      "ESPN scoreboard response does not match the requested regular-season week.",
    );
  }

  const events = asArray(payload.events);
  if (events.length === 0) {
    throw new Error(
      "ESPN scoreboard response contains no games for the requested week.",
    );
  }
  const games = events.map((event) => parseEvent(event, weekId));
  const thursdayGames = games
    .filter((game) => {
      const weekday = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        timeZone: game.venueTimeZone,
      }).format(new Date(game.kickoffUtc));
      return weekday === "Thursday";
    })
    .sort(
      (left, right) =>
        Date.parse(left.kickoffUtc) - Date.parse(right.kickoffUtc),
    );

  if (thursdayGames.length > 0) {
    const latestThursdayGame = thursdayGames.at(-1);
    if (latestThursdayGame) latestThursdayGame.isThursdayNightGame = true;
  }

  return {
    season: expectedSeason,
    seasonType: 2,
    weekNumber: expectedWeek,
    deadlineUtc: deriveWeeklyDeadline(games),
    games,
  };
}
