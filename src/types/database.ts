export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      battle_players: {
        Row: {
          attacks_blocked: number
          cooldown_until: string | null
          energy: number
          energy_generated: number
          energy_stored: number
          freeze_immunity_until: string | null
          genuine_mistakes: number
          input_recovery_until: string | null
          match_id: string
          mistake_pressure: number
          pressure_energy_received: number
          pressure_rewards: number
          skills_cast: number
          user_id: string
          version: number
        }
        Insert: {
          attacks_blocked?: number
          cooldown_until?: string | null
          energy?: number
          energy_generated?: number
          energy_stored?: number
          freeze_immunity_until?: string | null
          genuine_mistakes?: number
          input_recovery_until?: string | null
          match_id: string
          mistake_pressure?: number
          pressure_energy_received?: number
          pressure_rewards?: number
          skills_cast?: number
          user_id: string
          version?: number
        }
        Update: {
          attacks_blocked?: number
          cooldown_until?: string | null
          energy?: number
          energy_generated?: number
          energy_stored?: number
          freeze_immunity_until?: string | null
          genuine_mistakes?: number
          input_recovery_until?: string | null
          match_id?: string
          mistake_pressure?: number
          pressure_energy_received?: number
          pressure_rewards?: number
          skills_cast?: number
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "battle_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "game_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_series: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          outcome: string | null
          room_id: string
          rules: Json
          status: string
          winner_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          outcome?: string | null
          room_id: string
          rules: Json
          status?: string
          winner_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          outcome?: string | null
          room_id?: string
          rules?: Json
          status?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "battle_series_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_series_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_series_players: {
        Row: {
          rounds_won: number
          series_id: string
          user_id: string
        }
        Insert: {
          rounds_won?: number
          series_id: string
          user_id: string
        }
        Update: {
          rounds_won?: number
          series_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_series_players_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "battle_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_series_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_matches: {
        Row: {
          battle_rules: Json | null
          clues: number[]
          completed_at: string | null
          difficulty: string
          ends_at: string
          id: string
          mode: string
          outcome: string | null
          previous_match_id: string | null
          room_id: string
          round_number: number
          series_id: string | null
          started_at: string
          status: string
          winner_id: string | null
        }
        Insert: {
          battle_rules?: Json | null
          clues: number[]
          completed_at?: string | null
          difficulty: string
          ends_at: string
          id?: string
          mode?: string
          outcome?: string | null
          previous_match_id?: string | null
          room_id: string
          round_number?: number
          series_id?: string | null
          started_at: string
          status?: string
          winner_id?: string | null
        }
        Update: {
          battle_rules?: Json | null
          clues?: number[]
          completed_at?: string | null
          difficulty?: string
          ends_at?: string
          id?: string
          mode?: string
          outcome?: string | null
          previous_match_id?: string | null
          room_id?: string
          round_number?: number
          series_id?: string | null
          started_at?: string
          status?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_matches_previous_match_id_fkey"
            columns: ["previous_match_id"]
            isOneToOne: true
            referencedRelation: "game_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_matches_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_matches_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "battle_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rooms: {
        Row: {
          code: string
          created_at: string
          current_match_id: string | null
          difficulty: string
          expires_at: string
          host_id: string
          id: string
          mode: string
          status: string
          time_limit: number
        }
        Insert: {
          code: string
          created_at?: string
          current_match_id?: string | null
          difficulty?: string
          expires_at?: string
          host_id: string
          id?: string
          mode?: string
          status?: string
          time_limit?: number
        }
        Update: {
          code?: string
          created_at?: string
          current_match_id?: string | null
          difficulty?: string
          expires_at?: string
          host_id?: string
          id?: string
          mode?: string
          status?: string
          time_limit?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_rooms_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_current_match"
            columns: ["current_match_id"]
            isOneToOne: false
            referencedRelation: "game_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          created_at: string
          kind: string
          match_id: string | null
          payload: Json
          room_id: string
          sequence: number
        }
        Insert: {
          created_at?: string
          kind: string
          match_id?: string | null
          payload?: Json
          room_id: string
          sequence?: never
        }
        Update: {
          created_at?: string
          kind?: string
          match_id?: string | null
          payload?: Json
          room_id?: string
          sequence?: never
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "game_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      match_players: {
        Row: {
          completed_at: string | null
          correct_cells: number
          match_id: string
          mistakes: number
          rematch: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          correct_cells?: number
          match_id: string
          mistakes?: number
          rematch?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          correct_cells?: number
          match_id?: string
          mistakes?: number
          rematch?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "game_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_stats: {
        Row: {
          completed_puzzles: number
          draws: number
          losses: number
          total_completion_time: number
          total_matches: number
          total_playtime: number
          user_id: string
          wins: number
        }
        Insert: {
          completed_puzzles?: number
          draws?: number
          losses?: number
          total_completion_time?: number
          total_matches?: number
          total_playtime?: number
          user_id: string
          wins?: number
        }
        Update: {
          completed_puzzles?: number
          draws?: number
          losses?: number
          total_completion_time?: number
          total_matches?: number
          total_playtime?: number
          user_id?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      room_players: {
        Row: {
          joined_at: string
          last_seen: string
          ready: boolean
          room_id: string
          seat: number
          user_id: string
        }
        Insert: {
          joined_at?: string
          last_seen?: string
          ready?: boolean
          room_id: string
          seat: number
          user_id: string
        }
        Update: {
          joined_at?: string
          last_seen?: string
          ready?: boolean
          room_id?: string
          seat?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_effects: {
        Row: {
          consumed_at: string | null
          expires_at: string
          id: string
          keypad: number[] | null
          match_id: string
          region: number | null
          skill: string
          source_id: string
          starts_at: string
          target_id: string
        }
        Insert: {
          consumed_at?: string | null
          expires_at: string
          id?: string
          keypad?: number[] | null
          match_id: string
          region?: number | null
          skill: string
          source_id: string
          starts_at: string
          target_id: string
        }
        Update: {
          consumed_at?: string | null
          expires_at?: string
          id?: string
          keypad?: number[] | null
          match_id?: string
          region?: number | null
          skill?: string
          source_id?: string
          starts_at?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_effects_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "game_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_effects_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_effects_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      suduel_command: {
        Args: { p_action_id?: string; p_command: string; p_payload: Json }
        Returns: Json
      }
      suduel_start: {
        Args: {
          p_action: string
          p_actor: string
          p_clues: number[]
          p_room: string
          p_solution: number[]
        }
        Returns: string
      }
      suduel_start_battle: {
        Args: {
          p_action: string
          p_actor: string
          p_puzzles: Json
          p_room: string
        }
        Returns: string
      }
      suduel_username_available: {
        Args: { p_username: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
