export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationship[];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        { id: string; email: string; display_name: string; created_at: string },
        {
          id: string;
          email: string;
          display_name?: string;
          created_at?: string;
        },
        { email?: string; display_name?: string }
      >;
      leagues: Table<
        {
          id: string;
          name: string;
          invite_code_hash: string;
          created_by: string;
          created_at: string;
        },
        { name: string; invite_code_hash: string; created_by: string },
        { name?: string; invite_code_hash?: string }
      >;
      league_memberships: Table<
        {
          league_id: string;
          participant_id: string;
          role: "owner" | "member";
          joined_at: string;
        },
        {
          league_id: string;
          participant_id: string;
          role?: "owner" | "member";
          joined_at?: string;
        },
        { role?: "owner" | "member" }
      >;
      nfl_weeks: Table<
        {
          id: string;
          season: number;
          season_type: number;
          week_number: number;
          deadline_utc: string;
          schedule_fetched_at: string;
          schedule_status: "available" | "stale" | "unavailable";
        },
        {
          id?: string;
          season: number;
          season_type: number;
          week_number: number;
          deadline_utc: string;
          schedule_fetched_at: string;
          schedule_status: "available" | "stale" | "unavailable";
        },
        {
          deadline_utc?: string;
          schedule_fetched_at?: string;
          schedule_status?: "available" | "stale" | "unavailable";
        }
      >;
      nfl_games: Table<
        {
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
          updated_at: string;
        },
        {
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
          home_score?: number | null;
          away_score?: number | null;
          final_result?: "home_win" | "away_win" | "tie" | "undetermined";
          updated_at?: string;
        },
        {
          week_id?: string;
          home_team_id?: string;
          home_team_name?: string;
          away_team_id?: string;
          away_team_name?: string;
          kickoff_utc?: string;
          venue_time_zone?: string;
          is_thursday_night_game?: boolean;
          status?:
            | "scheduled"
            | "in_progress"
            | "final"
            | "postponed"
            | "cancelled"
            | "unknown";
          home_score?: number | null;
          away_score?: number | null;
          final_result?: "home_win" | "away_win" | "tie" | "undetermined";
          updated_at?: string;
        }
      >;
      weekly_entries: Table<
        {
          id: string;
          league_id: string;
          participant_id: string;
          week_id: string;
          submitted_at: string;
          updated_at: string;
        },
        {
          league_id: string;
          participant_id: string;
          week_id: string;
          submitted_at?: string;
          updated_at?: string;
        },
        { submitted_at?: string; updated_at?: string }
      >;
      team_picks: Table<
        {
          entry_id: string;
          game_id: string;
          selected_team_id: string;
          points_awarded: number | null;
        },
        {
          entry_id: string;
          game_id: string;
          selected_team_id: string;
          points_awarded?: number | null;
        },
        { selected_team_id?: string; points_awarded?: number | null }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      create_league: {
        Args: { p_name: string; p_invite_code_hash: string };
        Returns: Array<{
          id: string;
          name: string;
          role: "owner" | "member";
          created_at: string;
        }>;
      };
      join_league: {
        Args: { p_invite_code_hash: string };
        Returns: Array<{
          id: string;
          name: string;
          role: "owner" | "member";
          created_at: string;
        }>;
      };
      submit_weekly_entry: {
        Args: { p_league_id: string; p_week_id: string; p_picks: Json };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
