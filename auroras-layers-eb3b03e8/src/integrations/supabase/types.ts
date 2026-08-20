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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      aurora_character_versions: {
        Row: {
          change_note: string | null
          character_id: string
          created_at: string
          id: string
          reference_paths: Json
          traits: Json
          user_id: string
          version: number
        }
        Insert: {
          change_note?: string | null
          character_id: string
          created_at?: string
          id?: string
          reference_paths?: Json
          traits?: Json
          user_id: string
          version: number
        }
        Update: {
          change_note?: string | null
          character_id?: string
          created_at?: string
          id?: string
          reference_paths?: Json
          traits?: Json
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "aurora_character_versions_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "aurora_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      aurora_characters: {
        Row: {
          alias: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          reference_paths: Json
          traits: Json
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          alias?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          reference_paths?: Json
          traits?: Json
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          alias?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          reference_paths?: Json
          traits?: Json
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      aurora_embed_sso_tokens: {
        Row: {
          created_at: string
          expires_at: string
          host_origin: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          host_origin: string
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          host_origin?: string
          token_hash?: string
        }
        Relationships: []
      }
      aurora_projects: {
        Row: {
          brain_model: string
          character_id: string | null
          character_reference_path: string | null
          character_version: number | null
          created_at: string
          id: string
          identity_lock: boolean
          image_model: string
          layers: Json
          name: string
          preview_path: string | null
          prompt: string
          source_path: string | null
          storyboard: Json
          updated_at: string
          user_id: string
          video_model: string
        }
        Insert: {
          brain_model?: string
          character_id?: string | null
          character_reference_path?: string | null
          character_version?: number | null
          created_at?: string
          id?: string
          identity_lock?: boolean
          image_model?: string
          layers?: Json
          name?: string
          preview_path?: string | null
          prompt?: string
          source_path?: string | null
          storyboard?: Json
          updated_at?: string
          user_id: string
          video_model?: string
        }
        Update: {
          brain_model?: string
          character_id?: string | null
          character_reference_path?: string | null
          character_version?: number | null
          created_at?: string
          id?: string
          identity_lock?: boolean
          image_model?: string
          layers?: Json
          name?: string
          preview_path?: string | null
          prompt?: string
          source_path?: string | null
          storyboard?: Json
          updated_at?: string
          user_id?: string
          video_model?: string
        }
        Relationships: [
          {
            foreignKeyName: "aurora_projects_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "aurora_characters"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
