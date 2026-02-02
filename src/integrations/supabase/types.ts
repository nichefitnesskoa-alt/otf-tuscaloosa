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
      intros_booked: {
        Row: {
          class_date: string
          coach_name: string
          created_at: string
          fitness_goal: string | null
          id: string
          lead_source: string
          linked_ig_lead_id: string | null
          member_name: string
          sa_working_shift: string
          shift_recap_id: string | null
        }
        Insert: {
          class_date: string
          coach_name: string
          created_at?: string
          fitness_goal?: string | null
          id?: string
          lead_source: string
          linked_ig_lead_id?: string | null
          member_name: string
          sa_working_shift: string
          shift_recap_id?: string | null
        }
        Update: {
          class_date?: string
          coach_name?: string
          created_at?: string
          fitness_goal?: string | null
          id?: string
          lead_source?: string
          linked_ig_lead_id?: string | null
          member_name?: string
          sa_working_shift?: string
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
          claimed_by_ig_lead_id: string | null
          class_time: string
          commission_amount: number | null
          created_at: string
          id: string
          is_self_gen: boolean | null
          lead_measures: string[] | null
          member_name: string
          notes: string | null
          process_checklist: string[] | null
          result: string
          shift_recap_id: string | null
        }
        Insert: {
          booking_source?: string | null
          claimed_by_ig_lead_id?: string | null
          class_time: string
          commission_amount?: number | null
          created_at?: string
          id?: string
          is_self_gen?: boolean | null
          lead_measures?: string[] | null
          member_name: string
          notes?: string | null
          process_checklist?: string[] | null
          result: string
          shift_recap_id?: string | null
        }
        Update: {
          booking_source?: string | null
          claimed_by_ig_lead_id?: string | null
          class_time?: string
          commission_amount?: number | null
          created_at?: string
          id?: string
          is_self_gen?: boolean | null
          lead_measures?: string[] | null
          member_name?: string
          notes?: string | null
          process_checklist?: string[] | null
          result?: string
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
            foreignKeyName: "intros_run_shift_recap_id_fkey"
            columns: ["shift_recap_id"]
            isOneToOne: false
            referencedRelation: "shift_recaps"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_outside_intro: {
        Row: {
          commission_amount: number | null
          created_at: string
          id: string
          lead_source: string
          member_name: string
          membership_type: string
          shift_recap_id: string | null
        }
        Insert: {
          commission_amount?: number | null
          created_at?: string
          id?: string
          lead_source: string
          member_name: string
          membership_type: string
          shift_recap_id?: string | null
        }
        Update: {
          commission_amount?: number | null
          created_at?: string
          id?: string
          lead_source?: string
          member_name?: string
          membership_type?: string
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
          emails_sent: number | null
          equipment_issues: string | null
          freeze_details: string | null
          freezes: number | null
          id: string
          milestones_celebrated: string | null
          otbeat_buyer_names: string | null
          otbeat_sales: number | null
          other_info: string | null
          shift_date: string
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
          emails_sent?: number | null
          equipment_issues?: string | null
          freeze_details?: string | null
          freezes?: number | null
          id?: string
          milestones_celebrated?: string | null
          otbeat_buyer_names?: string | null
          otbeat_sales?: number | null
          other_info?: string | null
          shift_date: string
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
          emails_sent?: number | null
          equipment_issues?: string | null
          freeze_details?: string | null
          freezes?: number | null
          id?: string
          milestones_celebrated?: string | null
          otbeat_buyer_names?: string | null
          otbeat_sales?: number | null
          other_info?: string | null
          shift_date?: string
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
          id: string
          name: string
          role: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          role: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          role?: string
        }
        Relationships: []
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
