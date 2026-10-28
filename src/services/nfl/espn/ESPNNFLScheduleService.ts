import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { normalizeScoreboard } from "@/services/nfl/espn/normalize";
import type {
  NFLScheduleService,
  ScheduleSnapshot,
} from "@/services/nfl/NFLScheduleService";

const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const CACHE_TTL_MS = 1_000;

interface WeekRow {
  id: string;
  season: number;
  season_type: number;
  week_number: number;
  deadline_utc: string;
  schedule_fetched_at: string;
  schedule_status: "available" | "stale" | "unavailable";
}

interface GameRow {
  id: string;
  source_event_id: string;
  week_id: string;
  home_team_id: string;
  home_team_name: string;
  away_team_id: string;
  away_team_name: string;
  kickoff_utc: string;
  venue_time_zone: string;
  is_thursday_night_game: boolean;
  status:
    | "scheduled"
    | "in_progress"
    | "final"
    | "postponed"
    | "cancelled"
    | "unknown";
  home_score: number | null;
  away_score: number | null;
  final_result: "home_win" | "away_win" | "tie" | "undetermined";
}

function isFresh(week: WeekRow): boolean {
  return (
    week.schedule_status === "available" &&
    Date.now() - Date.parse(week.schedule_fetched_at) < CACHE_TTL_MS
  );
}

function toSnapshot(week: WeekRow, games: GameRow[]): ScheduleSnapshot {
  return {
    week: {
      id: week.id,
      season: week.season,
      seasonType: 2,
      weekNumber: week.week_number,
      deadlineUtc: new Date(week.deadline_utc).toISOString(),
      scheduleFetchedAt: new Date(week.schedule_fetched_at).toISOString(),
      scheduleStatus: week.schedule_status,
    },
    games: games.map((game) => ({
      id: game.id,
      sourceEventId: game.source_event_id,
      weekId: game.week_id,
      homeTeam: { id: game.home_team_id, name: game.home_team_name },
      awayTeam: { id: game.away_team_id, name: game.away_team_name },
      kickoffUtc: new Date(game.kickoff_utc).toISOString(),
      venueTimeZone: game.venue_time_zone,
      isThursdayNightGame: game.is_thursday_night_game,
      status: game.status,
      homeScore: game.home_score,
      awayScore: game.away_score,
      finalResult: game.final_result,
    })),
  };
}

export class ScheduleUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ScheduleUnavailableError";
  }
}

export class ESPNNFLScheduleService implements NFLScheduleService {
  async getCurrentRegularSeasonWeek(): Promise<ScheduleSnapshot> {
    const url = new URL(ESPN_SCOREBOARD_URL);
    let response: Response;
    try {
      response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
    } catch (error) {
      throw new ScheduleUnavailableError(
        "The NFL schedule provider could not be reached.",
        {
          cause: error,
        },
      );
    }
    if (!response.ok) {
      throw new ScheduleUnavailableError(
        `ESPN returned HTTP ${response.status}.`,
      );
    }

    const payload: unknown = await response.json();
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("season" in payload) ||
      typeof payload.season !== "object" ||
      payload.season === null ||
      !("week" in payload) ||
      typeof payload.week !== "object" ||
      payload.week === null ||
      !("year" in payload.season) ||
      !("type" in payload.season) ||
      !("number" in payload.week) ||
      typeof payload.season.year !== "number" ||
      payload.season.type !== 2 ||
      typeof payload.week.number !== "number"
    ) {
      throw new ScheduleUnavailableError(
        "ESPN did not provide an active regular-season week.",
      );
    }

    return this.getRegularSeasonWeek(payload.season.year, payload.week.number);
  }

  async getRegularSeasonWeek(
    season: number,
    weekNumber: number,
  ): Promise<ScheduleSnapshot> {
    if (!Number.isInteger(season) || season < 2000 || season > 2200) {
      throw new Error("Season must be a valid four-digit NFL season year.");
    }
    if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 18) {
      throw new Error("Regular-season week must be between 1 and 18.");
    }

    const database = createSupabaseAdminClient();
    const existingResult = await database
      .from("nfl_weeks")
      .select("*")
      .eq("season", season)
      .eq("season_type", 2)
      .eq("week_number", weekNumber)
      .maybeSingle();
    if (existingResult.error) {
      throw new ScheduleUnavailableError(
        "Cached NFL schedule could not be read.",
        {
          cause: existingResult.error,
        },
      );
    }
    const existingWeek = existingResult.data as WeekRow | null;

    if (existingWeek && isFresh(existingWeek)) {
      const cached = await this.loadGames(database, existingWeek);
      if (cached.length > 0) return toSnapshot(existingWeek, cached);
    }

    try {
      return await this.refreshWeek(database, season, weekNumber, existingWeek);
    } catch (error) {
      if (existingWeek) {
        const staleWeek: WeekRow = {
          ...existingWeek,
          schedule_status: "stale",
        };
        const { error: updateError } = await database
          .from("nfl_weeks")
          .update({ schedule_status: "stale" })
          .eq("id", existingWeek.id);
        if (updateError) {
          throw new ScheduleUnavailableError(
            "The schedule source failed and the cached schedule could not be marked stale.",
            { cause: updateError },
          );
        }
        const cached = await this.loadGames(database, existingWeek);
        if (cached.length > 0) return toSnapshot(staleWeek, cached);
      }

      if (error instanceof ScheduleUnavailableError) throw error;
      throw new ScheduleUnavailableError(
        "The NFL schedule is currently unavailable.",
        {
          cause: error,
        },
      );
    }
  }

  private async refreshWeek(
    database: ReturnType<typeof createSupabaseAdminClient>,
    season: number,
    weekNumber: number,
    existingWeek: WeekRow | null,
  ): Promise<ScheduleSnapshot> {
    const url = new URL(ESPN_SCOREBOARD_URL);
    url.searchParams.set("dates", String(season));
    url.searchParams.set("seasontype", "2");
    url.searchParams.set("week", String(weekNumber));
    url.searchParams.set("limit", "1000");

    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      throw new ScheduleUnavailableError(
        `ESPN returned HTTP ${response.status}.`,
      );
    }
    const payload: unknown = await response.json();
    const weekId = existingWeek?.id ?? crypto.randomUUID();
    const normalized = normalizeScoreboard(payload, season, weekNumber, weekId);
    const fetchedAt = new Date().toISOString();
    const weekUpsert = await database
      .from("nfl_weeks")
      .upsert(
        {
          id: weekId,
          season,
          season_type: 2,
          week_number: weekNumber,
          deadline_utc: normalized.deadlineUtc,
          schedule_fetched_at: fetchedAt,
          schedule_status: "available",
        },
        { onConflict: "season,season_type,week_number" },
      )
      .select("*")
      .single();
    if (weekUpsert.error) {
      throw new ScheduleUnavailableError(
        "The normalized NFL week could not be cached.",
        {
          cause: weekUpsert.error,
        },
      );
    }
    const savedWeek = weekUpsert.data as WeekRow;

    const gameRows = normalized.games.map((game) => ({
      source_event_id: game.sourceEventId,
      week_id: savedWeek.id,
      home_team_id: game.homeTeam.id,
      home_team_name: game.homeTeam.name,
      away_team_id: game.awayTeam.id,
      away_team_name: game.awayTeam.name,
      kickoff_utc: game.kickoffUtc,
      venue_time_zone: game.venueTimeZone,
      is_thursday_night_game: game.isThursdayNightGame,
      status: game.status,
      home_score: game.homeScore,
      away_score: game.awayScore,
      final_result: game.finalResult,
      updated_at: fetchedAt,
    }));
    const gamesUpsert = await database
      .from("nfl_games")
      .upsert(gameRows, { onConflict: "source_event_id" });
    if (gamesUpsert.error) {
      throw new ScheduleUnavailableError(
        "Normalized NFL games could not be cached.",
        {
          cause: gamesUpsert.error,
        },
      );
    }

    const games = await this.loadGames(database, savedWeek);
    if (games.length === 0) {
      throw new ScheduleUnavailableError("The cached NFL week has no games.");
    }
    return toSnapshot(savedWeek, games);
  }

  private async loadGames(
    database: ReturnType<typeof createSupabaseAdminClient>,
    week: WeekRow,
  ): Promise<GameRow[]> {
    const result = await database
      .from("nfl_games")
      .select("*")
      .eq("week_id", week.id)
      .order("kickoff_utc");
    if (result.error) {
      throw new ScheduleUnavailableError(
        "Cached NFL games could not be read.",
        {
          cause: result.error,
        },
      );
    }
    return result.data as GameRow[];
  }
}
