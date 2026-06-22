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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      affiliate_events: {
        Row: {
          amount_usd: number | null
          code: string
          created_at: string
          id: string
          kind: string
          ref_id: string | null
          user_id: string | null
        }
        Insert: {
          amount_usd?: number | null
          code: string
          created_at?: string
          id?: string
          kind: string
          ref_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount_usd?: number | null
          code?: string
          created_at?: string
          id?: string
          kind?: string
          ref_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      affiliates: {
        Row: {
          code: string
          commission_pct: number
          created_at: string
          id: string
          payout_email: string | null
          total_earned_usd: number
          user_id: string
        }
        Insert: {
          code: string
          commission_pct?: number
          created_at?: string
          id?: string
          payout_email?: string | null
          total_earned_usd?: number
          user_id: string
        }
        Update: {
          code?: string
          commission_pct?: number
          created_at?: string
          id?: string
          payout_email?: string | null
          total_earned_usd?: number
          user_id?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cli_device_codes: {
        Row: {
          api_key_plain: string | null
          created_at: string
          device_code: string
          expires_at: string
          id: string
          status: string
          user_code: string
          user_id: string | null
        }
        Insert: {
          api_key_plain?: string | null
          created_at?: string
          device_code: string
          expires_at?: string
          id?: string
          status?: string
          user_code: string
          user_id?: string | null
        }
        Update: {
          api_key_plain?: string | null
          created_at?: string
          device_code?: string
          expires_at?: string
          id?: string
          status?: string
          user_code?: string
          user_id?: string | null
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string | null
          status: string
          topic: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name?: string | null
          status?: string
          topic?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string | null
          status?: string
          topic?: string
          user_id?: string | null
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          reason: string
          ref_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          reason: string
          ref_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          ref_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_log: {
        Row: {
          error: string | null
          id: string
          sent_at: string
          status: string
          template: string
          to_email: string
          user_id: string | null
        }
        Insert: {
          error?: string | null
          id?: string
          sent_at?: string
          status?: string
          template: string
          to_email: string
          user_id?: string | null
        }
        Update: {
          error?: string | null
          id?: string
          sent_at?: string
          status?: string
          template?: string
          to_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          id: string
          name: string
          path: string | null
          payload: Json | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          path?: string | null
          payload?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          path?: string | null
          payload?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      generations: {
        Row: {
          audio_url: string | null
          camera_movement: string | null
          created_at: string
          credits_cost: number
          error: string | null
          id: string
          input_images: Json
          input_videos: Json
          is_favorite: boolean
          is_public: boolean
          kind: string
          mode: string
          model: string | null
          motion_video_url: string | null
          prompt: string
          result_image_url: string | null
          result_video_url: string | null
          share_token: string | null
          status: string
          tags: string[]
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          camera_movement?: string | null
          created_at?: string
          credits_cost?: number
          error?: string | null
          id?: string
          input_images?: Json
          input_videos?: Json
          is_favorite?: boolean
          is_public?: boolean
          kind?: string
          mode?: string
          model?: string | null
          motion_video_url?: string | null
          prompt: string
          result_image_url?: string | null
          result_video_url?: string | null
          share_token?: string | null
          status?: string
          tags?: string[]
          user_id: string
        }
        Update: {
          audio_url?: string | null
          camera_movement?: string | null
          created_at?: string
          credits_cost?: number
          error?: string | null
          id?: string
          input_images?: Json
          input_videos?: Json
          is_favorite?: boolean
          is_public?: boolean
          kind?: string
          mode?: string
          model?: string | null
          motion_video_url?: string | null
          prompt?: string
          result_image_url?: string | null
          result_video_url?: string | null
          share_token?: string | null
          status?: string
          tags?: string[]
          user_id?: string
        }
        Relationships: []
      }
      gift_cards: {
        Row: {
          amount_usd: number
          code: string
          created_at: string
          created_by: string
          credits: number
          design: string
          id: string
          note: string | null
          redeemed_at: string | null
          redeemed_by: string | null
        }
        Insert: {
          amount_usd?: number
          code: string
          created_at?: string
          created_by: string
          credits: number
          design?: string
          id?: string
          note?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
        }
        Update: {
          amount_usd?: number
          code?: string
          created_at?: string
          created_by?: string
          credits?: number
          design?: string
          id?: string
          note?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
        }
        Relationships: []
      }
      gpu_workers: {
        Row: {
          auth_token: string | null
          capabilities: string[]
          created_at: string
          endpoint_url: string
          id: string
          in_flight: number
          last_heartbeat: string | null
          max_concurrency: number
          models: string[]
          name: string
          priority: number
          region: string | null
          status: string
        }
        Insert: {
          auth_token?: string | null
          capabilities?: string[]
          created_at?: string
          endpoint_url: string
          id?: string
          in_flight?: number
          last_heartbeat?: string | null
          max_concurrency?: number
          models?: string[]
          name: string
          priority?: number
          region?: string | null
          status?: string
        }
        Update: {
          auth_token?: string | null
          capabilities?: string[]
          created_at?: string
          endpoint_url?: string
          id?: string
          in_flight?: number
          last_heartbeat?: string | null
          max_concurrency?: number
          models?: string[]
          name?: string
          priority?: number
          region?: string | null
          status?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          attempts: number
          created_at: string
          credits_reserved: number
          error: string | null
          finished_at: string | null
          generation_id: string | null
          id: string
          kind: string
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          parent_job_id: string | null
          payload: Json
          priority: number
          result: Json | null
          scheduled_at: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          credits_reserved?: number
          error?: string | null
          finished_at?: string | null
          generation_id?: string | null
          id?: string
          kind: string
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          parent_job_id?: string | null
          payload?: Json
          priority?: number
          result?: Json | null
          scheduled_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          credits_reserved?: number
          error?: string | null
          finished_at?: string | null
          generation_id?: string | null
          id?: string
          kind?: string
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          parent_job_id?: string | null
          payload?: Json
          priority?: number
          result?: Json | null
          scheduled_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          email: string
          id: string
          ref_code: string | null
          source: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ref_code?: string | null
          source?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ref_code?: string | null
          source?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          document: string
          id: string
          ip: string | null
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          document: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          document?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      lipsync_jobs: {
        Row: {
          audio_url: string
          created_at: string
          engine: string
          error: string | null
          id: string
          result_url: string | null
          status: string
          updated_at: string
          user_id: string
          video_url: string
        }
        Insert: {
          audio_url: string
          created_at?: string
          engine?: string
          error?: string | null
          id?: string
          result_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
          video_url: string
        }
        Update: {
          audio_url?: string
          created_at?: string
          engine?: string
          error?: string | null
          id?: string
          result_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          video_url?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_kobo: number
          created_at: string
          credits_granted: number
          currency: string
          id: string
          provider: string
          raw: Json | null
          reference: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_kobo: number
          created_at?: string
          credits_granted?: number
          currency?: string
          id?: string
          provider?: string
          raw?: Json | null
          reference: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_kobo?: number
          created_at?: string
          credits_granted?: number
          currency?: string
          id?: string
          provider?: string
          raw?: Json | null
          reference?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          credits: number
          credits_reserved: number
          display_name: string | null
          email: string | null
          id: string
          lifetime_credits_purchased: number
          plan: string
          referred_by_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          credits_reserved?: number
          display_name?: string | null
          email?: string | null
          id?: string
          lifetime_credits_purchased?: number
          plan?: string
          referred_by_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          credits_reserved?: number
          display_name?: string | null
          email?: string | null
          id?: string
          lifetime_credits_purchased?: number
          plan?: string
          referred_by_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provider_logs: {
        Row: {
          cost_usd: number | null
          created_at: string
          endpoint: string
          error: string | null
          id: string
          kind: string
          latency_ms: number | null
          provider: string
          ref_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string
          endpoint: string
          error?: string | null
          id?: string
          kind: string
          latency_ms?: number | null
          provider: string
          ref_id?: string | null
          status: string
          user_id?: string | null
        }
        Update: {
          cost_usd?: number | null
          created_at?: string
          endpoint?: string
          error?: string | null
          id?: string
          kind?: string
          latency_ms?: number | null
          provider?: string
          ref_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      smoke_checks: {
        Row: {
          cost_usd: number | null
          created_at: string
          error: string | null
          id: string
          latency_ms: number | null
          name: string
          output_url: string | null
          raw: Json | null
          run_id: string
          status: string
          step: number
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          id?: string
          latency_ms?: number | null
          name: string
          output_url?: string | null
          raw?: Json | null
          run_id: string
          status?: string
          step: number
        }
        Update: {
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          id?: string
          latency_ms?: number | null
          name?: string
          output_url?: string | null
          raw?: Json | null
          run_id?: string
          status?: string
          step?: number
        }
        Relationships: [
          {
            foreignKeyName: "smoke_checks_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "smoke_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      smoke_runs: {
        Row: {
          finished_at: string | null
          id: string
          started_at: string
          summary: Json | null
          total_cost_usd: number | null
          triggered_by: string
        }
        Insert: {
          finished_at?: string | null
          id?: string
          started_at?: string
          summary?: Json | null
          total_cost_usd?: number | null
          triggered_by: string
        }
        Update: {
          finished_at?: string | null
          id?: string
          started_at?: string
          summary?: Json | null
          total_cost_usd?: number | null
          triggered_by?: string
        }
        Relationships: []
      }
      spin_jobs: {
        Row: {
          created_at: string
          id: string
          prompt: string
          status: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          prompt: string
          status?: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          prompt?: string
          status?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      spin_variants: {
        Row: {
          created_at: string
          error: string | null
          id: string
          idx: number
          job_id: string
          label: string
          status: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          idx: number
          job_id: string
          label: string
          status?: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          idx?: number
          job_id?: string
          label?: string
          status?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spin_variants_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "spin_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_remixes: {
        Row: {
          child_generation_ids: Json
          child_job_ids: Json
          created_at: string
          error: string | null
          highlights: Json
          id: string
          prompt: string | null
          source_generation_id: string | null
          source_video_url: string
          status: string
          target_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          child_generation_ids?: Json
          child_job_ids?: Json
          created_at?: string
          error?: string | null
          highlights?: Json
          id?: string
          prompt?: string | null
          source_generation_id?: string | null
          source_video_url: string
          status?: string
          target_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          child_generation_ids?: Json
          child_job_ids?: Json
          created_at?: string
          error?: string | null
          highlights?: Json
          id?: string
          prompt?: string | null
          source_generation_id?: string | null
          source_video_url?: string
          status?: string
          target_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_webhooks: {
        Row: {
          active: boolean
          created_at: string
          events: string[]
          id: string
          secret: string
          url: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          secret: string
          url: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          secret?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      worker_jobs: {
        Row: {
          cost_usd: number | null
          created_at: string
          error: string | null
          id: string
          kind: string
          latency_ms: number | null
          ref_id: string | null
          status: string
          user_id: string | null
          worker_id: string | null
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          latency_ms?: number | null
          ref_id?: string | null
          status?: string
          user_id?: string | null
          worker_id?: string | null
        }
        Update: {
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          latency_ms?: number | null
          ref_id?: string | null
          status?: string
          user_id?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_jobs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "gpu_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string
          description: string | null
          graph: Json
          id: string
          is_public: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          graph?: Json
          id?: string
          is_public?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          graph?: Json
          id?: string
          is_public?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_next_job: {
        Args: { _worker: string }
        Returns: {
          attempts: number
          created_at: string
          credits_reserved: number
          error: string | null
          finished_at: string | null
          generation_id: string | null
          id: string
          kind: string
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          parent_job_id: string | null
          payload: Json
          priority: number
          result: Json | null
          scheduled_at: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      commit_reservation: {
        Args: { _amount: number; _reason: string; _ref: string; _user: string }
        Returns: undefined
      }
      create_generation_and_reserve: {
        Args: {
          _amount: number
          _kind: string
          _payload: Json
          _prompt: string
          _user: string
        }
        Returns: {
          generation_id: string
          job_id: string
        }[]
      }
      deduct_credits: {
        Args: { _amount: number; _reason: string; _ref: string; _user: string }
        Returns: boolean
      }
      grant_credits: {
        Args: { _amount: number; _reason: string; _ref: string; _user: string }
        Returns: undefined
      }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _user: string }
        Returns: boolean
      }
      release_reservation: {
        Args: { _amount: number; _reason: string; _ref: string; _user: string }
        Returns: undefined
      }
      reserve_credits: {
        Args: { _amount: number; _reason: string; _ref: string; _user: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
