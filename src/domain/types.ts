export type GameStatus =
  "scheduled" | "in_progress" | "final" | "postponed" | "cancelled" | "unknown";

export type FinalResult = "home_win" | "away_win" | "tie" | "undetermined";

export interface Team {
  id: string;
  name: string;
}

export interface GameMatchup {
  id: string;
  sourceEventId: string;
  weekId: string;
  homeTeam: Team;
  awayTeam: Team;
  kickoffUtc: string;
  venueTimeZone: string;
  isThursdayNightGame: boolean;
  status: GameStatus;
  homeScore: number | null;
  awayScore: number | null;
  finalResult: FinalResult;
}

export interface UserPick {
  gameId: string;
  selectedTeamId: string;
  pointsAwarded: number | null;
}

export interface WeeklyEntry {
  id: string;
  leagueId: string;
  participantId: string;
  weekId: string;
  submittedAt: string;
  updatedAt: string;
  picks: UserPick[];
}

export interface League {
  id: string;
  name: string;
  role: "owner" | "member";
  createdAt: string;
}

export interface LeaderboardStanding {
  leagueId: string;
  participantId: string;
  displayName: string;
  period: "week" | "season";
  points: number;
  rank: number;
}

export interface NflWeek {
  id: string;
  season: number;
  seasonType: 2;
  weekNumber: number;
  deadlineUtc: string;
  scheduleFetchedAt: string;
  scheduleStatus: "available" | "stale" | "unavailable";
}
