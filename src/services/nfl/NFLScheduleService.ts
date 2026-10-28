import type { GameMatchup, NflWeek } from "@/domain/types";

export interface ScheduleSnapshot {
  week: NflWeek;
  games: GameMatchup[];
}

export interface NFLScheduleService {
  getCurrentRegularSeasonWeek(): Promise<ScheduleSnapshot>;
  getRegularSeasonWeek(
    season: number,
    weekNumber: number,
  ): Promise<ScheduleSnapshot>;
}
