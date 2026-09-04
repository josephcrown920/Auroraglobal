export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      account_deletion_sweeps: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ad_variations: {
        Row: {
          aspect: string | null
          batch_id: string
          created_at: string
          error: string | null
          id: string
          kind: string
          likeness_id: string | null
          meta: Json
          source_generation_id: string | null
          status: string
          text_value: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          aspect?: string | null
          batch_id: string
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          likeness_id?: string | null
          meta?: Json
          source_generation_id?: string | null
          status?: string
          text_value?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          aspect?: string | null
          batch_id?: string
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          likeness_id?: string | null
          meta?: Json
          source_generation_id?: string | null
          status?: string
          text_value?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
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
      agent_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          plan: Json | null
          role: string
          skill_meta: Json | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          plan?: Json | null
          role: string
          skill_meta?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          plan?: Json | null
          role?: string
          skill_meta?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      agent_sessions: {
        Row: {
          brief: string
          created_at: string
          id: string
          iterations: Json
          messages: Json
          plan: Json
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brief?: string
          created_at?: string
          id?: string
          iterations?: Json
          messages?: Json
          plan?: Json
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brief?: string
          created_at?: string
          id?: string
          iterations?: Json
          messages?: Json
          plan?: Json
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_user_memory: {
        Row: {
          memory: string
          structured_memory: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          memory?: string
          structured_memory?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          memory?: string
          structured_memory?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_router_logs: {
        Row: {
          category: string
          created_at: string
          estimated_cost: number
          failure_reason: string | null
          fallback_count: number
          id: string
          latency_ms: number
          provider_used: string
          success: boolean
        }
        Insert: {
          category: string
          created_at?: string
          estimated_cost?: number
          failure_reason?: string | null
          fallback_count?: number
          id?: string
          latency_ms?: number
          provider_used: string
          success: boolean
        }
        Update: {
          category?: string
          created_at?: string
          estimated_cost?: number
          failure_reason?: string | null
          fallback_count?: number
          id?: string
          latency_ms?: number
          provider_used?: string
          success?: boolean
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
      api_logs: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          ip: string | null
          method: string
          response_time_ms: number
          source: string
          status: number
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          ip?: string | null
          method: string
          response_time_ms: number
          source: string
          status: number
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          ip?: string | null
          method?: string
          response_time_ms?: number
          source?: string
          status?: number
          user_agent?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      aurora_templates: {
        Row: {
          character_variable_key: string
          created_at: string
          fixed_variables: Json
          heygen_template_id: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          character_variable_key: string
          created_at?: string
          fixed_variables?: Json
          heygen_template_id: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          character_variable_key?: string
          created_at?: string
          fixed_variables?: Json
          heygen_template_id?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      avatars: {
        Row: {
          created_at: string
          handle: string
          id: string
          lora_id: string | null
          name: string
          preview_url: string | null
          style: string | null
          sync_lora_id: string | null
          training_completed_at: string | null
          training_error: string | null
          training_status: string
          training_submitted_at: string | null
          trigger_word: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          handle: string
          id?: string
          lora_id?: string | null
          name: string
          preview_url?: string | null
          style?: string | null
          sync_lora_id?: string | null
          training_completed_at?: string | null
          training_error?: string | null
          training_status?: string
          training_submitted_at?: string | null
          trigger_word?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          handle?: string
          id?: string
          lora_id?: string | null
          name?: string
          preview_url?: string | null
          style?: string | null
          sync_lora_id?: string | null
          training_completed_at?: string | null
          training_error?: string | null
          training_status?: string
          training_submitted_at?: string | null
          trigger_word?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      board_items: {
        Row: {
          board_id: string
          created_at: string
          height: number | null
          id: string
          image_url: string | null
          metadata: Json
          node_id: string | null
          prompt: string | null
          source_url: string | null
          type: string
          user_id: string
          video_url: string | null
          width: number | null
          x: number
          y: number
          z_index: number
        }
        Insert: {
          board_id: string
          created_at?: string
          height?: number | null
          id?: string
          image_url?: string | null
          metadata?: Json
          node_id?: string | null
          prompt?: string | null
          source_url?: string | null
          type?: string
          user_id: string
          video_url?: string | null
          width?: number | null
          x?: number
          y?: number
          z_index?: number
        }
        Update: {
          board_id?: string
          created_at?: string
          height?: number | null
          id?: string
          image_url?: string | null
          metadata?: Json
          node_id?: string | null
          prompt?: string | null
          source_url?: string | null
          type?: string
          user_id?: string
          video_url?: string | null
          width?: number | null
          x?: number
          y?: number
          z_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "board_items_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          created_at: string
          description: string | null
          id: string
          thumbnail: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          thumbnail?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          thumbnail?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      character_profiles: {
        Row: {
          created_at: string
          id: string
          identity_prompt: string
          name: string
          reference_image_url: string | null
          updated_at: string
          user_id: string
          voice_notes: string | null
          wardrobe_notes: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          identity_prompt?: string
          name: string
          reference_image_url?: string | null
          updated_at?: string
          user_id: string
          voice_notes?: string | null
          wardrobe_notes?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          identity_prompt?: string
          name?: string
          reference_image_url?: string | null
          updated_at?: string
          user_id?: string
          voice_notes?: string | null
          wardrobe_notes?: string | null
        }
        Relationships: []
      }
      chat_threads: {
        Row: {
          board_id: string | null
          created_at: string
          id: string
          messages: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          board_id?: string | null
          created_at?: string
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          board_id?: string | null
          created_at?: string
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
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
      cm_batch_items: {
        Row: {
          batch_id: string
          created_at: string
          credits_reserved: number
          generation_id: string | null
          id: string
          job_id: string | null
          seq: number
          template_id: string | null
          template_name: string | null
          user_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          credits_reserved?: number
          generation_id?: string | null
          id?: string
          job_id?: string | null
          seq?: number
          template_id?: string | null
          template_name?: string | null
          user_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          credits_reserved?: number
          generation_id?: string | null
          id?: string
          job_id?: string | null
          seq?: number
          template_id?: string | null
          template_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cm_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "cm_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_batch_items_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_batch_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_batch_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "cm_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      cm_batches: {
        Row: {
          count_per_template: number
          created_at: string
          credits_reserved: number
          id: string
          note: string | null
          product_id: string | null
          product_name: string | null
          status: string
          template_ids: Json
          total_items: number
          updated_at: string
          user_id: string
        }
        Insert: {
          count_per_template?: number
          created_at?: string
          credits_reserved?: number
          id?: string
          note?: string | null
          product_id?: string | null
          product_name?: string | null
          status?: string
          template_ids?: Json
          total_items?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          count_per_template?: number
          created_at?: string
          credits_reserved?: number
          id?: string
          note?: string | null
          product_id?: string | null
          product_name?: string | null
          status?: string
          template_ids?: Json
          total_items?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cm_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "cm_products"
            referencedColumns: ["id"]
          },
        ]
      }
      cm_products: {
        Row: {
          audience: string | null
          brand_voice: string | null
          created_at: string
          cta: string | null
          description: string | null
          id: string
          link: string | null
          name: string
          photos: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          audience?: string | null
          brand_voice?: string | null
          created_at?: string
          cta?: string | null
          description?: string | null
          id?: string
          link?: string | null
          name: string
          photos?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          audience?: string | null
          brand_voice?: string | null
          created_at?: string
          cta?: string | null
          description?: string | null
          id?: string
          link?: string | null
          name?: string
          photos?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cm_templates: {
        Row: {
          aspect: string
          created_at: string
          description: string | null
          duration: number
          icon: string | null
          id: string
          is_system: boolean
          motion_hint: string | null
          name: string
          scene_hint: string
          script_formula: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          aspect?: string
          created_at?: string
          description?: string | null
          duration?: number
          icon?: string | null
          id?: string
          is_system?: boolean
          motion_hint?: string | null
          name: string
          scene_hint: string
          script_formula?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          aspect?: string
          created_at?: string
          description?: string | null
          duration?: number
          icon?: string | null
          id?: string
          is_system?: boolean
          motion_hint?: string | null
          name?: string
          scene_hint?: string
          script_formula?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      comfy_runs: {
        Row: {
          created_at: string
          error: string | null
          external_run_id: string | null
          generation_id: string | null
          id: string
          input_values: Json
          output_kind: string | null
          output_url: string | null
          progress_pct: number
          prompt_id: string | null
          source: string
          status: string
          updated_at: string
          user_id: string
          worker_id: string | null
          workflow_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          external_run_id?: string | null
          generation_id?: string | null
          id?: string
          input_values?: Json
          output_kind?: string | null
          output_url?: string | null
          progress_pct?: number
          prompt_id?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id: string
          worker_id?: string | null
          workflow_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          external_run_id?: string | null
          generation_id?: string | null
          id?: string
          input_values?: Json
          output_kind?: string | null
          output_url?: string | null
          progress_pct?: number
          prompt_id?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
          worker_id?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comfy_runs_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comfy_runs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "gpu_workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comfy_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "comfy_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      comfy_workflows: {
        Row: {
          created_at: string
          created_by_admin: boolean
          declared_inputs: Json
          default_inputs: Json
          description: string | null
          id: string
          is_public: boolean
          kind: string
          name: string
          owner_user_id: string | null
          updated_at: string
          workflow_json: Json
        }
        Insert: {
          created_at?: string
          created_by_admin?: boolean
          declared_inputs?: Json
          default_inputs?: Json
          description?: string | null
          id?: string
          is_public?: boolean
          kind?: string
          name: string
          owner_user_id?: string | null
          updated_at?: string
          workflow_json?: Json
        }
        Update: {
          created_at?: string
          created_by_admin?: boolean
          declared_inputs?: Json
          default_inputs?: Json
          description?: string | null
          id?: string
          is_public?: boolean
          kind?: string
          name?: string
          owner_user_id?: string | null
          updated_at?: string
          workflow_json?: Json
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_logs: {
        Row: {
          consented_at: string
          id: string
          policy_version: string
          tool: string
          user_id: string
        }
        Insert: {
          consented_at?: string
          id?: string
          policy_version: string
          tool: string
          user_id: string
        }
        Update: {
          consented_at?: string
          id?: string
          policy_version?: string
          tool?: string
          user_id?: string
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
          actor_id: string | null
          created_at: string
          delta: number
          id: string
          reason: string
          ref_id: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          delta: number
          id?: string
          reason: string
          ref_id?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          ref_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      edit_sessions: {
        Row: {
          chat_history: Json
          clip_list: Json
          created_at: string
          id: string
          music_track_id: string | null
          result_url: string | null
          status: string
          style: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_history?: Json
          clip_list?: Json
          created_at?: string
          id?: string
          music_track_id?: string | null
          result_url?: string | null
          status?: string
          style?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_history?: Json
          clip_list?: Json
          created_at?: string
          id?: string
          music_track_id?: string | null
          result_url?: string | null
          status?: string
          style?: string
          title?: string
          updated_at?: string
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
      generation_health_state: {
        Row: {
          alert_sent_at: string | null
          consecutive_errors: number
          consecutive_ok: number
          kind: string
          last_check_at: string | null
          last_error_summary: string | null
          last_ok_at: string | null
          recovery_sent_at: string | null
          updated_at: string
        }
        Insert: {
          alert_sent_at?: string | null
          consecutive_errors?: number
          consecutive_ok?: number
          kind: string
          last_check_at?: string | null
          last_error_summary?: string | null
          last_ok_at?: string | null
          recovery_sent_at?: string | null
          updated_at?: string
        }
        Update: {
          alert_sent_at?: string | null
          consecutive_errors?: number
          consecutive_ok?: number
          kind?: string
          last_check_at?: string | null
          last_error_summary?: string | null
          last_ok_at?: string | null
          recovery_sent_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      generation_idempotency_keys: {
        Row: {
          created_at: string
          error: string | null
          generation_id: string | null
          idempotency_key: string
          response: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          generation_id?: string | null
          idempotency_key: string
          response?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          generation_id?: string | null
          idempotency_key?: string
          response?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_idempotency_keys_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
        ]
      }
      generations: {
        Row: {
          agent_shot_id: string | null
          audio_url: string | null
          camera_movement: string | null
          created_at: string
          credits_cost: number
          error: string | null
          id: string
          input_images: Json
          input_videos: Json
          is_favorite: boolean
          is_hidden: boolean
          is_public: boolean
          is_watermarked: boolean
          kind: string
          mode: string
          model: string | null
          motion_video_url: string | null
          prompt: string
          result_image_url: string | null
          result_text: string | null
          result_video_url: string | null
          session_id: string | null
          share_token: string | null
          status: string
          tags: string[]
          user_id: string
        }
        Insert: {
          agent_shot_id?: string | null
          audio_url?: string | null
          camera_movement?: string | null
          created_at?: string
          credits_cost?: number
          error?: string | null
          id?: string
          input_images?: Json
          input_videos?: Json
          is_favorite?: boolean
          is_hidden?: boolean
          is_public?: boolean
          is_watermarked?: boolean
          kind?: string
          mode?: string
          model?: string | null
          motion_video_url?: string | null
          prompt: string
          result_image_url?: string | null
          result_text?: string | null
          result_video_url?: string | null
          session_id?: string | null
          share_token?: string | null
          status?: string
          tags?: string[]
          user_id: string
        }
        Update: {
          agent_shot_id?: string | null
          audio_url?: string | null
          camera_movement?: string | null
          created_at?: string
          credits_cost?: number
          error?: string | null
          id?: string
          input_images?: Json
          input_videos?: Json
          is_favorite?: boolean
          is_hidden?: boolean
          is_public?: boolean
          is_watermarked?: boolean
          kind?: string
          mode?: string
          model?: string | null
          motion_video_url?: string | null
          prompt?: string
          result_image_url?: string | null
          result_text?: string | null
          result_video_url?: string | null
          session_id?: string | null
          share_token?: string | null
          status?: string
          tags?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "agent_sessions"
            referencedColumns: ["id"]
          },
        ]
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
          kind: string
          note: string | null
          payment_provider: string | null
          payment_status: string
          pro_days: number
          purchase_reference: string | null
          purchaser_id: string | null
          recipient_email: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          status: string
        }
        Insert: {
          amount_usd?: number
          code: string
          created_at?: string
          created_by: string
          credits: number
          design?: string
          id?: string
          kind?: string
          note?: string | null
          payment_provider?: string | null
          payment_status?: string
          pro_days?: number
          purchase_reference?: string | null
          purchaser_id?: string | null
          recipient_email?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
        }
        Update: {
          amount_usd?: number
          code?: string
          created_at?: string
          created_by?: string
          credits?: number
          design?: string
          id?: string
          kind?: string
          note?: string | null
          payment_provider?: string | null
          payment_status?: string
          pro_days?: number
          purchase_reference?: string | null
          purchaser_id?: string | null
          recipient_email?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
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
          lanes: string[]
          last_heartbeat: string | null
          last_probe_at: string | null
          last_probe_detail: string | null
          last_probe_error: string | null
          last_probe_ok: boolean | null
          max_concurrency: number
          models: string[]
          name: string
          paused_reason: string | null
          priority: number
          protocol: string
          region: string | null
          runpod_sync: boolean
          status: string
          worker_role: string | null
        }
        Insert: {
          auth_token?: string | null
          capabilities?: string[]
          created_at?: string
          endpoint_url: string
          id?: string
          in_flight?: number
          lanes?: string[]
          last_heartbeat?: string | null
          last_probe_at?: string | null
          last_probe_detail?: string | null
          last_probe_error?: string | null
          last_probe_ok?: boolean | null
          max_concurrency?: number
          models?: string[]
          name: string
          paused_reason?: string | null
          priority?: number
          protocol?: string
          region?: string | null
          runpod_sync?: boolean
          status?: string
          worker_role?: string | null
        }
        Update: {
          auth_token?: string | null
          capabilities?: string[]
          created_at?: string
          endpoint_url?: string
          id?: string
          in_flight?: number
          lanes?: string[]
          last_heartbeat?: string | null
          last_probe_at?: string | null
          last_probe_detail?: string | null
          last_probe_error?: string | null
          last_probe_ok?: boolean | null
          max_concurrency?: number
          models?: string[]
          name?: string
          paused_reason?: string | null
          priority?: number
          protocol?: string
          region?: string | null
          runpod_sync?: boolean
          status?: string
          worker_role?: string | null
        }
        Relationships: []
      }
      growth_tool_runs: {
        Row: {
          created_at: string
          id: string
          input: Json
          output: Json
          tool: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input?: Json
          output?: Json
          tool: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input?: Json
          output?: Json
          tool?: string
          user_id?: string
        }
        Relationships: []
      }
      guided_workflows: {
        Row: {
          category: string
          created_at: string
          description: string
          icon: string
          id: string
          is_published: boolean
          slug: string
          sort_order: number
          source_credit: string
          steps: Json
          tagline: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_published?: boolean
          slug: string
          sort_order?: number
          source_credit?: string
          steps?: Json
          tagline?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_published?: boolean
          slug?: string
          sort_order?: number
          source_credit?: string
          steps?: Json
          tagline?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          attempts: number
          created_at: string
          credits_reserved: number
          credits_settled_at: string | null
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
          progress_pct: number | null
          progress_stage: string | null
          progress_updated_at: string | null
          queue: string
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
          credits_settled_at?: string | null
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
          progress_pct?: number | null
          progress_stage?: string | null
          progress_updated_at?: string | null
          queue?: string
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
          credits_settled_at?: string | null
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
          progress_pct?: number | null
          progress_stage?: string | null
          progress_updated_at?: string | null
          queue?: string
          result?: Json | null
          scheduled_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_stories: {
        Row: {
          brief: Json
          created_at: string
          error: string | null
          final_video_url: string | null
          generation_id: string | null
          id: string
          job_id: string | null
          poster_url: string | null
          scenes: Json
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brief?: Json
          created_at?: string
          error?: string | null
          final_video_url?: string | null
          generation_id?: string | null
          id?: string
          job_id?: string | null
          poster_url?: string | null
          scenes?: Json
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brief?: Json
          created_at?: string
          error?: string | null
          final_video_url?: string | null
          generation_id?: string | null
          id?: string
          job_id?: string | null
          poster_url?: string | null
          scenes?: Json
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_stories_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_stories_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
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
      likeness_locks: {
        Row: {
          created_at: string
          extra_paths: string[]
          id: string
          locked_at: string
          name: string
          primary_path: string
          spec: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          extra_paths?: string[]
          id?: string
          locked_at?: string
          name: string
          primary_path: string
          spec?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          extra_paths?: string[]
          id?: string
          locked_at?: string
          name?: string
          primary_path?: string
          spec?: Json
          user_id?: string
        }
        Relationships: []
      }
      lipsync_jobs: {
        Row: {
          audio_url: string
          batch_id: string | null
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
          batch_id?: string | null
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
          batch_id?: string | null
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
      marketplace_template_runs: {
        Row: {
          aura_charged: number
          created_at: string
          creator_cut_aura: number
          creator_user_id: string
          id: string
          platform_cut_aura: number
          runner_user_id: string
          template_id: string
        }
        Insert: {
          aura_charged: number
          created_at?: string
          creator_cut_aura: number
          creator_user_id: string
          id?: string
          platform_cut_aura: number
          runner_user_id: string
          template_id: string
        }
        Update: {
          aura_charged?: number
          created_at?: string
          creator_cut_aura?: number
          creator_user_id?: string
          id?: string
          platform_cut_aura?: number
          runner_user_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_template_runs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "marketplace_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_templates: {
        Row: {
          category: string
          created_at: string
          creator_user_id: string
          cut_pct: number
          description: string
          graph_json: Json
          id: string
          name: string
          rejection_reason: string | null
          run_cost_aura: number
          run_count: number
          status: string
          tags: string[]
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          creator_user_id: string
          cut_pct?: number
          description?: string
          graph_json?: Json
          id?: string
          name: string
          rejection_reason?: string | null
          run_cost_aura?: number
          run_count?: number
          status?: string
          tags?: string[]
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          creator_user_id?: string
          cut_pct?: number
          description?: string
          graph_json?: Json
          id?: string
          name?: string
          rejection_reason?: string | null
          run_cost_aura?: number
          run_count?: number
          status?: string
          tags?: string[]
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      model_watch: {
        Row: {
          availability: string | null
          category: string | null
          first_seen: string
          id: string
          last_checked: string
          meta: Json
          model_id: string
          provider: string
          status: string
          title: string | null
          watch_kind: string
        }
        Insert: {
          availability?: string | null
          category?: string | null
          first_seen?: string
          id?: string
          last_checked?: string
          meta?: Json
          model_id: string
          provider: string
          status?: string
          title?: string | null
          watch_kind?: string
        }
        Update: {
          availability?: string | null
          category?: string | null
          first_seen?: string
          id?: string
          last_checked?: string
          meta?: Json
          model_id?: string
          provider?: string
          status?: string
          title?: string | null
          watch_kind?: string
        }
        Relationships: []
      }
      owner_withdrawals: {
        Row: {
          amount_minor: number
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          withdrawn_at: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          withdrawn_at?: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          withdrawn_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_kobo: number
          created_at: string
          credit_funding_amount_minor: number | null
          credits_granted: number
          currency: string
          discount_percent_off: number | null
          gift_card_id: string | null
          id: string
          pro_days: number
          profit_amount_minor: number | null
          promo_code_id: string | null
          provider: string
          purpose: string
          raw: Json | null
          reference: string
          split_profit_pct: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_kobo: number
          created_at?: string
          credit_funding_amount_minor?: number | null
          credits_granted?: number
          currency?: string
          discount_percent_off?: number | null
          gift_card_id?: string | null
          id?: string
          pro_days?: number
          profit_amount_minor?: number | null
          promo_code_id?: string | null
          provider?: string
          purpose?: string
          raw?: Json | null
          reference: string
          split_profit_pct?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_kobo?: number
          created_at?: string
          credit_funding_amount_minor?: number | null
          credits_granted?: number
          currency?: string
          discount_percent_off?: number | null
          gift_card_id?: string | null
          id?: string
          pro_days?: number
          profit_amount_minor?: number | null
          promo_code_id?: string | null
          provider?: string
          purpose?: string
          raw?: Json | null
          reference?: string
          split_profit_pct?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_gift_card_id_fkey"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "gift_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          content: string
          created_at: string
          id: string
          published_at: string | null
          slug: string
          title: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          published_at?: string | null
          slug: string
          title: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          published_at?: string | null
          slug?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_access_grants: {
        Row: {
          created_at: string
          days: number
          id: string
          source_ref: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days: number
          id?: string
          source_ref: string
          user_id: string
        }
        Update: {
          created_at?: string
          days?: number
          id?: string
          source_ref?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          credits: number
          credits_reserved: number
          daily_spend_limit: number | null
          display_name: string | null
          email: string | null
          id: string
          lifetime_credits_purchased: number
          onboarding_bonus_granted: boolean
          paystack_subscription_code: string | null
          persona: string | null
          plan: string
          referred_by_code: string | null
          subscription_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          credits_reserved?: number
          daily_spend_limit?: number | null
          display_name?: string | null
          email?: string | null
          id?: string
          lifetime_credits_purchased?: number
          onboarding_bonus_granted?: boolean
          paystack_subscription_code?: string | null
          persona?: string | null
          plan?: string
          referred_by_code?: string | null
          subscription_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          credits_reserved?: number
          daily_spend_limit?: number | null
          display_name?: string | null
          email?: string | null
          id?: string
          lifetime_credits_purchased?: number
          onboarding_bonus_granted?: boolean
          paystack_subscription_code?: string | null
          persona?: string | null
          plan?: string
          referred_by_code?: string | null
          subscription_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      promo_code_redemptions: {
        Row: {
          created_at: string
          id: string
          payment_reference: string | null
          promo_code_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payment_reference?: string | null
          promo_code_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payment_reference?: string | null
          promo_code_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_redemptions_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          active: boolean
          bonus_credits: number | null
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          kind: string
          max_redemptions: number | null
          note: string | null
          percent_off: number | null
          redemption_count: number
        }
        Insert: {
          active?: boolean
          bonus_credits?: number | null
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          kind: string
          max_redemptions?: number | null
          note?: string | null
          percent_off?: number | null
          redemption_count?: number
        }
        Update: {
          active?: boolean
          bonus_credits?: number | null
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          kind?: string
          max_redemptions?: number | null
          note?: string | null
          percent_off?: number | null
          redemption_count?: number
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
      rebase_events: {
        Row: {
          applied_at: string
          key: string
        }
        Insert: {
          applied_at?: string
          key: string
        }
        Update: {
          applied_at?: string
          key?: string
        }
        Relationships: []
      }
      render_jobs: {
        Row: {
          board_id: string
          created_at: string
          error: string | null
          id: string
          input_image_url: string | null
          kind: string
          model: string
          output_url: string | null
          params: Json
          prompt: string
          shot_id: string
          status: string
          updated_at: string
          user_id: string
          worker_id: string | null
        }
        Insert: {
          board_id: string
          created_at?: string
          error?: string | null
          id?: string
          input_image_url?: string | null
          kind?: string
          model: string
          output_url?: string | null
          params?: Json
          prompt: string
          shot_id: string
          status?: string
          updated_at?: string
          user_id?: string
          worker_id?: string | null
        }
        Update: {
          board_id?: string
          created_at?: string
          error?: string | null
          id?: string
          input_image_url?: string | null
          kind?: string
          model?: string
          output_url?: string | null
          params?: Json
          prompt?: string
          shot_id?: string
          status?: string
          updated_at?: string
          user_id?: string
          worker_id?: string | null
        }
        Relationships: []
      }
      scheduler_heartbeats: {
        Row: {
          last_error: string | null
          last_ok_at: string | null
          last_run_at: string | null
          name: string
          updated_at: string
        }
        Insert: {
          last_error?: string | null
          last_ok_at?: string | null
          last_run_at?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          last_error?: string | null
          last_ok_at?: string | null
          last_run_at?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          key: string
          kind: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          kind?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Update: {
          key?: string
          kind?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      site_copy: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      site_copy_history: {
        Row: {
          changed_at: string
          changed_by: string
          id: number
          key: string
          value: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: number
          key: string
          value: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: number
          key?: string
          value?: string
        }
        Relationships: []
      }
      site_images: {
        Row: {
          default_url: string
          key: string
          label: string
          section: string
          updated_at: string
          url: string
        }
        Insert: {
          default_url?: string
          key: string
          label?: string
          section?: string
          updated_at?: string
          url: string
        }
        Update: {
          default_url?: string
          key?: string
          label?: string
          section?: string
          updated_at?: string
          url?: string
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
      soul_reference_assets: {
        Row: {
          created_at: string
          id: string
          label: string | null
          soul_id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          soul_id: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          soul_id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "soul_reference_assets_soul_id_fkey"
            columns: ["soul_id"]
            isOneToOne: false
            referencedRelation: "souls"
            referencedColumns: ["id"]
          },
        ]
      }
      soul_video_jobs: {
        Row: {
          aspect_ratio: string
          created_at: string
          duration_secs: number
          error_message: string | null
          id: string
          model: string
          progress: number
          prompt: string
          provider: string
          provider_job_id: string | null
          result_url: string | null
          soul_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aspect_ratio?: string
          created_at?: string
          duration_secs?: number
          error_message?: string | null
          id?: string
          model?: string
          progress?: number
          prompt: string
          provider?: string
          provider_job_id?: string | null
          result_url?: string | null
          soul_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aspect_ratio?: string
          created_at?: string
          duration_secs?: number
          error_message?: string | null
          id?: string
          model?: string
          progress?: number
          prompt?: string
          provider?: string
          provider_job_id?: string | null
          result_url?: string | null
          soul_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "soul_video_jobs_soul_id_fkey"
            columns: ["soul_id"]
            isOneToOne: false
            referencedRelation: "souls"
            referencedColumns: ["id"]
          },
        ]
      }
      souls: {
        Row: {
          created_at: string
          description: string | null
          error_message: string | null
          fal_training_id: string | null
          id: string
          lora_url: string | null
          name: string
          progress: number
          reference_image_paths: string[]
          status: string
          training_image_paths: string[]
          trigger_word: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          error_message?: string | null
          fal_training_id?: string | null
          id?: string
          lora_url?: string | null
          name: string
          progress?: number
          reference_image_paths?: string[]
          status?: string
          training_image_paths?: string[]
          trigger_word?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          error_message?: string | null
          fal_training_id?: string | null
          id?: string
          lora_url?: string | null
          name?: string
          progress?: number
          reference_image_paths?: string[]
          status?: string
          training_image_paths?: string[]
          trigger_word?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      spin_jobs: {
        Row: {
          audio_url: string | null
          avatar_id: string | null
          created_at: string
          face_url: string | null
          id: string
          mode: string
          product_url: string | null
          prompt: string
          script: string | null
          status: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          avatar_id?: string | null
          created_at?: string
          face_url?: string | null
          id?: string
          mode?: string
          product_url?: string | null
          prompt: string
          script?: string | null
          status?: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_url?: string | null
          avatar_id?: string | null
          created_at?: string
          face_url?: string | null
          id?: string
          mode?: string
          product_url?: string | null
          prompt?: string
          script?: string | null
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
          kind: string
          label: string
          prompt: string | null
          spec: Json | null
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
          kind?: string
          label: string
          prompt?: string | null
          spec?: Json | null
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
          kind?: string
          label?: string
          prompt?: string | null
          spec?: Json | null
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
      storyboards: {
        Row: {
          concept: string
          created_at: string
          id: string
          shots: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          concept?: string
          created_at?: string
          id?: string
          shots?: Json
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          concept?: string
          created_at?: string
          id?: string
          shots?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount_minor: number | null
          created_at: string
          currency: string
          id: string
          next_payment_date: string | null
          paystack_customer_code: string | null
          paystack_email_token: string | null
          paystack_subscription_code: string
          plan_code: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_minor?: number | null
          created_at?: string
          currency?: string
          id?: string
          next_payment_date?: string | null
          paystack_customer_code?: string | null
          paystack_email_token?: string | null
          paystack_subscription_code: string
          plan_code?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_minor?: number | null
          created_at?: string
          currency?: string
          id?: string
          next_payment_date?: string | null
          paystack_customer_code?: string | null
          paystack_email_token?: string | null
          paystack_subscription_code?: string
          plan_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tiktok_accounts: {
        Row: {
          access_token: string
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          oauth_state: string | null
          oauth_state_at: string | null
          open_id: string
          refresh_expires_at: string
          refresh_token: string
          scope: string | null
          token_expires_at: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          access_token: string
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          oauth_state?: string | null
          oauth_state_at?: string | null
          open_id: string
          refresh_expires_at: string
          refresh_token: string
          scope?: string | null
          token_expires_at: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          access_token?: string
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          oauth_state?: string | null
          oauth_state_at?: string | null
          open_id?: string
          refresh_expires_at?: string
          refresh_token?: string
          scope?: string | null
          token_expires_at?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tiktok_posts: {
        Row: {
          created_at: string
          error_msg: string | null
          generation_id: string | null
          id: string
          posted_at: string | null
          publish_id: string | null
          retry_count: number
          status: string
          title: string | null
          updated_at: string
          user_id: string
          video_url: string
        }
        Insert: {
          created_at?: string
          error_msg?: string | null
          generation_id?: string | null
          id?: string
          posted_at?: string | null
          publish_id?: string | null
          retry_count?: number
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
          video_url: string
        }
        Update: {
          created_at?: string
          error_msg?: string | null
          generation_id?: string | null
          id?: string
          posted_at?: string | null
          publish_id?: string | null
          retry_count?: number
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
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
      uptime_monitor_state: {
        Row: {
          alert_sent_at: string | null
          consecutive_failures: number
          id: string
          last_check_at: string | null
          last_error: string | null
          last_ok_at: string | null
          recovery_sent_at: string | null
          updated_at: string
        }
        Insert: {
          alert_sent_at?: string | null
          consecutive_failures?: number
          id?: string
          last_check_at?: string | null
          last_error?: string | null
          last_ok_at?: string | null
          recovery_sent_at?: string | null
          updated_at?: string
        }
        Update: {
          alert_sent_at?: string | null
          consecutive_failures?: number
          id?: string
          last_check_at?: string | null
          last_error?: string | null
          last_ok_at?: string | null
          recovery_sent_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_avatar_shots: {
        Row: {
          created_at: string
          engine: string
          id: string
          kind: string
          prompt: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          engine: string
          id?: string
          kind: string
          prompt?: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          engine?: string
          id?: string
          kind?: string
          prompt?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      user_passkeys: {
        Row: {
          counter: number
          created_at: string
          credential_id: string
          device_name: string | null
          id: string
          last_used_at: string | null
          public_key: string
          transports: string[]
          user_id: string
        }
        Insert: {
          counter?: number
          created_at?: string
          credential_id: string
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          public_key: string
          transports?: string[]
          user_id: string
        }
        Update: {
          counter?: number
          created_at?: string
          credential_id?: string
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          public_key?: string
          transports?: string[]
          user_id?: string
        }
        Relationships: []
      }
      user_photo_avatars: {
        Row: {
          created_at: string
          id: string
          name: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          storage_path?: string
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
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      vast_managed_instances: {
        Row: {
          adopted: boolean
          created_at: string
          created_by: string
          destroy_deadline: string
          destroyed_at: string | null
          endpoint_url: string | null
          failure_reason: string | null
          gpu_name: string | null
          hourly_usd: number
          id: string
          label: string
          state: string
          updated_at: string
          vast_instance_id: number
          worker_id: string | null
        }
        Insert: {
          adopted?: boolean
          created_at?: string
          created_by: string
          destroy_deadline: string
          destroyed_at?: string | null
          endpoint_url?: string | null
          failure_reason?: string | null
          gpu_name?: string | null
          hourly_usd: number
          id?: string
          label?: string
          state?: string
          updated_at?: string
          vast_instance_id: number
          worker_id?: string | null
        }
        Update: {
          adopted?: boolean
          created_at?: string
          created_by?: string
          destroy_deadline?: string
          destroyed_at?: string | null
          endpoint_url?: string | null
          failure_reason?: string | null
          gpu_name?: string | null
          hourly_usd?: number
          id?: string
          label?: string
          state?: string
          updated_at?: string
          vast_instance_id?: number
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vast_managed_instances_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "gpu_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      video_agent_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      video_agent_projects: {
        Row: {
          created_at: string
          error: string | null
          export_url: string | null
          generation_id: string | null
          id: string
          job_id: string | null
          prompt: string
          scenes: Json
          status: string
          status_message: string
          style: string
          target_duration: number
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
          voice: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          export_url?: string | null
          generation_id?: string | null
          id?: string
          job_id?: string | null
          prompt: string
          scenes?: Json
          status?: string
          status_message?: string
          style?: string
          target_duration?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id: string
          voice?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          export_url?: string | null
          generation_id?: string | null
          id?: string
          job_id?: string | null
          prompt?: string
          scenes?: Json
          status?: string
          status_message?: string
          style?: string
          target_duration?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          voice?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_agent_projects_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_agent_projects_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      video_agent_submissions: {
        Row: {
          cost: number
          created_at: string
          finalized_at: string | null
          generation_id: string | null
          orientation: string
          prompt: string
          reservation_ref: string
          user_id: string
          video_id: string
        }
        Insert: {
          cost: number
          created_at?: string
          finalized_at?: string | null
          generation_id?: string | null
          orientation?: string
          prompt: string
          reservation_ref: string
          user_id: string
          video_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          finalized_at?: string | null
          generation_id?: string | null
          orientation?: string
          prompt?: string
          reservation_ref?: string
          user_id?: string
          video_id?: string
        }
        Relationships: []
      }
      wardrobe_items: {
        Row: {
          created_at: string
          id: string
          label: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      webauthn_challenges: {
        Row: {
          challenge: string
          expires_at: string
          id: string
          used: boolean
          user_id: string | null
        }
        Insert: {
          challenge: string
          expires_at?: string
          id?: string
          used?: boolean
          user_id?: string | null
        }
        Update: {
          challenge?: string
          expires_at?: string
          id?: string
          used?: boolean
          user_id?: string | null
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
      worker_register_attempts: {
        Row: {
          created_at: string
          endpoint_url: string | null
          error: string | null
          id: string
          name: string | null
          ok: boolean
          outcome: string | null
          protocol: string | null
        }
        Insert: {
          created_at?: string
          endpoint_url?: string | null
          error?: string | null
          id?: string
          name?: string | null
          ok: boolean
          outcome?: string | null
          protocol?: string | null
        }
        Update: {
          created_at?: string
          endpoint_url?: string | null
          error?: string | null
          id?: string
          name?: string | null
          ok?: boolean
          outcome?: string | null
          protocol?: string | null
        }
        Relationships: []
      }
      workflows: {
        Row: {
          created_at: string
          description: string | null
          graph: Json
          id: string
          is_public: boolean
          last_output_kind: string | null
          last_output_url: string | null
          name: string
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          graph?: Json
          id?: string
          is_public?: boolean
          last_output_kind?: string | null
          last_output_url?: string | null
          name: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          graph?: Json
          id?: string
          is_public?: boolean
          last_output_kind?: string | null
          last_output_url?: string | null
          name?: string
          thumbnail_url?: string | null
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
      activate_pro_subscription: {
        Args: { _expires_at: string; _sub_code: string; _user: string }
        Returns: undefined
      }
      claim_next_job: {
        Args: { _worker: string }
        Returns: {
          attempts: number
          created_at: string
          credits_reserved: number
          credits_settled_at: string | null
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
          progress_pct: number | null
          progress_stage: string | null
          progress_updated_at: string | null
          queue: string
          result: Json | null
          scheduled_at: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_next_job_v2: {
        Args: { _lanes: string[]; _worker: string }
        Returns: {
          attempts: number
          created_at: string
          credits_reserved: number
          credits_settled_at: string | null
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
          progress_pct: number | null
          progress_stage: string | null
          progress_updated_at: string | null
          queue: string
          result: Json | null
          scheduled_at: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_onboarding_bonus: {
        Args: { _amount: number; _user: string }
        Returns: boolean
      }
      claim_tiktok_retry: {
        Args: {
          p_cooldown_ms: number
          p_max_attempts: number
          p_post_id: string
          p_user_id: string
        }
        Returns: {
          created_at: string
          error_msg: string | null
          generation_id: string | null
          id: string
          posted_at: string | null
          publish_id: string | null
          retry_count: number
          status: string
          title: string | null
          updated_at: string
          user_id: string
          video_url: string
        }[]
        SetofOptions: {
          from: "*"
          to: "tiktok_posts"
          isOneToOne: false
          isSetofReturn: true
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
      deactivate_pro_subscription: {
        Args: { _user: string }
        Returns: undefined
      }
      deduct_credits: {
        Args: { _amount: number; _reason: string; _ref: string; _user: string }
        Returns: boolean
      }
      finalize_job: {
        Args: {
          _error: string
          _job: string
          _model: string
          _outcome: string
          _result: Json
          _result_image_url: string
          _result_video_url: string
          _worker: string
        }
        Returns: string
      }
      finalize_marketplace_run: {
        Args: {
          _amount: number
          _aura_charged: number
          _creator_cut_aura: number
          _creator_ref: string
          _creator_user_id: string
          _platform_cut_aura: number
          _reason: string
          _ref: string
          _runner_user_id: string
          _template_id: string
        }
        Returns: undefined
      }
      finalize_sync_render: {
        Args: {
          _agent_shot_id: string
          _amount: number
          _audio_url: string
          _credits_cost: number
          _input_images: Json
          _kind: string
          _mode: string
          _model: string
          _prompt: string
          _reason: string
          _ref: string
          _result_image_url: string
          _result_text: string
          _result_video_url: string
          _session_id: string
          _user_id: string
        }
        Returns: string
      }
      get_daily_spend: {
        Args: { _day_start: string; _user: string }
        Returns: number
      }
      gpu_worker_inflight_dec: { Args: { _worker: string }; Returns: number }
      gpu_worker_inflight_inc: { Args: { _worker: string }; Returns: number }
      grant_credits:
        | {
            Args: {
              _amount: number
              _reason: string
              _ref: string
              _user: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _actor?: string
              _amount: number
              _reason: string
              _ref: string
              _user: string
            }
            Returns: undefined
          }
      grant_free_daily_aura_all: { Args: { _day?: string }; Returns: number }
      grant_free_monthly_aura_all: {
        Args: { _month?: string }
        Returns: number
      }
      grant_monthly_aura: {
        Args: { _amount: number; _ref: string; _user: string }
        Returns: boolean
      }
      grant_pro_access: {
        Args: { _days: number; _source_ref: string; _user: string }
        Returns: boolean
      }
      has_active_pro_access: { Args: { _user: string }; Returns: boolean }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _user: string }
        Returns: boolean
      }
      reconcile_expired_pro_access: { Args: never; Returns: number }
      reconcile_stuck_reservation: { Args: { _job: string }; Returns: string }
      redeem_gift_card: {
        Args: { _code: string; _user: string }
        Returns: {
          credits: number
          design: string
          kind: string
          pro_days: number
        }[]
      }
      release_reservation: {
        Args: { _amount: number; _reason: string; _ref: string; _user: string }
        Returns: undefined
      }
      requeue_failed_job: {
        Args: { _backoff_seconds: number; _job: string }
        Returns: string
      }
      reserve_credits: {
        Args: { _amount: number; _reason: string; _ref: string; _user: string }
        Returns: boolean
      }
      reset_stale_processing_jobs: {
        Args: {
          _backoff_seconds: number
          _give_up_age_seconds?: number
          _give_up_attempts?: number
          _max_age_seconds: number
        }
        Returns: number
      }
      reset_stale_processing_jobs_for_kinds: {
        Args: {
          _backoff_seconds: number
          _give_up_age_seconds?: number
          _give_up_attempts?: number
          _kinds: string[]
          _max_age_seconds: number
        }
        Returns: number
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

