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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      daily_recaps: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          recap_text: string
          shift_date: string
          shift_recap_id: string | null
          staff_name: string
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          recap_text: string
          shift_date: string
          shift_recap_id?: string | null
          staff_name: string
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          recap_text?: string
          shift_date?: string
          shift_recap_id?: string | null
          staff_name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_recaps_shift_recap_id_fkey"
            columns: ["shift_recap_id"]
            isOneToOne: false
            referencedRelation: "shift_recaps"
            referencedColumns: ["id"]
          },
        ]
      }
      ig_leads: {
        Row: {
          created_at: string
          date_added: string
          email: string | null
          first_name: string
          id: string
          instagram_handle: string
          interest_level: string
          last_name: string | null
          notes: string | null
          phone_number: string | null
          sa_name: string
          status: string
          synced_to_sheets: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_added?: string
          email?: string | null
          first_name: string
          id?: string
          instagram_handle: string
          interest_level: string
          last_name?: string | null
          notes?: string | null
          phone_number?: string | null
          sa_name: string
          status?: string
          synced_to_sheets?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_added?: string
          email?: string | null
          first_name?: string
          id?: string
          instagram_handle?: string
          interest_level?: string
          last_name?: string | null
          notes?: string | null
          phone_number?: string | null
          sa_name?: string
          status?: string
          synced_to_sheets?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      intake_events: {
        Row: {
          booking_id: string | null
          external_id: string
          id: string
          lead_id: string | null
          payload: Json | null
          received_at: string
          source: string
        }
        Insert: {
          booking_id?: string | null
          external_id: string
          id?: string
          lead_id?: string | null
          payload?: Json | null
          received_at?: string
          source?: string
        }
        Update: {
          booking_id?: string | null
          external_id?: string
          id?: string
          lead_id?: string | null
          payload?: Json | null
          received_at?: string
          source?: string
        }
        Relationships: []
      }
      intro_questionnaires: {
        Row: {
          booking_id: string | null
          client_first_name: string
          client_last_name: string
          created_at: string
          id: string
          q1_fitness_goal: string | null
          q2_fitness_level: number | null
          q3_obstacle: string | null
          q4_past_experience: string | null
          q5_emotional_driver: string | null
          q6_weekly_commitment: string | null
          q6b_available_days: string | null
          q7_coach_notes: string | null
          scheduled_class_date: string
          scheduled_class_time: string | null
          slug: string | null
          status: string
          submitted_at: string | null
        }
        Insert: {
          booking_id?: string | null
          client_first_name: string
          client_last_name?: string
          created_at?: string
          id?: string
          q1_fitness_goal?: string | null
          q2_fitness_level?: number | null
          q3_obstacle?: string | null
          q4_past_experience?: string | null
          q5_emotional_driver?: string | null
          q6_weekly_commitment?: string | null
          q6b_available_days?: string | null
          q7_coach_notes?: string | null
          scheduled_class_date: string
          scheduled_class_time?: string | null
          slug?: string | null
          status?: string
          submitted_at?: string | null
        }
        Update: {
          booking_id?: string | null
          client_first_name?: string
          client_last_name?: string
          created_at?: string
          id?: string
          q1_fitness_goal?: string | null
          q2_fitness_level?: number | null
          q3_obstacle?: string | null
          q4_past_experience?: string | null
          q5_emotional_driver?: string | null
          q6_weekly_commitment?: string | null
          q6b_available_days?: string | null
          q7_coach_notes?: string | null
          scheduled_class_date?: string
          scheduled_class_time?: string | null
          slug?: string | null
          status?: string
          submitted_at?: string | null
        }
        Relationships: []
      }
      intros_booked: {
        Row: {
          booked_by: string | null
          booking_id: string | null
          booking_status: string | null
          class_date: string
          closed_at: string | null
          closed_by: string | null
          coach_name: string
          created_at: string
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          edit_reason: string | null
          fitness_goal: string | null
          id: string
          ignore_from_metrics: boolean | null
          intro_owner: string | null
          intro_owner_locked: boolean | null
          intro_time: string | null
          last_edited_at: string | null
          last_edited_by: string | null
          lead_source: string
          linked_ig_lead_id: string | null
          member_name: string
          originating_booking_id: string | null
          paired_booking_id: string | null
          sa_working_shift: string
          sheets_row_number: number | null
          shift_recap_id: string | null
        }
        Insert: {
          booked_by?: string | null
          booking_id?: string | null
          booking_status?: string | null
          class_date: string
          closed_at?: string | null
          closed_by?: string | null
          coach_name: string
          created_at?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          edit_reason?: string | null
          fitness_goal?: string | null
          id?: string
          ignore_from_metrics?: boolean | null
          intro_owner?: string | null
          intro_owner_locked?: boolean | null
          intro_time?: string | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          lead_source: string
          linked_ig_lead_id?: string | null
          member_name: string
          originating_booking_id?: string | null
          paired_booking_id?: string | null
          sa_working_shift: string
          sheets_row_number?: number | null
          shift_recap_id?: string | null
        }
        Update: {
          booked_by?: string | null
          booking_id?: string | null
          booking_status?: string | null
          class_date?: string
          closed_at?: string | null
          closed_by?: string | null
          coach_name?: string
          created_at?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          edit_reason?: string | null
          fitness_goal?: string | null
          id?: string
          ignore_from_metrics?: boolean | null
          intro_owner?: string | null
          intro_owner_locked?: boolean | null
          intro_time?: string | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          lead_source?: string
          linked_ig_lead_id?: string | null
          member_name?: string
          originating_booking_id?: string | null
          paired_booking_id?: string | null
          sa_working_shift?: string
          sheets_row_number?: number | null
          shift_recap_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intros_booked_linked_ig_lead_id_fkey"
            columns: ["linked_ig_lead_id"]
            isOneToOne: false
            referencedRelation: "ig_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intros_booked_originating_booking_id_fkey"
            columns: ["originating_booking_id"]
            isOneToOne: false
            referencedRelation: "intros_booked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intros_booked_paired_booking_id_fkey"
            columns: ["paired_booking_id"]
            isOneToOne: false
            referencedRelation: "intros_booked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intros_booked_shift_recap_id_fkey"
            columns: ["shift_recap_id"]
            isOneToOne: false
            referencedRelation: "shift_recaps"
            referencedColumns: ["id"]
          },
        ]
      }
      intros_run: {
        Row: {
          booking_source: string | null
          buy_date: string | null
          choice_architecture: boolean | null
          claimed_by_ig_lead_id: string | null
          class_time: string
          coach_name: string | null
          coaching_summary_presence: boolean | null
          commission_amount: number | null
          created_at: string
          edit_reason: string | null
          fvc_completed: boolean | null
          goal_quality: string | null
          goal_why_captured: string | null
          halfway_encouragement: boolean | null
          id: string
          ignore_from_metrics: boolean | null
          intro_owner: string | null
          intro_owner_locked: boolean | null
          is_self_gen: boolean | null
          last_edited_at: string | null
          last_edited_by: string | null
          lead_measures: string[] | null
          lead_source: string | null
          linked_intro_booked_id: string | null
          made_a_friend: boolean | null
          member_name: string
          notes: string | null
          premobility_encouragement: boolean | null
          pricing_engagement: string | null
          process_checklist: string[] | null
          ran_by: string | null
          relationship_experience: string | null
          result: string
          rfg_presented: boolean | null
          run_date: string | null
          run_id: string | null
          sa_name: string | null
          sheets_row_number: number | null
          shift_recap_id: string | null
        }
        Insert: {
          booking_source?: string | null
          buy_date?: string | null
          choice_architecture?: boolean | null
          claimed_by_ig_lead_id?: string | null
          class_time: string
          coach_name?: string | null
          coaching_summary_presence?: boolean | null
          commission_amount?: number | null
          created_at?: string
          edit_reason?: string | null
          fvc_completed?: boolean | null
          goal_quality?: string | null
          goal_why_captured?: string | null
          halfway_encouragement?: boolean | null
          id?: string
          ignore_from_metrics?: boolean | null
          intro_owner?: string | null
          intro_owner_locked?: boolean | null
          is_self_gen?: boolean | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          lead_measures?: string[] | null
          lead_source?: string | null
          linked_intro_booked_id?: string | null
          made_a_friend?: boolean | null
          member_name: string
          notes?: string | null
          premobility_encouragement?: boolean | null
          pricing_engagement?: string | null
          process_checklist?: string[] | null
          ran_by?: string | null
          relationship_experience?: string | null
          result: string
          rfg_presented?: boolean | null
          run_date?: string | null
          run_id?: string | null
          sa_name?: string | null
          sheets_row_number?: number | null
          shift_recap_id?: string | null
        }
        Update: {
          booking_source?: string | null
          buy_date?: string | null
          choice_architecture?: boolean | null
          claimed_by_ig_lead_id?: string | null
          class_time?: string
          coach_name?: string | null
          coaching_summary_presence?: boolean | null
          commission_amount?: number | null
          created_at?: string
          edit_reason?: string | null
          fvc_completed?: boolean | null
          goal_quality?: string | null
          goal_why_captured?: string | null
          halfway_encouragement?: boolean | null
          id?: string
          ignore_from_metrics?: boolean | null
          intro_owner?: string | null
          intro_owner_locked?: boolean | null
          is_self_gen?: boolean | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          lead_measures?: string[] | null
          lead_source?: string | null
          linked_intro_booked_id?: string | null
          made_a_friend?: boolean | null
          member_name?: string
          notes?: string | null
          premobility_encouragement?: boolean | null
          pricing_engagement?: string | null
          process_checklist?: string[] | null
          ran_by?: string | null
          relationship_experience?: string | null
          result?: string
          rfg_presented?: boolean | null
          run_date?: string | null
          run_id?: string | null
          sa_name?: string | null
          sheets_row_number?: number | null
          shift_recap_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intros_run_claimed_by_ig_lead_id_fkey"
            columns: ["claimed_by_ig_lead_id"]
            isOneToOne: false
            referencedRelation: "ig_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intros_run_linked_intro_booked_id_fkey"
            columns: ["linked_intro_booked_id"]
            isOneToOne: false
            referencedRelation: "intros_booked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intros_run_shift_recap_id_fkey"
            columns: ["shift_recap_id"]
            isOneToOne: false
            referencedRelation: "shift_recaps"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          activity_type: string
          created_at: string
          id: string
          lead_id: string
          notes: string | null
          performed_by: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          id?: string
          lead_id: string
          notes?: string | null
          performed_by: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          id?: string
          lead_id?: string
          notes?: string | null
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          booked_intro_id: string | null
          created_at: string
          email: string | null
          first_name: string
          follow_up_at: string | null
          id: string
          last_name: string
          lost_reason: string | null
          phone: string
          source: string
          stage: string
          updated_at: string
        }
        Insert: {
          booked_intro_id?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          follow_up_at?: string | null
          id?: string
          last_name: string
          lost_reason?: string | null
          phone: string
          source?: string
          stage?: string
          updated_at?: string
        }
        Update: {
          booked_intro_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          follow_up_at?: string | null
          id?: string
          last_name?: string
          lost_reason?: string | null
          phone?: string
          source?: string
          stage?: string
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          discount_applied: boolean
          id: string
          referred_booking_id: string | null
          referred_name: string
          referrer_booking_id: string | null
          referrer_name: string
        }
        Insert: {
          created_at?: string
          discount_applied?: boolean
          id?: string
          referred_booking_id?: string | null
          referred_name: string
          referrer_booking_id?: string | null
          referrer_name: string
        }
        Update: {
          created_at?: string
          discount_applied?: boolean
          id?: string
          referred_booking_id?: string | null
          referred_name?: string
          referrer_booking_id?: string | null
          referrer_name?: string
        }
        Relationships: []
      }
      sales_outside_intro: {
        Row: {
          commission_amount: number | null
          created_at: string
          date_closed: string | null
          edit_reason: string | null
          id: string
          intro_owner: string | null
          last_edited_at: string | null
          last_edited_by: string | null
          lead_source: string
          member_name: string
          membership_type: string
          pay_period_end: string | null
          pay_period_start: string | null
          sale_id: string | null
          sale_type: string | null
          sheets_row_number: number | null
          shift_recap_id: string | null
        }
        Insert: {
          commission_amount?: number | null
          created_at?: string
          date_closed?: string | null
          edit_reason?: string | null
          id?: string
          intro_owner?: string | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          lead_source: string
          member_name: string
          membership_type: string
          pay_period_end?: string | null
          pay_period_start?: string | null
          sale_id?: string | null
          sale_type?: string | null
          sheets_row_number?: number | null
          shift_recap_id?: string | null
        }
        Update: {
          commission_amount?: number | null
          created_at?: string
          date_closed?: string | null
          edit_reason?: string | null
          id?: string
          intro_owner?: string | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          lead_source?: string
          member_name?: string
          membership_type?: string
          pay_period_end?: string | null
          pay_period_start?: string | null
          sale_id?: string | null
          sale_type?: string | null
          sheets_row_number?: number | null
          shift_recap_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_outside_intro_shift_recap_id_fkey"
            columns: ["shift_recap_id"]
            isOneToOne: false
            referencedRelation: "shift_recaps"
            referencedColumns: ["id"]
          },
        ]
      }
      script_send_log: {
        Row: {
          booking_id: string | null
          id: string
          lead_id: string | null
          message_body_sent: string
          sent_at: string
          sent_by: string
          sequence_step_number: number | null
          template_id: string
        }
        Insert: {
          booking_id?: string | null
          id?: string
          lead_id?: string | null
          message_body_sent: string
          sent_at?: string
          sent_by: string
          sequence_step_number?: number | null
          template_id: string
        }
        Update: {
          booking_id?: string | null
          id?: string
          lead_id?: string | null
          message_body_sent?: string
          sent_at?: string
          sent_by?: string
          sequence_step_number?: number | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_send_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "intros_booked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_send_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_send_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "script_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      script_templates: {
        Row: {
          body: string
          category: string
          channel: string
          created_at: string
          id: string
          is_active: boolean
          is_shared_step: boolean
          name: string
          sequence_order: number | null
          shared_step_id: string | null
          timing_note: string | null
          updated_at: string
          variant_label: string | null
        }
        Insert: {
          body?: string
          category: string
          channel?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_shared_step?: boolean
          name: string
          sequence_order?: number | null
          shared_step_id?: string | null
          timing_note?: string | null
          updated_at?: string
          variant_label?: string | null
        }
        Update: {
          body?: string
          category?: string
          channel?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_shared_step?: boolean
          name?: string
          sequence_order?: number | null
          shared_step_id?: string | null
          timing_note?: string | null
          updated_at?: string
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "script_templates_shared_step_id_fkey"
            columns: ["shared_step_id"]
            isOneToOne: false
            referencedRelation: "script_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sheets_sync_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          records_synced: number | null
          status: string
          sync_type: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          records_synced?: number | null
          status: string
          sync_type: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          records_synced?: number | null
          status?: string
          sync_type?: string
        }
        Relationships: []
      }
      shift_recaps: {
        Row: {
          calls_made: number | null
          cancellation_details: string | null
          cancellations: number | null
          created_at: string
          dms_sent: number | null
          downgrade_details: string | null
          downgrades: number | null
          edit_reason: string | null
          emails_sent: number | null
          equipment_issues: string | null
          freeze_details: string | null
          freezes: number | null
          id: string
          last_edited_at: string | null
          last_edited_by: string | null
          milestones_celebrated: string | null
          otbeat_buyer_names: string | null
          otbeat_sales: number | null
          other_info: string | null
          sheets_row_number: number | null
          shift_date: string
          shift_id: string | null
          shift_type: string
          staff_name: string
          submitted_at: string | null
          synced_to_sheets: boolean | null
          texts_sent: number | null
          upgrade_details: string | null
          upgrades: number | null
        }
        Insert: {
          calls_made?: number | null
          cancellation_details?: string | null
          cancellations?: number | null
          created_at?: string
          dms_sent?: number | null
          downgrade_details?: string | null
          downgrades?: number | null
          edit_reason?: string | null
          emails_sent?: number | null
          equipment_issues?: string | null
          freeze_details?: string | null
          freezes?: number | null
          id?: string
          last_edited_at?: string | null
          last_edited_by?: string | null
          milestones_celebrated?: string | null
          otbeat_buyer_names?: string | null
          otbeat_sales?: number | null
          other_info?: string | null
          sheets_row_number?: number | null
          shift_date: string
          shift_id?: string | null
          shift_type: string
          staff_name: string
          submitted_at?: string | null
          synced_to_sheets?: boolean | null
          texts_sent?: number | null
          upgrade_details?: string | null
          upgrades?: number | null
        }
        Update: {
          calls_made?: number | null
          cancellation_details?: string | null
          cancellations?: number | null
          created_at?: string
          dms_sent?: number | null
          downgrade_details?: string | null
          downgrades?: number | null
          edit_reason?: string | null
          emails_sent?: number | null
          equipment_issues?: string | null
          freeze_details?: string | null
          freezes?: number | null
          id?: string
          last_edited_at?: string | null
          last_edited_by?: string | null
          milestones_celebrated?: string | null
          otbeat_buyer_names?: string | null
          otbeat_sales?: number | null
          other_info?: string | null
          sheets_row_number?: number | null
          shift_date?: string
          shift_id?: string | null
          shift_type?: string
          staff_name?: string
          submitted_at?: string | null
          synced_to_sheets?: boolean | null
          texts_sent?: number | null
          upgrade_details?: string | null
          upgrades?: number | null
        }
        Relationships: []
      }
      staff: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          role: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          role?: string
          user_id?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_staff_name: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "coach" | "sa"
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
      app_role: ["admin", "coach", "sa"],
    },
  },
} as const
