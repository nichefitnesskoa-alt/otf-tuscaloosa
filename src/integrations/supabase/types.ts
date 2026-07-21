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
      amc_log: {
        Row: {
          amc_value: number
          created_at: string
          created_by: string | null
          id: string
          logged_date: string
          note: string | null
        }
        Insert: {
          amc_value: number
          created_at?: string
          created_by?: string | null
          id?: string
          logged_date: string
          note?: string | null
        }
        Update: {
          amc_value?: number
          created_at?: string
          created_by?: string | null
          id?: string
          logged_date?: string
          note?: string | null
        }
        Relationships: []
      }
      archived_first_timer_lead_measures_legacy: {
        Row: {
          archive_reason: string
          archived_at: string
          booking_id: string | null
          class_date: string | null
          coach_brief_why_moment: string | null
          coach_member_pair_plan: string | null
          coach_name: string | null
          coach_shoutout_end: boolean | null
          coach_shoutout_start: boolean | null
          goal_why_captured: string | null
          id: string
          made_a_friend: boolean | null
          member_name: string | null
          original_booking_created_at: string | null
          original_run_created_at: string | null
          relationship_experience: string | null
          run_id: string | null
          shoutout_consent: boolean | null
        }
        Insert: {
          archive_reason?: string
          archived_at?: string
          booking_id?: string | null
          class_date?: string | null
          coach_brief_why_moment?: string | null
          coach_member_pair_plan?: string | null
          coach_name?: string | null
          coach_shoutout_end?: boolean | null
          coach_shoutout_start?: boolean | null
          goal_why_captured?: string | null
          id?: string
          made_a_friend?: boolean | null
          member_name?: string | null
          original_booking_created_at?: string | null
          original_run_created_at?: string | null
          relationship_experience?: string | null
          run_id?: string | null
          shoutout_consent?: boolean | null
        }
        Update: {
          archive_reason?: string
          archived_at?: string
          booking_id?: string | null
          class_date?: string | null
          coach_brief_why_moment?: string | null
          coach_member_pair_plan?: string | null
          coach_name?: string | null
          coach_shoutout_end?: boolean | null
          coach_shoutout_start?: boolean | null
          goal_why_captured?: string | null
          id?: string
          made_a_friend?: boolean | null
          member_name?: string | null
          original_booking_created_at?: string | null
          original_run_created_at?: string | null
          relationship_experience?: string | null
          run_id?: string | null
          shoutout_consent?: boolean | null
        }
        Relationships: []
      }
      bingo_players: {
        Row: {
          bingo_count: number
          blackout_completed_at: string | null
          completed_lines: string[]
          created_at: string
          email: string
          first_bingo_at: string | null
          first_name: string
          id: string
          last_name: string
          late_cancel_used: boolean
          marked_squares: string[]
          phone: string
          phone_normalized: string
          share_slug: string
          updated_at: string
        }
        Insert: {
          bingo_count?: number
          blackout_completed_at?: string | null
          completed_lines?: string[]
          created_at?: string
          email: string
          first_bingo_at?: string | null
          first_name: string
          id?: string
          last_name: string
          late_cancel_used?: boolean
          marked_squares?: string[]
          phone: string
          phone_normalized: string
          share_slug: string
          updated_at?: string
        }
        Update: {
          bingo_count?: number
          blackout_completed_at?: string | null
          completed_lines?: string[]
          created_at?: string
          email?: string
          first_bingo_at?: string | null
          first_name?: string
          id?: string
          last_name?: string
          late_cancel_used?: boolean
          marked_squares?: string[]
          phone?: string
          phone_normalized?: string
          share_slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_partners: {
        Row: {
          contact_info: string | null
          contact_name: string | null
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          contact_info?: string | null
          contact_name?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          contact_info?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      campaign_sends: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          send_log_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          send_log_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          send_log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_sends_send_log_id_fkey"
            columns: ["send_log_id"]
            isOneToOne: false
            referencedRelation: "script_send_log"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          name: string
          offer_description: string | null
          start_date: string
          target_audience: string | null
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          offer_description?: string | null
          start_date: string
          target_audience?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          offer_description?: string | null
          start_date?: string
          target_audience?: string | null
        }
        Relationships: []
      }
      candidate_history: {
        Row: {
          action: string
          candidate_id: string
          created_at: string
          id: string
          performed_by: string
        }
        Insert: {
          action: string
          candidate_id: string
          created_at?: string
          id?: string
          performed_by: string
        }
        Update: {
          action?: string
          candidate_id?: string
          created_at?: string
          id?: string
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_history_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_interviews: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          interviewed_at: string | null
          interviewed_by: string | null
          overall_notes: string | null
          overall_score: number | null
          q1_answer: string | null
          q1_score: number | null
          q2_answer: string | null
          q2_score: number | null
          q3_answer: string | null
          q3_score: number | null
          q4_answer: string | null
          q4_score: number | null
          question_set_type: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          interviewed_at?: string | null
          interviewed_by?: string | null
          overall_notes?: string | null
          overall_score?: number | null
          q1_answer?: string | null
          q1_score?: number | null
          q2_answer?: string | null
          q2_score?: number | null
          q3_answer?: string | null
          q3_score?: number | null
          q4_answer?: string | null
          q4_score?: number | null
          question_set_type?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          interviewed_at?: string | null
          interviewed_by?: string | null
          overall_notes?: string | null
          overall_score?: number | null
          q1_answer?: string | null
          q1_score?: number | null
          q2_answer?: string | null
          q2_score?: number | null
          q3_answer?: string | null
          q3_score?: number | null
          q4_answer?: string | null
          q4_score?: number | null
          question_set_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          application_notes: string | null
          application_slug: string | null
          application_submitted_at: string | null
          application_token: string | null
          availability_schedule: Json | null
          belonging_essay: string | null
          created_at: string
          decision: string | null
          decision_date: string | null
          email: string | null
          employment_type: string | null
          full_name: string
          future_resume: string | null
          hours_per_week: number | null
          id: string
          phone: string | null
          role: string[]
          stage: string
          three_step_complete: boolean
          token_expires_at: string | null
          video_url: string | null
        }
        Insert: {
          application_notes?: string | null
          application_slug?: string | null
          application_submitted_at?: string | null
          application_token?: string | null
          availability_schedule?: Json | null
          belonging_essay?: string | null
          created_at?: string
          decision?: string | null
          decision_date?: string | null
          email?: string | null
          employment_type?: string | null
          full_name: string
          future_resume?: string | null
          hours_per_week?: number | null
          id?: string
          phone?: string | null
          role?: string[]
          stage?: string
          three_step_complete?: boolean
          token_expires_at?: string | null
          video_url?: string | null
        }
        Update: {
          application_notes?: string | null
          application_slug?: string | null
          application_submitted_at?: string | null
          application_token?: string | null
          availability_schedule?: Json | null
          belonging_essay?: string | null
          created_at?: string
          decision?: string | null
          decision_date?: string | null
          email?: string | null
          employment_type?: string | null
          full_name?: string
          future_resume?: string | null
          hours_per_week?: number | null
          id?: string
          phone?: string | null
          role?: string[]
          stage?: string
          three_step_complete?: boolean
          token_expires_at?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      changelog: {
        Row: {
          changes: Json
          id: string
          is_active: boolean
          published_at: string
          title: string
          version: string
        }
        Insert: {
          changes?: Json
          id?: string
          is_active?: boolean
          published_at?: string
          title: string
          version: string
        }
        Update: {
          changes?: Json
          id?: string
          is_active?: boolean
          published_at?: string
          title?: string
          version?: string
        }
        Relationships: []
      }
      changelog_seen: {
        Row: {
          changelog_id: string
          id: string
          seen_at: string
          user_name: string
        }
        Insert: {
          changelog_id: string
          id?: string
          seen_at?: string
          user_name: string
        }
        Update: {
          changelog_id?: string
          id?: string
          seen_at?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "changelog_seen_changelog_id_fkey"
            columns: ["changelog_id"]
            isOneToOne: false
            referencedRelation: "changelog"
            referencedColumns: ["id"]
          },
        ]
      }
      churn_log: {
        Row: {
          churn_count: number
          created_at: string
          created_by: string | null
          effective_date: string
          id: string
          note: string | null
        }
        Insert: {
          churn_count: number
          created_at?: string
          created_by?: string | null
          effective_date: string
          id?: string
          note?: string | null
        }
        Update: {
          churn_count?: number
          created_at?: string
          created_by?: string | null
          effective_date?: string
          id?: string
          note?: string | null
        }
        Relationships: []
      }
      class_milestone_checks: {
        Row: {
          checked_at: string
          checked_by: string
          class_date: string
          class_time: string
          created_at: string
          id: string
          unchecked_at: string | null
          unchecked_by: string | null
        }
        Insert: {
          checked_at?: string
          checked_by: string
          class_date: string
          class_time: string
          created_at?: string
          id?: string
          unchecked_at?: string | null
          unchecked_by?: string | null
        }
        Update: {
          checked_at?: string
          checked_by?: string
          class_date?: string
          class_time?: string
          created_at?: string
          id?: string
          unchecked_at?: string | null
          unchecked_by?: string | null
        }
        Relationships: []
      }
      coaching_scripts: {
        Row: {
          created_at: string
          file_url: string
          format: string
          id: string
          script_date: string
          title: string
        }
        Insert: {
          created_at?: string
          file_url: string
          format: string
          id?: string
          script_date: string
          title: string
        }
        Update: {
          created_at?: string
          file_url?: string
          format?: string
          id?: string
          script_date?: string
          title?: string
        }
        Relationships: []
      }
      daily_goal_settings: {
        Row: {
          created_at: string
          followups_done_target: number
          id: string
          role: string | null
          scope: string
          touches_target: number
        }
        Insert: {
          created_at?: string
          followups_done_target?: number
          id?: string
          role?: string | null
          scope?: string
          touches_target?: number
        }
        Update: {
          created_at?: string
          followups_done_target?: number
          id?: string
          role?: string | null
          scope?: string
          touches_target?: number
        }
        Relationships: []
      }
      daily_lead_log: {
        Row: {
          created_at: string
          id: string
          lead_count: number
          log_date: string
          logged_by: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_count: number
          log_date?: string
          logged_by: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_count?: number
          log_date?: string
          logged_by?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_outreach_log: {
        Row: {
          cold_dms_sent: number
          cold_texts_sent: number
          created_at: string
          id: string
          log_date: string
          sa_name: string
        }
        Insert: {
          cold_dms_sent?: number
          cold_texts_sent?: number
          created_at?: string
          id?: string
          log_date?: string
          sa_name: string
        }
        Update: {
          cold_dms_sent?: number
          cold_texts_sent?: number
          created_at?: string
          id?: string
          log_date?: string
          sa_name?: string
        }
        Relationships: []
      }
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
      data_audit_log: {
        Row: {
          created_at: string
          fail_count: number
          id: string
          pass_count: number
          results: Json
          total_checks: number
          warn_count: number
        }
        Insert: {
          created_at?: string
          fail_count?: number
          id?: string
          pass_count?: number
          results?: Json
          total_checks?: number
          warn_count?: number
        }
        Update: {
          created_at?: string
          fail_count?: number
          id?: string
          pass_count?: number
          results?: Json
          total_checks?: number
          warn_count?: number
        }
        Relationships: []
      }
      events: {
        Row: {
          activity_type: string
          cost_cents: number | null
          created_at: string
          created_by: string | null
          event_date: string | null
          id: string
          is_active: boolean
          name: string
          short_code: string | null
          updated_at: string
        }
        Insert: {
          activity_type?: string
          cost_cents?: number | null
          created_at?: string
          created_by?: string | null
          event_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          short_code?: string | null
          updated_at?: string
        }
        Update: {
          activity_type?: string
          cost_cents?: number | null
          created_at?: string
          created_by?: string | null
          event_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          short_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      follow_up_queue: {
        Row: {
          booking_id: string | null
          closed_reason: string | null
          coach_owner: string | null
          created_at: string
          fitness_goal: string | null
          id: string
          is_legacy: boolean
          is_vip: boolean
          lead_id: string | null
          not_interested_at: string | null
          not_interested_by: string | null
          owner_role: string
          person_name: string
          person_type: string
          primary_objection: string | null
          saved_to_rebook: boolean
          saved_to_rebook_at: string | null
          scheduled_date: string
          sent_at: string | null
          sent_by: string | null
          snoozed_until: string | null
          status: string
          touch_number: number
          transferred_to_sa_at: string | null
          trigger_date: string
        }
        Insert: {
          booking_id?: string | null
          closed_reason?: string | null
          coach_owner?: string | null
          created_at?: string
          fitness_goal?: string | null
          id?: string
          is_legacy?: boolean
          is_vip?: boolean
          lead_id?: string | null
          not_interested_at?: string | null
          not_interested_by?: string | null
          owner_role?: string
          person_name: string
          person_type: string
          primary_objection?: string | null
          saved_to_rebook?: boolean
          saved_to_rebook_at?: string | null
          scheduled_date: string
          sent_at?: string | null
          sent_by?: string | null
          snoozed_until?: string | null
          status?: string
          touch_number?: number
          transferred_to_sa_at?: string | null
          trigger_date: string
        }
        Update: {
          booking_id?: string | null
          closed_reason?: string | null
          coach_owner?: string | null
          created_at?: string
          fitness_goal?: string | null
          id?: string
          is_legacy?: boolean
          is_vip?: boolean
          lead_id?: string | null
          not_interested_at?: string | null
          not_interested_by?: string | null
          owner_role?: string
          person_name?: string
          person_type?: string
          primary_objection?: string | null
          saved_to_rebook?: boolean
          saved_to_rebook_at?: string | null
          scheduled_date?: string
          sent_at?: string | null
          sent_by?: string | null
          snoozed_until?: string | null
          status?: string
          touch_number?: number
          transferred_to_sa_at?: string | null
          trigger_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_queue_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "intros_booked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_daily_log: {
        Row: {
          contacted_count: number
          created_at: string
          id: string
          log_date: string
          responded_count: number
          sa_name: string
        }
        Insert: {
          contacted_count?: number
          created_at?: string
          id?: string
          log_date?: string
          responded_count?: number
          sa_name: string
        }
        Update: {
          contacted_count?: number
          created_at?: string
          id?: string
          log_date?: string
          responded_count?: number
          sa_name?: string
        }
        Relationships: []
      }
      followup_touches: {
        Row: {
          booking_id: string | null
          channel: string | null
          created_at: string
          created_by: string
          id: string
          lead_id: string | null
          meta: Json | null
          notes: string | null
          run_id: string | null
          script_template_id: string | null
          touch_type: string
        }
        Insert: {
          booking_id?: string | null
          channel?: string | null
          created_at?: string
          created_by: string
          id?: string
          lead_id?: string | null
          meta?: Json | null
          notes?: string | null
          run_id?: string | null
          script_template_id?: string | null
          touch_type: string
        }
        Update: {
          booking_id?: string | null
          channel?: string | null
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string | null
          meta?: Json | null
          notes?: string | null
          run_id?: string | null
          script_template_id?: string | null
          touch_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_touches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "intros_booked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_touches_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_touches_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "intros_run"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_touches_script_template_id_fkey"
            columns: ["script_template_id"]
            isOneToOne: false
            referencedRelation: "script_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      fv_scorecard_bullets: {
        Row: {
          bullet_key: string
          column_key: string
          created_at: string
          id: string
          score: number
          scorecard_id: string
          updated_at: string
        }
        Insert: {
          bullet_key: string
          column_key: string
          created_at?: string
          id?: string
          score: number
          scorecard_id: string
          updated_at?: string
        }
        Update: {
          bullet_key?: string
          column_key?: string
          created_at?: string
          id?: string
          score?: number
          scorecard_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fv_scorecard_bullets_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "fv_scorecards"
            referencedColumns: ["id"]
          },
        ]
      }
      fv_scorecard_comments: {
        Row: {
          author_name: string
          body: string
          created_at: string
          created_by: string
          id: string
          scorecard_id: string
        }
        Insert: {
          author_name: string
          body: string
          created_at?: string
          created_by: string
          id?: string
          scorecard_id: string
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          scorecard_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fv_scorecard_comments_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "fv_scorecards"
            referencedColumns: ["id"]
          },
        ]
      }
      fv_scorecard_edit_log: {
        Row: {
          edited_at: string
          editor_name: string
          field_changed: string
          id: string
          new_value: string | null
          old_value: string | null
          scorecard_id: string
        }
        Insert: {
          edited_at?: string
          editor_name: string
          field_changed: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          scorecard_id: string
        }
        Update: {
          edited_at?: string
          editor_name?: string
          field_changed?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          scorecard_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fv_scorecard_edit_log_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "fv_scorecards"
            referencedColumns: ["id"]
          },
        ]
      }
      fv_scorecards: {
        Row: {
          class_date: string
          class_type: string
          created_at: string
          created_by: string
          eval_type: string
          evaluatee_name: string
          evaluator_name: string
          first_timer_id: string | null
          floor_score: number
          handback_notes: string | null
          handback_score: number
          id: string
          interactions_notes: string | null
          is_practice: boolean
          level: number | null
          member_count: number | null
          otbeat_notes: string | null
          otbeat_score: number
          practice_name: string | null
          reflection_text: string | null
          replicated_from_scorecard_id: string | null
          rower_score: number
          submitted_at: string | null
          total_score: number | null
          tread_score: number
          updated_at: string
        }
        Insert: {
          class_date: string
          class_type: string
          created_at?: string
          created_by: string
          eval_type: string
          evaluatee_name: string
          evaluator_name: string
          first_timer_id?: string | null
          floor_score?: number
          handback_notes?: string | null
          handback_score?: number
          id?: string
          interactions_notes?: string | null
          is_practice?: boolean
          level?: number | null
          member_count?: number | null
          otbeat_notes?: string | null
          otbeat_score?: number
          practice_name?: string | null
          reflection_text?: string | null
          replicated_from_scorecard_id?: string | null
          rower_score?: number
          submitted_at?: string | null
          total_score?: number | null
          tread_score?: number
          updated_at?: string
        }
        Update: {
          class_date?: string
          class_type?: string
          created_at?: string
          created_by?: string
          eval_type?: string
          evaluatee_name?: string
          evaluator_name?: string
          first_timer_id?: string | null
          floor_score?: number
          handback_notes?: string | null
          handback_score?: number
          id?: string
          interactions_notes?: string | null
          is_practice?: boolean
          level?: number | null
          member_count?: number | null
          otbeat_notes?: string | null
          otbeat_score?: number
          practice_name?: string | null
          reflection_text?: string | null
          replicated_from_scorecard_id?: string | null
          rower_score?: number
          submitted_at?: string | null
          total_score?: number | null
          tread_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fv_scorecards_replicated_from_scorecard_id_fkey"
            columns: ["replicated_from_scorecard_id"]
            isOneToOne: false
            referencedRelation: "fv_scorecards"
            referencedColumns: ["id"]
          },
        ]
      }
      fv_scoring_columns: {
        Row: {
          column_key: string
          created_at: string
          is_starred: boolean
          updated_at: string
          why_matters: string | null
        }
        Insert: {
          column_key: string
          created_at?: string
          is_starred?: boolean
          updated_at?: string
          why_matters?: string | null
        }
        Update: {
          column_key?: string
          created_at?: string
          is_starred?: boolean
          updated_at?: string
          why_matters?: string | null
        }
        Relationships: []
      }
      fv_scoring_global: {
        Row: {
          awareness_test: string
          bottom_line: string | null
          created_at: string
          id: string
          scale_meaning: string
          surface_test: string
          updated_at: string
        }
        Insert: {
          awareness_test: string
          bottom_line?: string | null
          created_at?: string
          id?: string
          scale_meaning: string
          surface_test: string
          updated_at?: string
        }
        Update: {
          awareness_test?: string
          bottom_line?: string | null
          created_at?: string
          id?: string
          scale_meaning?: string
          surface_test?: string
          updated_at?: string
        }
        Relationships: []
      }
      fv_scoring_guidance: {
        Row: {
          bullet_key: string
          created_at: string
          score_0: string
          score_1: string
          score_2: string
          updated_at: string
        }
        Insert: {
          bullet_key: string
          created_at?: string
          score_0: string
          score_1: string
          score_2: string
          updated_at?: string
        }
        Update: {
          bullet_key?: string
          created_at?: string
          score_0?: string
          score_1?: string
          score_2?: string
          updated_at?: string
        }
        Relationships: []
      }
      giveaway_entries: {
        Row: {
          action_free_class: boolean
          action_free_class_screenshot_url: string | null
          action_instagram_follow: boolean
          action_partner_visit: boolean
          action_partner_visit_photo_url: string | null
          action_post_engagement: boolean
          action_post_engagement_screenshot_url: string | null
          action_story_share: boolean
          action_story_share_screenshot_url: string | null
          base_entries: number
          bonus_entries: number
          email: string | null
          entry_slug: string
          first_name: string
          id: string
          instagram_handle: string | null
          last_name: string
          partner_actions: Json
          phone: string
          phone_normalized: string
          studio_slug: string
          submitted_at: string
          total_entries: number | null
        }
        Insert: {
          action_free_class?: boolean
          action_free_class_screenshot_url?: string | null
          action_instagram_follow?: boolean
          action_partner_visit?: boolean
          action_partner_visit_photo_url?: string | null
          action_post_engagement?: boolean
          action_post_engagement_screenshot_url?: string | null
          action_story_share?: boolean
          action_story_share_screenshot_url?: string | null
          base_entries?: number
          bonus_entries?: number
          email?: string | null
          entry_slug?: string
          first_name: string
          id?: string
          instagram_handle?: string | null
          last_name: string
          partner_actions?: Json
          phone: string
          phone_normalized: string
          studio_slug: string
          submitted_at?: string
          total_entries?: number | null
        }
        Update: {
          action_free_class?: boolean
          action_free_class_screenshot_url?: string | null
          action_instagram_follow?: boolean
          action_partner_visit?: boolean
          action_partner_visit_photo_url?: string | null
          action_post_engagement?: boolean
          action_post_engagement_screenshot_url?: string | null
          action_story_share?: boolean
          action_story_share_screenshot_url?: string | null
          base_entries?: number
          bonus_entries?: number
          email?: string | null
          entry_slug?: string
          first_name?: string
          id?: string
          instagram_handle?: string | null
          last_name?: string
          partner_actions?: Json
          phone?: string
          phone_normalized?: string
          studio_slug?: string
          submitted_at?: string
          total_entries?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "giveaway_entries_studio_slug_fkey"
            columns: ["studio_slug"]
            isOneToOne: false
            referencedRelation: "giveaway_studios"
            referencedColumns: ["studio_slug"]
          },
        ]
      }
      giveaway_partners: {
        Row: {
          created_at: string
          display_order: number
          id: string
          partner_ig_handle: string | null
          partner_name: string
          prize_count: number
          prize_description: string | null
          prize_labels: Json | null
          receipt_instructions: string | null
          studio_slug: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          partner_ig_handle?: string | null
          partner_name: string
          prize_count?: number
          prize_description?: string | null
          prize_labels?: Json | null
          receipt_instructions?: string | null
          studio_slug: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          partner_ig_handle?: string | null
          partner_name?: string
          prize_count?: number
          prize_description?: string | null
          prize_labels?: Json | null
          receipt_instructions?: string | null
          studio_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "giveaway_partners_studio_slug_fkey"
            columns: ["studio_slug"]
            isOneToOne: false
            referencedRelation: "giveaway_studios"
            referencedColumns: ["studio_slug"]
          },
        ]
      }
      giveaway_studios: {
        Row: {
          action_labels: Json
          action_verification_modes: Json
          countdown_duration_days: number
          countdown_mode: string
          created_at: string
          custom_title: string | null
          deck_contact_email: string | null
          deck_contact_name: string | null
          deck_contact_phone: string | null
          deck_contact_title: string | null
          deck_headline_value: string | null
          deck_intro_copy: string | null
          deck_prize_anchor_value: number | null
          deck_s1_subtitle_size: number | null
          deck_s1_title1_size: number | null
          deck_s1_title2_size: number | null
          deck_s2_body: string | null
          deck_s2_headline: string | null
          deck_s2_headline_size: number | null
          deck_s3_headline: string | null
          deck_s3_headline_size: number | null
          deck_s3_value_note: string | null
          deck_s4_headline: string | null
          deck_s4_headline_size: number | null
          deck_s4_phase_title_size: number | null
          deck_s4_phase1_body: string | null
          deck_s4_phase1_title: string | null
          deck_s4_phase2_body: string | null
          deck_s4_phase2_title: string | null
          deck_s4_phase3_body: string | null
          deck_s4_phase3_title: string | null
          deck_s4_subtext: string | null
          deck_s5_c1_body: string | null
          deck_s5_c1_title: string | null
          deck_s5_c2_body: string | null
          deck_s5_c2_title: string | null
          deck_s5_c3_body: string | null
          deck_s5_c3_title: string | null
          deck_s5_c4_body: string | null
          deck_s5_c4_title: string | null
          deck_s5_card_title_size: number | null
          deck_s5_headline: string | null
          deck_s5_headline_size: number | null
          deck_s6_body: string | null
          deck_s6_headline: string | null
          deck_s6_headline_size: number | null
          deck_s6_note: string | null
          deck_s7_headline: string | null
          deck_s7_headline_size: number | null
          deck_s8_class: string | null
          deck_s8_headline: string | null
          deck_s8_headline_size: number | null
          deck_s8_prize: string | null
          deck_s8_promo: string | null
          deck_s8_time: string | null
          deck_s9_body: string | null
          deck_s9_headline: string | null
          deck_s9_headline_size: number | null
          deck_s9_subline: string | null
          deck_s9_subline_size: number | null
          deck_what_we_need_class: string | null
          deck_what_we_need_prize: string | null
          deck_what_we_need_promotion: string | null
          deck_what_we_need_time: string | null
          goes_live_at: string | null
          id: string
          share_slug: string | null
          studio_name: string
          studio_slug: string
          title_format: string
          updated_at: string
          winner_structure: string
        }
        Insert: {
          action_labels?: Json
          action_verification_modes?: Json
          countdown_duration_days?: number
          countdown_mode?: string
          created_at?: string
          custom_title?: string | null
          deck_contact_email?: string | null
          deck_contact_name?: string | null
          deck_contact_phone?: string | null
          deck_contact_title?: string | null
          deck_headline_value?: string | null
          deck_intro_copy?: string | null
          deck_prize_anchor_value?: number | null
          deck_s1_subtitle_size?: number | null
          deck_s1_title1_size?: number | null
          deck_s1_title2_size?: number | null
          deck_s2_body?: string | null
          deck_s2_headline?: string | null
          deck_s2_headline_size?: number | null
          deck_s3_headline?: string | null
          deck_s3_headline_size?: number | null
          deck_s3_value_note?: string | null
          deck_s4_headline?: string | null
          deck_s4_headline_size?: number | null
          deck_s4_phase_title_size?: number | null
          deck_s4_phase1_body?: string | null
          deck_s4_phase1_title?: string | null
          deck_s4_phase2_body?: string | null
          deck_s4_phase2_title?: string | null
          deck_s4_phase3_body?: string | null
          deck_s4_phase3_title?: string | null
          deck_s4_subtext?: string | null
          deck_s5_c1_body?: string | null
          deck_s5_c1_title?: string | null
          deck_s5_c2_body?: string | null
          deck_s5_c2_title?: string | null
          deck_s5_c3_body?: string | null
          deck_s5_c3_title?: string | null
          deck_s5_c4_body?: string | null
          deck_s5_c4_title?: string | null
          deck_s5_card_title_size?: number | null
          deck_s5_headline?: string | null
          deck_s5_headline_size?: number | null
          deck_s6_body?: string | null
          deck_s6_headline?: string | null
          deck_s6_headline_size?: number | null
          deck_s6_note?: string | null
          deck_s7_headline?: string | null
          deck_s7_headline_size?: number | null
          deck_s8_class?: string | null
          deck_s8_headline?: string | null
          deck_s8_headline_size?: number | null
          deck_s8_prize?: string | null
          deck_s8_promo?: string | null
          deck_s8_time?: string | null
          deck_s9_body?: string | null
          deck_s9_headline?: string | null
          deck_s9_headline_size?: number | null
          deck_s9_subline?: string | null
          deck_s9_subline_size?: number | null
          deck_what_we_need_class?: string | null
          deck_what_we_need_prize?: string | null
          deck_what_we_need_promotion?: string | null
          deck_what_we_need_time?: string | null
          goes_live_at?: string | null
          id?: string
          share_slug?: string | null
          studio_name: string
          studio_slug: string
          title_format?: string
          updated_at?: string
          winner_structure?: string
        }
        Update: {
          action_labels?: Json
          action_verification_modes?: Json
          countdown_duration_days?: number
          countdown_mode?: string
          created_at?: string
          custom_title?: string | null
          deck_contact_email?: string | null
          deck_contact_name?: string | null
          deck_contact_phone?: string | null
          deck_contact_title?: string | null
          deck_headline_value?: string | null
          deck_intro_copy?: string | null
          deck_prize_anchor_value?: number | null
          deck_s1_subtitle_size?: number | null
          deck_s1_title1_size?: number | null
          deck_s1_title2_size?: number | null
          deck_s2_body?: string | null
          deck_s2_headline?: string | null
          deck_s2_headline_size?: number | null
          deck_s3_headline?: string | null
          deck_s3_headline_size?: number | null
          deck_s3_value_note?: string | null
          deck_s4_headline?: string | null
          deck_s4_headline_size?: number | null
          deck_s4_phase_title_size?: number | null
          deck_s4_phase1_body?: string | null
          deck_s4_phase1_title?: string | null
          deck_s4_phase2_body?: string | null
          deck_s4_phase2_title?: string | null
          deck_s4_phase3_body?: string | null
          deck_s4_phase3_title?: string | null
          deck_s4_subtext?: string | null
          deck_s5_c1_body?: string | null
          deck_s5_c1_title?: string | null
          deck_s5_c2_body?: string | null
          deck_s5_c2_title?: string | null
          deck_s5_c3_body?: string | null
          deck_s5_c3_title?: string | null
          deck_s5_c4_body?: string | null
          deck_s5_c4_title?: string | null
          deck_s5_card_title_size?: number | null
          deck_s5_headline?: string | null
          deck_s5_headline_size?: number | null
          deck_s6_body?: string | null
          deck_s6_headline?: string | null
          deck_s6_headline_size?: number | null
          deck_s6_note?: string | null
          deck_s7_headline?: string | null
          deck_s7_headline_size?: number | null
          deck_s8_class?: string | null
          deck_s8_headline?: string | null
          deck_s8_headline_size?: number | null
          deck_s8_prize?: string | null
          deck_s8_promo?: string | null
          deck_s8_time?: string | null
          deck_s9_body?: string | null
          deck_s9_headline?: string | null
          deck_s9_headline_size?: number | null
          deck_s9_subline?: string | null
          deck_s9_subline_size?: number | null
          deck_what_we_need_class?: string | null
          deck_what_we_need_prize?: string | null
          deck_what_we_need_promotion?: string | null
          deck_what_we_need_time?: string | null
          goes_live_at?: string | null
          id?: string
          share_slug?: string | null
          studio_name?: string
          studio_slug?: string
          title_format?: string
          updated_at?: string
          winner_structure?: string
        }
        Relationships: []
      }
      giveaway_uploads: {
        Row: {
          action_type: string
          entry_id: string | null
          file_url: string
          id: string
          studio_slug: string | null
          uploaded_at: string
        }
        Insert: {
          action_type: string
          entry_id?: string | null
          file_url: string
          id?: string
          studio_slug?: string | null
          uploaded_at?: string
        }
        Update: {
          action_type?: string
          entry_id?: string | null
          file_url?: string
          id?: string
          studio_slug?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "giveaway_uploads_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "giveaway_entries"
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
      intro_bookable_slot_overrides: {
        Row: {
          action: string
          class_date: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          slot_time: string
        }
        Insert: {
          action: string
          class_date: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          slot_time: string
        }
        Update: {
          action?: string
          class_date?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          slot_time?: string
        }
        Relationships: []
      }
      intro_bookable_slots: {
        Row: {
          class_label: string | null
          created_at: string
          day_of_week: number
          id: string
          is_active: boolean
          is_bookable: boolean
          slot_time: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          class_label?: string | null
          created_at?: string
          day_of_week: number
          id?: string
          is_active?: boolean
          is_bookable?: boolean
          slot_time: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          class_label?: string | null
          created_at?: string
          day_of_week?: number
          id?: string
          is_active?: boolean
          is_bookable?: boolean
          slot_time?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      intro_booking_seen: {
        Row: {
          booking_id: string
          id: string
          seen_at: string
          seen_by: string
        }
        Insert: {
          booking_id: string
          id?: string
          seen_at?: string
          seen_by: string
        }
        Update: {
          booking_id?: string
          id?: string
          seen_at?: string
          seen_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "intro_booking_seen_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "intros_booked"
            referencedColumns: ["id"]
          },
        ]
      }
      intro_link_codes: {
        Row: {
          code: string
          created_at: string
          event_id: string | null
          sa_name: string
          source: string
        }
        Insert: {
          code: string
          created_at?: string
          event_id?: string | null
          sa_name: string
          source: string
        }
        Update: {
          code?: string
          created_at?: string
          event_id?: string | null
          sa_name?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "intro_link_codes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      intro_questionnaires: {
        Row: {
          archived_at: string | null
          booking_id: string | null
          client_first_name: string
          client_last_name: string
          created_at: string
          id: string
          last_opened_at: string | null
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
          archived_at?: string | null
          booking_id?: string | null
          client_first_name: string
          client_last_name?: string
          created_at?: string
          id?: string
          last_opened_at?: string | null
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
          archived_at?: string | null
          booking_id?: string | null
          client_first_name?: string
          client_last_name?: string
          created_at?: string
          id?: string
          last_opened_at?: string | null
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
          booking_status_canon: string
          booking_type_canon: string
          class_date: string
          class_start_at: string | null
          closed_at: string | null
          closed_by: string | null
          coach_brief_five_vision: string | null
          coach_brief_human_detail: string | null
          coach_debrief_submitted: boolean
          coach_debrief_submitted_at: string | null
          coach_debrief_submitted_by: string | null
          coach_name: string
          coach_notes: string | null
          coach_referral_asked: boolean | null
          coach_referral_names: string | null
          converted_to_booking_id: string | null
          created_at: string
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          edit_reason: string | null
          email: string | null
          entry_url: string | null
          event_id: string | null
          fitness_goal: string | null
          followup_dismissed_at: string | null
          friend_code: string | null
          friend_code_used: string | null
          id: string
          ignore_from_metrics: boolean | null
          intro_owner: string | null
          intro_owner_locked: boolean | null
          intro_time: string | null
          is_buddy_card_referral: boolean
          is_vip: boolean
          last_edited_at: string | null
          last_edited_by: string | null
          lead_source: string
          linked_ig_lead_id: string | null
          member_name: string
          originating_booking_id: string | null
          paired_booking_id: string | null
          phone: string | null
          phone_e164: string | null
          phone_source: string | null
          prepped: boolean
          prepped_at: string | null
          prepped_by: string | null
          questionnaire_completed_at: string | null
          questionnaire_link: string | null
          questionnaire_sent_at: string | null
          questionnaire_status_canon: string
          rebook_reason: string | null
          rebooked_at: string | null
          rebooked_from_booking_id: string | null
          referral_ask_followup_pending: boolean
          referred_by_member_name: string | null
          reschedule_contact_date: string | null
          sa_buying_criteria: string | null
          sa_conversation_5_of_5: string | null
          sa_conversation_meaning: string | null
          sa_conversation_obstacle: string | null
          sa_objection: string | null
          sa_working_shift: string
          scheduler_link_sa: string | null
          sheets_row_number: number | null
          shift_recap_id: string | null
          via_scheduler_link: boolean
          vip_class_name: string | null
          vip_session_id: string | null
          vip_status: string | null
        }
        Insert: {
          booked_by?: string | null
          booking_id?: string | null
          booking_status?: string | null
          booking_status_canon?: string
          booking_type_canon?: string
          class_date: string
          class_start_at?: string | null
          closed_at?: string | null
          closed_by?: string | null
          coach_brief_five_vision?: string | null
          coach_brief_human_detail?: string | null
          coach_debrief_submitted?: boolean
          coach_debrief_submitted_at?: string | null
          coach_debrief_submitted_by?: string | null
          coach_name: string
          coach_notes?: string | null
          coach_referral_asked?: boolean | null
          coach_referral_names?: string | null
          converted_to_booking_id?: string | null
          created_at?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          edit_reason?: string | null
          email?: string | null
          entry_url?: string | null
          event_id?: string | null
          fitness_goal?: string | null
          followup_dismissed_at?: string | null
          friend_code?: string | null
          friend_code_used?: string | null
          id?: string
          ignore_from_metrics?: boolean | null
          intro_owner?: string | null
          intro_owner_locked?: boolean | null
          intro_time?: string | null
          is_buddy_card_referral?: boolean
          is_vip?: boolean
          last_edited_at?: string | null
          last_edited_by?: string | null
          lead_source: string
          linked_ig_lead_id?: string | null
          member_name: string
          originating_booking_id?: string | null
          paired_booking_id?: string | null
          phone?: string | null
          phone_e164?: string | null
          phone_source?: string | null
          prepped?: boolean
          prepped_at?: string | null
          prepped_by?: string | null
          questionnaire_completed_at?: string | null
          questionnaire_link?: string | null
          questionnaire_sent_at?: string | null
          questionnaire_status_canon?: string
          rebook_reason?: string | null
          rebooked_at?: string | null
          rebooked_from_booking_id?: string | null
          referral_ask_followup_pending?: boolean
          referred_by_member_name?: string | null
          reschedule_contact_date?: string | null
          sa_buying_criteria?: string | null
          sa_conversation_5_of_5?: string | null
          sa_conversation_meaning?: string | null
          sa_conversation_obstacle?: string | null
          sa_objection?: string | null
          sa_working_shift: string
          scheduler_link_sa?: string | null
          sheets_row_number?: number | null
          shift_recap_id?: string | null
          via_scheduler_link?: boolean
          vip_class_name?: string | null
          vip_session_id?: string | null
          vip_status?: string | null
        }
        Update: {
          booked_by?: string | null
          booking_id?: string | null
          booking_status?: string | null
          booking_status_canon?: string
          booking_type_canon?: string
          class_date?: string
          class_start_at?: string | null
          closed_at?: string | null
          closed_by?: string | null
          coach_brief_five_vision?: string | null
          coach_brief_human_detail?: string | null
          coach_debrief_submitted?: boolean
          coach_debrief_submitted_at?: string | null
          coach_debrief_submitted_by?: string | null
          coach_name?: string
          coach_notes?: string | null
          coach_referral_asked?: boolean | null
          coach_referral_names?: string | null
          converted_to_booking_id?: string | null
          created_at?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          edit_reason?: string | null
          email?: string | null
          entry_url?: string | null
          event_id?: string | null
          fitness_goal?: string | null
          followup_dismissed_at?: string | null
          friend_code?: string | null
          friend_code_used?: string | null
          id?: string
          ignore_from_metrics?: boolean | null
          intro_owner?: string | null
          intro_owner_locked?: boolean | null
          intro_time?: string | null
          is_buddy_card_referral?: boolean
          is_vip?: boolean
          last_edited_at?: string | null
          last_edited_by?: string | null
          lead_source?: string
          linked_ig_lead_id?: string | null
          member_name?: string
          originating_booking_id?: string | null
          paired_booking_id?: string | null
          phone?: string | null
          phone_e164?: string | null
          phone_source?: string | null
          prepped?: boolean
          prepped_at?: string | null
          prepped_by?: string | null
          questionnaire_completed_at?: string | null
          questionnaire_link?: string | null
          questionnaire_sent_at?: string | null
          questionnaire_status_canon?: string
          rebook_reason?: string | null
          rebooked_at?: string | null
          rebooked_from_booking_id?: string | null
          referral_ask_followup_pending?: boolean
          referred_by_member_name?: string | null
          reschedule_contact_date?: string | null
          sa_buying_criteria?: string | null
          sa_conversation_5_of_5?: string | null
          sa_conversation_meaning?: string | null
          sa_conversation_obstacle?: string | null
          sa_objection?: string | null
          sa_working_shift?: string
          scheduler_link_sa?: string | null
          sheets_row_number?: number | null
          shift_recap_id?: string | null
          via_scheduler_link?: boolean
          vip_class_name?: string | null
          vip_session_id?: string | null
          vip_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intros_booked_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "intros_booked_vip_session_id_fkey"
            columns: ["vip_session_id"]
            isOneToOne: false
            referencedRelation: "vip_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      intros_run: {
        Row: {
          amc_incremented_at: string | null
          amc_incremented_by: string | null
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
          halfway_encouragement: boolean | null
          id: string
          ignore_from_metrics: boolean | null
          intro_owner: string | null
          intro_owner_locked: boolean | null
          is_self_gen: boolean | null
          is_vip: boolean
          is_winback: boolean
          last_edited_at: string | null
          last_edited_by: string | null
          lead_measures: string[] | null
          lead_source: string | null
          linked_intro_booked_id: string | null
          member_name: string
          notes: string | null
          premobility_encouragement: boolean | null
          pricing_engagement: string | null
          primary_objection: string | null
          process_checklist: string[] | null
          ran_by: string | null
          result: string
          result_canon: string
          rfg_presented: boolean | null
          run_date: string | null
          run_id: string | null
          sa_name: string | null
          second_intro_reason: string | null
          sheets_row_number: number | null
          shift_recap_id: string | null
          updated_at: string
          vip_converted: boolean
          vip_session_id: string | null
        }
        Insert: {
          amc_incremented_at?: string | null
          amc_incremented_by?: string | null
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
          halfway_encouragement?: boolean | null
          id?: string
          ignore_from_metrics?: boolean | null
          intro_owner?: string | null
          intro_owner_locked?: boolean | null
          is_self_gen?: boolean | null
          is_vip?: boolean
          is_winback?: boolean
          last_edited_at?: string | null
          last_edited_by?: string | null
          lead_measures?: string[] | null
          lead_source?: string | null
          linked_intro_booked_id?: string | null
          member_name: string
          notes?: string | null
          premobility_encouragement?: boolean | null
          pricing_engagement?: string | null
          primary_objection?: string | null
          process_checklist?: string[] | null
          ran_by?: string | null
          result: string
          result_canon?: string
          rfg_presented?: boolean | null
          run_date?: string | null
          run_id?: string | null
          sa_name?: string | null
          second_intro_reason?: string | null
          sheets_row_number?: number | null
          shift_recap_id?: string | null
          updated_at?: string
          vip_converted?: boolean
          vip_session_id?: string | null
        }
        Update: {
          amc_incremented_at?: string | null
          amc_incremented_by?: string | null
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
          halfway_encouragement?: boolean | null
          id?: string
          ignore_from_metrics?: boolean | null
          intro_owner?: string | null
          intro_owner_locked?: boolean | null
          is_self_gen?: boolean | null
          is_vip?: boolean
          is_winback?: boolean
          last_edited_at?: string | null
          last_edited_by?: string | null
          lead_measures?: string[] | null
          lead_source?: string | null
          linked_intro_booked_id?: string | null
          member_name?: string
          notes?: string | null
          premobility_encouragement?: boolean | null
          pricing_engagement?: string | null
          primary_objection?: string | null
          process_checklist?: string[] | null
          ran_by?: string | null
          result?: string
          result_canon?: string
          rfg_presented?: boolean | null
          run_date?: string | null
          run_id?: string | null
          sa_name?: string | null
          second_intro_reason?: string | null
          sheets_row_number?: number | null
          shift_recap_id?: string | null
          updated_at?: string
          vip_converted?: boolean
          vip_session_id?: string | null
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
          duplicate_confidence: string | null
          duplicate_match_type: string | null
          duplicate_notes: string | null
          duplicate_override: boolean | null
          email: string | null
          first_name: string
          follow_up_at: string | null
          id: string
          is_buddy_card: boolean
          last_name: string
          lost_reason: string | null
          mindbody_imported_at: string | null
          mindbody_imported_by: string | null
          phone: string
          referred_by_member_name: string | null
          referring_member_contact: string | null
          source: string
          sourced_by_sa: string | null
          stage: string
          text_archived_at: string | null
          text_archived_reason: string | null
          updated_at: string
        }
        Insert: {
          booked_intro_id?: string | null
          created_at?: string
          duplicate_confidence?: string | null
          duplicate_match_type?: string | null
          duplicate_notes?: string | null
          duplicate_override?: boolean | null
          email?: string | null
          first_name: string
          follow_up_at?: string | null
          id?: string
          is_buddy_card?: boolean
          last_name: string
          lost_reason?: string | null
          mindbody_imported_at?: string | null
          mindbody_imported_by?: string | null
          phone: string
          referred_by_member_name?: string | null
          referring_member_contact?: string | null
          source?: string
          sourced_by_sa?: string | null
          stage?: string
          text_archived_at?: string | null
          text_archived_reason?: string | null
          updated_at?: string
        }
        Update: {
          booked_intro_id?: string | null
          created_at?: string
          duplicate_confidence?: string | null
          duplicate_match_type?: string | null
          duplicate_notes?: string | null
          duplicate_override?: boolean | null
          email?: string | null
          first_name?: string
          follow_up_at?: string | null
          id?: string
          is_buddy_card?: boolean
          last_name?: string
          lost_reason?: string | null
          mindbody_imported_at?: string | null
          mindbody_imported_by?: string | null
          phone?: string
          referred_by_member_name?: string | null
          referring_member_contact?: string | null
          source?: string
          sourced_by_sa?: string | null
          stage?: string
          text_archived_at?: string | null
          text_archived_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      meeting_agendas: {
        Row: {
          created_at: string
          date_range_end: string
          date_range_start: string
          drill_override: string | null
          housekeeping_notes: string | null
          id: string
          manual_shoutouts: string | null
          meeting_date: string
          metrics_snapshot: Json | null
          status: string
          updated_at: string
          wig_commitments: string | null
          wig_target: string | null
        }
        Insert: {
          created_at?: string
          date_range_end: string
          date_range_start: string
          drill_override?: string | null
          housekeeping_notes?: string | null
          id?: string
          manual_shoutouts?: string | null
          meeting_date: string
          metrics_snapshot?: Json | null
          status?: string
          updated_at?: string
          wig_commitments?: string | null
          wig_target?: string | null
        }
        Update: {
          created_at?: string
          date_range_end?: string
          date_range_start?: string
          drill_override?: string | null
          housekeeping_notes?: string | null
          id?: string
          manual_shoutouts?: string | null
          meeting_date?: string
          metrics_snapshot?: Json | null
          status?: string
          updated_at?: string
          wig_commitments?: string | null
          wig_target?: string | null
        }
        Relationships: []
      }
      meeting_settings: {
        Row: {
          created_at: string
          id: string
          meeting_day: number
          meeting_time: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_day?: number
          meeting_time?: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_day?: number
          meeting_time?: string
        }
        Relationships: []
      }
      milestones: {
        Row: {
          actually_celebrated: boolean
          converted_to_lead_id: string | null
          created_at: string
          created_by: string
          deploy_converted: boolean
          deploy_item_given: string | null
          entry_type: string
          five_class_pack_gifted: boolean
          friend_contact: string | null
          friend_name: string | null
          friend_showed_up: boolean
          id: string
          last_edited_at: string | null
          last_edited_by: string | null
          member_name: string
          milestone_type: string | null
        }
        Insert: {
          actually_celebrated?: boolean
          converted_to_lead_id?: string | null
          created_at?: string
          created_by: string
          deploy_converted?: boolean
          deploy_item_given?: string | null
          entry_type: string
          five_class_pack_gifted?: boolean
          friend_contact?: string | null
          friend_name?: string | null
          friend_showed_up?: boolean
          id?: string
          last_edited_at?: string | null
          last_edited_by?: string | null
          member_name: string
          milestone_type?: string | null
        }
        Update: {
          actually_celebrated?: boolean
          converted_to_lead_id?: string | null
          created_at?: string
          created_by?: string
          deploy_converted?: boolean
          deploy_item_given?: string | null
          entry_type?: string
          five_class_pack_gifted?: boolean
          friend_contact?: string | null
          friend_name?: string | null
          friend_showed_up?: boolean
          id?: string
          last_edited_at?: string | null
          last_edited_by?: string | null
          member_name?: string
          milestone_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestones_converted_to_lead_id_fkey"
            columns: ["converted_to_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_lead_totals: {
        Row: {
          id: string
          last_updated_by: string
          lead_total: number
          month_year: string
          updated_at: string
        }
        Insert: {
          id?: string
          last_updated_by: string
          lead_total?: number
          month_year: string
          updated_at?: string
        }
        Update: {
          id?: string
          last_updated_by?: string
          lead_total?: number
          month_year?: string
          updated_at?: string
        }
        Relationships: []
      }
      net_gain_churns: {
        Row: {
          applied_at: string | null
          churn_date: string
          created_at: string
          created_by: string
          id: string
          member_name: string
          notes: string | null
          updated_at: string
          upload_batch_id: string | null
        }
        Insert: {
          applied_at?: string | null
          churn_date: string
          created_at?: string
          created_by: string
          id?: string
          member_name: string
          notes?: string | null
          updated_at?: string
          upload_batch_id?: string | null
        }
        Update: {
          applied_at?: string | null
          churn_date?: string
          created_at?: string
          created_by?: string
          id?: string
          member_name?: string
          notes?: string | null
          updated_at?: string
          upload_batch_id?: string | null
        }
        Relationships: []
      }
      net_gain_log: {
        Row: {
          changed_at: string
          changed_by: string
          delta: number
          id: string
          new_value: number
          note: string | null
          source_id: string | null
          source_type: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          delta: number
          id?: string
          new_value: number
          note?: string | null
          source_id?: string | null
          source_type?: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          delta?: number
          id?: string
          new_value?: number
          note?: string | null
          source_id?: string | null
          source_type?: string
        }
        Relationships: []
      }
      net_gain_state: {
        Row: {
          id: number
          updated_at: string
          updated_by: string | null
          value: number
        }
        Insert: {
          id?: number
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Update: {
          id?: number
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          meta: Json | null
          notification_type: string
          read_at: string | null
          target_user: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          meta?: Json | null
          notification_type: string
          read_at?: string | null
          target_user?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          meta?: Json | null
          notification_type?: string
          read_at?: string | null
          target_user?: string | null
          title?: string
        }
        Relationships: []
      }
      objection_playbooks: {
        Row: {
          ask_line: string
          created_at: string
          empathize_line: string
          expert_principles: string
          full_script: string
          id: string
          is_active: boolean
          isolate_question: string
          objection_name: string
          redirect_discovery_question: string
          redirect_framework: string
          sort_order: number
          suggestion_framework: string
          training_notes: string
          trigger_obstacles: string[]
          updated_at: string
        }
        Insert: {
          ask_line?: string
          created_at?: string
          empathize_line?: string
          expert_principles?: string
          full_script?: string
          id?: string
          is_active?: boolean
          isolate_question?: string
          objection_name: string
          redirect_discovery_question?: string
          redirect_framework?: string
          sort_order?: number
          suggestion_framework?: string
          training_notes?: string
          trigger_obstacles?: string[]
          updated_at?: string
        }
        Update: {
          ask_line?: string
          created_at?: string
          empathize_line?: string
          expert_principles?: string
          full_script?: string
          id?: string
          is_active?: boolean
          isolate_question?: string
          objection_name?: string
          redirect_discovery_question?: string
          redirect_framework?: string
          sort_order?: number
          suggestion_framework?: string
          training_notes?: string
          trigger_obstacles?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      outcome_changes: {
        Row: {
          amc_incremented: boolean | null
          booking_id: string
          change_reason: string | null
          changed_at: string | null
          changed_by: string
          id: string
          new_booking_status: string | null
          new_result: string
          old_booking_status: string | null
          old_result: string | null
          run_id: string | null
          source_component: string
        }
        Insert: {
          amc_incremented?: boolean | null
          booking_id: string
          change_reason?: string | null
          changed_at?: string | null
          changed_by: string
          id?: string
          new_booking_status?: string | null
          new_result: string
          old_booking_status?: string | null
          old_result?: string | null
          run_id?: string | null
          source_component: string
        }
        Update: {
          amc_incremented?: boolean | null
          booking_id?: string
          change_reason?: string | null
          changed_at?: string | null
          changed_by?: string
          id?: string
          new_booking_status?: string | null
          new_result?: string
          old_booking_status?: string | null
          old_result?: string | null
          run_id?: string | null
          source_component?: string
        }
        Relationships: []
      }
      outcome_events: {
        Row: {
          booking_id: string
          edit_reason: string | null
          edited_at: string
          edited_by: string
          id: string
          metadata: Json | null
          new_booking_status: string | null
          new_result: string
          old_booking_status: string | null
          old_result: string | null
          run_id: string | null
          source_component: string
        }
        Insert: {
          booking_id: string
          edit_reason?: string | null
          edited_at?: string
          edited_by: string
          id?: string
          metadata?: Json | null
          new_booking_status?: string | null
          new_result: string
          old_booking_status?: string | null
          old_result?: string | null
          run_id?: string | null
          source_component: string
        }
        Update: {
          booking_id?: string
          edit_reason?: string | null
          edited_at?: string
          edited_by?: string
          id?: string
          metadata?: Json | null
          new_booking_status?: string | null
          new_result?: string
          old_booking_status?: string | null
          old_result?: string | null
          run_id?: string | null
          source_component?: string
        }
        Relationships: []
      }
      outreach_list_rows: {
        Row: {
          amount: number | null
          churn_date: string | null
          client_name: string
          created_at: string
          created_by: string
          email: string | null
          id: string
          is_churning: boolean
          item: string | null
          last_30d_count: number | null
          latest_workout_date: string | null
          list_id: string
          metadata: Json
          phone: string | null
          updated_at: string
          worked_out_30d: boolean | null
        }
        Insert: {
          amount?: number | null
          churn_date?: string | null
          client_name: string
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          is_churning?: boolean
          item?: string | null
          last_30d_count?: number | null
          latest_workout_date?: string | null
          list_id: string
          metadata?: Json
          phone?: string | null
          updated_at?: string
          worked_out_30d?: boolean | null
        }
        Update: {
          amount?: number | null
          churn_date?: string | null
          client_name?: string
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          is_churning?: boolean
          item?: string | null
          last_30d_count?: number | null
          latest_workout_date?: string | null
          list_id?: string
          metadata?: Json
          phone?: string | null
          updated_at?: string
          worked_out_30d?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_list_rows_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "outreach_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_lists: {
        Row: {
          active: boolean
          campaign_tag: string
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          campaign_tag: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          campaign_tag?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      outreach_row_actions: {
        Row: {
          action_type: string
          created_at: string
          done_at: string
          done_by: string
          id: string
          list_id: string
          notes: string | null
          row_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          done_at?: string
          done_by: string
          id?: string
          list_id: string
          notes?: string | null
          row_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          done_at?: string
          done_by?: string
          id?: string
          list_id?: string
          notes?: string | null
          row_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_row_actions_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "outreach_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_row_actions_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "outreach_list_rows"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_asks: {
        Row: {
          asked_at: string
          created_at: string
          friend_name: string | null
          id: string
          member_name: string
          sa_name: string
          shift_date: string | null
          shift_type: string | null
        }
        Insert: {
          asked_at?: string
          created_at?: string
          friend_name?: string | null
          id?: string
          member_name: string
          sa_name: string
          shift_date?: string | null
          shift_type?: string | null
        }
        Update: {
          asked_at?: string
          created_at?: string
          friend_name?: string | null
          id?: string
          member_name?: string
          sa_name?: string
          shift_date?: string | null
          shift_type?: string | null
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
          is_winback: boolean
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
          is_winback?: boolean
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
          is_winback?: boolean
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
      script_actions: {
        Row: {
          action_type: string
          booking_id: string | null
          completed_at: string
          completed_by: string
          id: string
          lead_id: string | null
          script_category: string | null
        }
        Insert: {
          action_type: string
          booking_id?: string | null
          completed_at?: string
          completed_by: string
          id?: string
          lead_id?: string | null
          script_category?: string | null
        }
        Update: {
          action_type?: string
          booking_id?: string | null
          completed_at?: string
          completed_by?: string
          id?: string
          lead_id?: string | null
          script_category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "script_actions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "intros_booked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_actions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      script_categories: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
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
          category_canon: string | null
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
          category_canon?: string | null
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
          category_canon?: string | null
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
      shift_coverage_reports: {
        Row: {
          created_at: string
          created_by: string
          id: string
          milestones_celebrated: number
          milestones_missed: number
          notes: string | null
          sa_name: string
          shift_date: string
          shift_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          milestones_celebrated?: number
          milestones_missed?: number
          notes?: string | null
          sa_name: string
          shift_date: string
          shift_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          milestones_celebrated?: number
          milestones_missed?: number
          notes?: string | null
          sa_name?: string
          shift_date?: string
          shift_type?: string
          updated_at?: string
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
      shift_standards: {
        Row: {
          created_at: string
          created_by: string | null
          display_order: number
          is_active: boolean
          key: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_order?: number
          is_active?: boolean
          key: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_order?: number
          is_active?: boolean
          key?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      shift_submissions: {
        Row: {
          created_at: string
          id: string
          lead_forward_answer: string | null
          member_experience_answer: string | null
          ownership_lane_answer: string | null
          sa_name: string
          shift_date: string
          shift_type: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_forward_answer?: string | null
          member_experience_answer?: string | null
          ownership_lane_answer?: string | null
          sa_name: string
          shift_date?: string
          shift_type: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_forward_answer?: string | null
          member_experience_answer?: string | null
          ownership_lane_answer?: string | null
          sa_name?: string
          shift_date?: string
          shift_type?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shift_task_completions: {
        Row: {
          completed: boolean
          completed_at: string | null
          count_logged: number | null
          created_at: string | null
          id: string
          override_id: string | null
          sa_name: string
          shift_date: string
          shift_type: string
          task_template_id: string | null
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          count_logged?: number | null
          created_at?: string | null
          id?: string
          override_id?: string | null
          sa_name: string
          shift_date?: string
          shift_type: string
          task_template_id?: string | null
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          count_logged?: number | null
          created_at?: string | null
          id?: string
          override_id?: string | null
          sa_name?: string
          shift_date?: string
          shift_type?: string
          task_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_task_completions_task_template_id_fkey"
            columns: ["task_template_id"]
            isOneToOne: false
            referencedRelation: "shift_task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_task_guidance: {
        Row: {
          created_at: string
          id: string
          is_safety_note: boolean
          is_unmapped: boolean
          lane_order: number
          lane_title: string
          steps: Json
          task_name: string
          updated_at: string
          why_line: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_safety_note?: boolean
          is_unmapped?: boolean
          lane_order?: number
          lane_title: string
          steps?: Json
          task_name: string
          updated_at?: string
          why_line?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_safety_note?: boolean
          is_unmapped?: boolean
          lane_order?: number
          lane_title?: string
          steps?: Json
          task_name?: string
          updated_at?: string
          why_line?: string | null
        }
        Relationships: []
      }
      shift_task_overrides: {
        Row: {
          active_date: string
          count_label: string | null
          created_at: string | null
          created_by: string
          has_count: boolean
          id: string
          shift_type: string
          standard_key: string
          task_name: string
        }
        Insert: {
          active_date: string
          count_label?: string | null
          created_at?: string | null
          created_by: string
          has_count?: boolean
          id?: string
          shift_type: string
          standard_key?: string
          task_name: string
        }
        Update: {
          active_date?: string
          count_label?: string | null
          created_at?: string | null
          created_by?: string
          has_count?: boolean
          id?: string
          shift_type?: string
          standard_key?: string
          task_name?: string
        }
        Relationships: []
      }
      shift_task_templates: {
        Row: {
          count_label: string | null
          count_target: number | null
          created_at: string | null
          has_count: boolean
          id: string
          is_active: boolean
          shift_type: string
          standard_key: string
          task_name: string
          task_order: number
        }
        Insert: {
          count_label?: string | null
          count_target?: number | null
          created_at?: string | null
          has_count?: boolean
          id?: string
          is_active?: boolean
          shift_type: string
          standard_key?: string
          task_name: string
          task_order: number
        }
        Update: {
          count_label?: string | null
          count_target?: number | null
          created_at?: string | null
          has_count?: boolean
          id?: string
          is_active?: boolean
          shift_type?: string
          standard_key?: string
          task_name?: string
          task_order?: number
        }
        Relationships: []
      }
      soml_config: {
        Row: {
          end_date: string
          id: number
          referral_leads_goal: number
          referrals_goal: number
          sales_goal: number
          start_date: string
          updated_at: string
          updated_by: string | null
          upgrades_goal: number
        }
        Insert: {
          end_date: string
          id?: number
          referral_leads_goal?: number
          referrals_goal?: number
          sales_goal?: number
          start_date: string
          updated_at?: string
          updated_by?: string | null
          upgrades_goal?: number
        }
        Update: {
          end_date?: string
          id?: number
          referral_leads_goal?: number
          referrals_goal?: number
          sales_goal?: number
          start_date?: string
          updated_at?: string
          updated_by?: string | null
          upgrades_goal?: number
        }
        Relationships: []
      }
      soml_manual_referrals: {
        Row: {
          created_at: string
          created_by: string
          id: string
          member_name: string
          notes: string | null
          referred_at: string
          referred_by: string
          referring_member_name: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          member_name: string
          notes?: string | null
          referred_at?: string
          referred_by: string
          referring_member_name?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          member_name?: string
          notes?: string | null
          referred_at?: string
          referred_by?: string
          referring_member_name?: string | null
        }
        Relationships: []
      }
      soml_pending_referrals: {
        Row: {
          booking_id: string
          created_at: string
          credited_sa: string
          discount_honored_at: string | null
          discount_honored_by: string | null
          discount_owed_amount_cents: number | null
          discount_owed_contact: string | null
          discount_owed_to: string | null
          id: string
          realized_at: string | null
          referring_member: string
          resolved_outcome: string | null
          state: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          credited_sa: string
          discount_honored_at?: string | null
          discount_honored_by?: string | null
          discount_owed_amount_cents?: number | null
          discount_owed_contact?: string | null
          discount_owed_to?: string | null
          id?: string
          realized_at?: string | null
          referring_member: string
          resolved_outcome?: string | null
          state?: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          credited_sa?: string
          discount_honored_at?: string | null
          discount_honored_by?: string | null
          discount_owed_amount_cents?: number | null
          discount_owed_contact?: string | null
          discount_owed_to?: string | null
          id?: string
          realized_at?: string | null
          referring_member?: string
          resolved_outcome?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "soml_pending_referrals_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "intros_booked"
            referencedColumns: ["id"]
          },
        ]
      }
      soml_sa_goals: {
        Row: {
          created_at: string
          id: string
          referral_leads_goal: number | null
          referrals_goal: number | null
          sa_name: string
          sales_goal: number | null
          updated_at: string
          updated_by: string | null
          upgrades_goal: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          referral_leads_goal?: number | null
          referrals_goal?: number | null
          sa_name: string
          sales_goal?: number | null
          updated_at?: string
          updated_by?: string | null
          upgrades_goal?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          referral_leads_goal?: number | null
          referrals_goal?: number | null
          sa_name?: string
          sales_goal?: number | null
          updated_at?: string
          updated_by?: string | null
          upgrades_goal?: number | null
        }
        Relationships: []
      }
      soml_upgrades: {
        Row: {
          created_at: string
          created_by: string
          id: string
          member_name: string
          notes: string | null
          upgraded_at: string
          upgraded_by: string
          upgraded_to_tier: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          member_name: string
          notes?: string | null
          upgraded_at?: string
          upgraded_by: string
          upgraded_to_tier?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          member_name?: string
          notes?: string | null
          upgraded_at?: string
          upgraded_by?: string
          upgraded_to_tier?: string | null
        }
        Relationships: []
      }
      staff: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          permissions: Json
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          permissions?: Json
          role: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          permissions?: Json
          role?: string
          user_id?: string | null
        }
        Relationships: []
      }
      staff_achievements: {
        Row: {
          badge_key: string
          earned_at: string
          id: string
          metadata: Json | null
          staff_name: string
        }
        Insert: {
          badge_key: string
          earned_at?: string
          id?: string
          metadata?: Json | null
          staff_name: string
        }
        Update: {
          badge_key?: string
          earned_at?: string
          id?: string
          metadata?: Json | null
          staff_name?: string
        }
        Relationships: []
      }
      sticky_note_comments: {
        Row: {
          author: string
          content: string
          created_at: string
          id: string
          note_id: string
        }
        Insert: {
          author: string
          content: string
          created_at?: string
          id?: string
          note_id: string
        }
        Update: {
          author?: string
          content?: string
          created_at?: string
          id?: string
          note_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sticky_note_comments_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "sticky_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      sticky_notes: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          assigned_to: string
          completed_at: string | null
          completed_by: string | null
          content: string
          created_at: string
          created_by: string
          due_date: string | null
          id: string
          priority: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_to: string
          completed_at?: string | null
          completed_by?: string | null
          content: string
          created_at?: string
          created_by: string
          due_date?: string | null
          id?: string
          priority?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_to?: string
          completed_at?: string | null
          completed_by?: string | null
          content?: string
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          priority?: string
        }
        Relationships: []
      }
      studio_intelligence: {
        Row: {
          content_json: Json
          created_at: string
          id: string
          report_date: string
        }
        Insert: {
          content_json?: Json
          created_at?: string
          id?: string
          report_date: string
        }
        Update: {
          content_json?: Json
          created_at?: string
          id?: string
          report_date?: string
        }
        Relationships: []
      }
      studio_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      success_stories: {
        Row: {
          created_at: string
          favorite_aspect: string | null
          featured: boolean | null
          fitness_health_improvement: string | null
          id: string
          member_first_name: string
          member_last_name: string
          membership_duration: string | null
          motivation: string | null
          other_comments: string | null
          overall_experience: string | null
          photo_url: string | null
          proud_moment: string | null
          slug: string | null
          social_media_permission: boolean | null
          specific_changes: string | null
          status: string
          studio_location: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          favorite_aspect?: string | null
          featured?: boolean | null
          fitness_health_improvement?: string | null
          id?: string
          member_first_name?: string
          member_last_name?: string
          membership_duration?: string | null
          motivation?: string | null
          other_comments?: string | null
          overall_experience?: string | null
          photo_url?: string | null
          proud_moment?: string | null
          slug?: string | null
          social_media_permission?: boolean | null
          specific_changes?: string | null
          status?: string
          studio_location?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          favorite_aspect?: string | null
          featured?: boolean | null
          fitness_health_improvement?: string | null
          id?: string
          member_first_name?: string
          member_last_name?: string
          membership_duration?: string | null
          motivation?: string | null
          other_comments?: string | null
          overall_experience?: string | null
          photo_url?: string | null
          proud_moment?: string | null
          slug?: string | null
          social_media_permission?: boolean | null
          specific_changes?: string | null
          status?: string
          studio_location?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      table_action_items: {
        Row: {
          created_at: string
          created_by: string
          description: string
          due_date: string
          id: string
          meeting_id: string
          owner_name: string
          owner_staff_id: string
          source_response_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          description: string
          due_date: string
          id?: string
          meeting_id: string
          owner_name: string
          owner_staff_id: string
          source_response_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string
          id?: string
          meeting_id?: string
          owner_name?: string
          owner_staff_id?: string
          source_response_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "table_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_action_items_owner_staff_id_fkey"
            columns: ["owner_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_action_items_source_response_id_fkey"
            columns: ["source_response_id"]
            isOneToOne: false
            referencedRelation: "table_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      table_closes: {
        Row: {
          created_at: string
          created_by: string
          energy_word: string | null
          id: string
          koa_close_note: string | null
          meeting_id: string
          updated_at: string
          wins_selected: Json
        }
        Insert: {
          created_at?: string
          created_by?: string
          energy_word?: string | null
          id?: string
          koa_close_note?: string | null
          meeting_id: string
          updated_at?: string
          wins_selected?: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          energy_word?: string | null
          id?: string
          koa_close_note?: string | null
          meeting_id?: string
          updated_at?: string
          wins_selected?: Json
        }
        Relationships: [
          {
            foreignKeyName: "table_closes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "table_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      table_meetings: {
        Row: {
          created_at: string
          created_by: string
          id: string
          koa_open_note: string | null
          meeting_date: string
          meeting_time: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          koa_open_note?: string | null
          meeting_date: string
          meeting_time?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          koa_open_note?: string | null
          meeting_date?: string
          meeting_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      table_mentions: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          created_by: string
          excerpt: string | null
          id: string
          matched_lane: string | null
          meeting_id: string | null
          raw_token: string
          responded_at: string | null
          source_id: string
          source_owner_id: string | null
          source_type: string
          tagged_user_name: string
          tagger_user_name: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          created_by?: string
          excerpt?: string | null
          id?: string
          matched_lane?: string | null
          meeting_id?: string | null
          raw_token: string
          responded_at?: string | null
          source_id: string
          source_owner_id?: string | null
          source_type: string
          tagged_user_name: string
          tagger_user_name: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          created_by?: string
          excerpt?: string | null
          id?: string
          matched_lane?: string | null
          meeting_id?: string | null
          raw_token?: string
          responded_at?: string | null
          source_id?: string
          source_owner_id?: string | null
          source_type?: string
          tagged_user_name?: string
          tagger_user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_mentions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "table_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      table_owner_entries: {
        Row: {
          ask: string | null
          commitment: string | null
          created_at: string
          created_by: string
          id: string
          ideas: string | null
          last_week_update: string | null
          meeting_id: string
          owner_id: string
          prior_learning: string | null
          prior_result: string | null
          prior_status: string | null
          serves_wig: string | null
          submitted_at: string | null
          this_week_focus: string | null
          updated_at: string
        }
        Insert: {
          ask?: string | null
          commitment?: string | null
          created_at?: string
          created_by?: string
          id?: string
          ideas?: string | null
          last_week_update?: string | null
          meeting_id: string
          owner_id: string
          prior_learning?: string | null
          prior_result?: string | null
          prior_status?: string | null
          serves_wig?: string | null
          submitted_at?: string | null
          this_week_focus?: string | null
          updated_at?: string
        }
        Update: {
          ask?: string | null
          commitment?: string | null
          created_at?: string
          created_by?: string
          id?: string
          ideas?: string | null
          last_week_update?: string | null
          meeting_id?: string
          owner_id?: string
          prior_learning?: string | null
          prior_result?: string | null
          prior_status?: string | null
          serves_wig?: string | null
          submitted_at?: string | null
          this_week_focus?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_owner_entries_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "table_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_owner_entries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "table_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      table_owners: {
        Row: {
          category: string | null
          created_at: string
          created_by: string
          display_name: string
          id: string
          is_active: boolean
          is_architect: boolean
          lane_name: string | null
          staff_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string
          display_name: string
          id?: string
          is_active?: boolean
          is_architect?: boolean
          lane_name?: string | null
          staff_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string
          display_name?: string
          id?: string
          is_active?: boolean
          is_architect?: boolean
          lane_name?: string | null
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_owners_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      table_responses: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          meeting_id: string
          mode: string
          owner_entry_id: string
          responder_name: string
          responder_staff_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string
          id?: string
          meeting_id: string
          mode: string
          owner_entry_id: string
          responder_name: string
          responder_staff_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          meeting_id?: string
          mode?: string
          owner_entry_id?: string
          responder_name?: string
          responder_staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "table_responses_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "table_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_responses_owner_entry_id_fkey"
            columns: ["owner_entry_id"]
            isOneToOne: false
            referencedRelation: "table_owner_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_responses_responder_staff_id_fkey"
            columns: ["responder_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      table_wins: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          included_in_close: boolean
          meeting_week: string
          owner_id: string | null
          owner_name: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string
          id?: string
          included_in_close?: boolean
          meeting_week: string
          owner_id?: string | null
          owner_name: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          included_in_close?: boolean
          meeting_week?: string
          owner_id?: string | null
          owner_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_wins_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "table_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      team_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender?: string
        }
        Relationships: []
      }
      ten_x_ideas: {
        Row: {
          created_at: string
          id: string
          idea_text: string
          participant_name: string
          participant_role: string
          session_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          idea_text?: string
          participant_name: string
          participant_role?: string
          session_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          idea_text?: string
          participant_name?: string
          participant_role?: string
          session_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ten_x_ideas_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ten_x_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ten_x_sessions: {
        Row: {
          created_at: string
          created_by: string
          goal: string
          id: string
          session_date: string
        }
        Insert: {
          created_at?: string
          created_by: string
          goal: string
          id?: string
          session_date?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          goal?: string
          id?: string
          session_date?: string
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
      vip_registrations: {
        Row: {
          attending_class: boolean
          birthday: string | null
          booking_id: string | null
          commission_amount: number | null
          converted_to_booking_id: string | null
          converted_to_run_id: string | null
          created_at: string
          email: string | null
          first_name: string | null
          fitness_level: number | null
          id: string
          injuries: string | null
          is_group_contact: boolean
          last_name: string | null
          membership_type: string | null
          mindbody_imported_at: string | null
          mindbody_imported_by: string | null
          outcome: string | null
          outcome_logged_at: string | null
          outcome_logged_by: string | null
          outcome_notes: string | null
          phone: string | null
          purchased_at: string | null
          vip_class_name: string | null
          vip_member_id: string | null
          vip_session_id: string | null
          weight_lbs: number | null
        }
        Insert: {
          attending_class?: boolean
          birthday?: string | null
          booking_id?: string | null
          commission_amount?: number | null
          converted_to_booking_id?: string | null
          converted_to_run_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          fitness_level?: number | null
          id?: string
          injuries?: string | null
          is_group_contact?: boolean
          last_name?: string | null
          membership_type?: string | null
          mindbody_imported_at?: string | null
          mindbody_imported_by?: string | null
          outcome?: string | null
          outcome_logged_at?: string | null
          outcome_logged_by?: string | null
          outcome_notes?: string | null
          phone?: string | null
          purchased_at?: string | null
          vip_class_name?: string | null
          vip_member_id?: string | null
          vip_session_id?: string | null
          weight_lbs?: number | null
        }
        Update: {
          attending_class?: boolean
          birthday?: string | null
          booking_id?: string | null
          commission_amount?: number | null
          converted_to_booking_id?: string | null
          converted_to_run_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          fitness_level?: number | null
          id?: string
          injuries?: string | null
          is_group_contact?: boolean
          last_name?: string | null
          membership_type?: string | null
          mindbody_imported_at?: string | null
          mindbody_imported_by?: string | null
          outcome?: string | null
          outcome_logged_at?: string | null
          outcome_logged_by?: string | null
          outcome_notes?: string | null
          phone?: string | null
          purchased_at?: string | null
          vip_class_name?: string | null
          vip_member_id?: string | null
          vip_session_id?: string | null
          weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vip_registrations_vip_session_id_fkey"
            columns: ["vip_session_id"]
            isOneToOne: false
            referencedRelation: "vip_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      vip_sessions: {
        Row: {
          actual_attendance: number | null
          archived_at: string | null
          attendance_logged_at: string | null
          attendance_logged_by: string | null
          business_sub_type: string | null
          capacity: number
          coach_name: string | null
          contact_attending_class: boolean
          contact_outcome: string | null
          contact_outcome_logged_at: string | null
          contact_outcome_logged_by: string | null
          created_at: string
          created_by: string
          description: string | null
          estimated_group_size: number | null
          id: string
          is_on_availability_page: boolean
          referring_member_name: string | null
          reserved_by_group: string | null
          reserved_contact_email: string | null
          reserved_contact_name: string | null
          reserved_contact_phone: string | null
          sa_setup_name: string | null
          session_date: string
          session_label: string | null
          session_time: string
          session_type: string
          shareable_slug: string | null
          status: string
          vip_class_name: string
        }
        Insert: {
          actual_attendance?: number | null
          archived_at?: string | null
          attendance_logged_at?: string | null
          attendance_logged_by?: string | null
          business_sub_type?: string | null
          capacity?: number
          coach_name?: string | null
          contact_attending_class?: boolean
          contact_outcome?: string | null
          contact_outcome_logged_at?: string | null
          contact_outcome_logged_by?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          estimated_group_size?: number | null
          id?: string
          is_on_availability_page?: boolean
          referring_member_name?: string | null
          reserved_by_group?: string | null
          reserved_contact_email?: string | null
          reserved_contact_name?: string | null
          reserved_contact_phone?: string | null
          sa_setup_name?: string | null
          session_date: string
          session_label?: string | null
          session_time: string
          session_type?: string
          shareable_slug?: string | null
          status?: string
          vip_class_name: string
        }
        Update: {
          actual_attendance?: number | null
          archived_at?: string | null
          attendance_logged_at?: string | null
          attendance_logged_by?: string | null
          business_sub_type?: string | null
          capacity?: number
          coach_name?: string | null
          contact_attending_class?: boolean
          contact_outcome?: string | null
          contact_outcome_logged_at?: string | null
          contact_outcome_logged_by?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          estimated_group_size?: number | null
          id?: string
          is_on_availability_page?: boolean
          referring_member_name?: string | null
          reserved_by_group?: string | null
          reserved_contact_email?: string | null
          reserved_contact_name?: string | null
          reserved_contact_phone?: string | null
          sa_setup_name?: string | null
          session_date?: string
          session_label?: string | null
          session_time?: string
          session_type?: string
          shareable_slug?: string | null
          status?: string
          vip_class_name?: string
        }
        Relationships: []
      }
      vip_slot_templates: {
        Row: {
          created_at: string
          day_of_week: number
          id: string
          is_active: boolean
          slot_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          id?: string
          is_active?: boolean
          slot_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          id?: string
          is_active?: boolean
          slot_time?: string
        }
        Relationships: []
      }
      weekly_digests: {
        Row: {
          created_at: string
          id: string
          report_json: Json
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          report_json?: Json
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          report_json?: Json
          week_start?: string
        }
        Relationships: []
      }
      win_the_day_reflections: {
        Row: {
          booking_id: string | null
          created_at: string
          id: string
          reflection_date: string
          reflection_type: string
          result: string
          sa_name: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          id?: string
          reflection_date?: string
          reflection_type: string
          result: string
          sa_name: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          id?: string
          reflection_date?: string
          reflection_type?: string
          result?: string
          sa_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      milestone_summary: {
        Row: {
          total_birthdays: number | null
          total_deploy_converted: number | null
          total_deployed: number | null
          total_friends_added_to_pipeline: number | null
          total_milestones_celebrated: number | null
          total_packs_gifted: number | null
        }
        Relationships: []
      }
      sa_wig_summary: {
        Row: {
          avg_tasks_completed_per_shift: number | null
          close_rate: number | null
          intros_booked_count: number | null
          referral_ask_rate: number | null
          sa_name: string | null
          show_rate: number | null
          total_dms_sent: number | null
          total_shifts_worked: number | null
          total_texts_sent: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_pending_net_gain_churns: { Args: never; Returns: Json }
      backfill_booking_phones: { Args: { p_days_back?: number }; Returns: Json }
      backfill_questionnaire_slugs: { Args: never; Returns: Json }
      gen_intro_friend_code: { Args: { _id: string }; Returns: string }
      get_staff_name: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated_staff: { Args: { _user_id: string }; Returns: boolean }
      map_run_result_to_booking_status: {
        Args: { _result: string }
        Returns: string
      }
      net_gain_write_delta: {
        Args: {
          p_changed_by: string
          p_delta: number
          p_note: string
          p_source_id: string
          p_source_type: string
        }
        Returns: number
      }
      process_own_it_mentions: {
        Args: {
          p_meeting_id: string
          p_source_id: string
          p_source_owner_id: string
          p_source_type: string
          p_tagger: string
          p_text: string
        }
        Returns: undefined
      }
      reconcile_questionnaire_statuses: { Args: never; Returns: Json }
      soml_booking_qualifies_as_referral: {
        Args: { _booking_id: string }
        Returns: boolean
      }
      soml_chain_root_booking_id: {
        Args: { _booking_id: string }
        Returns: string
      }
      soml_create_pending_referral_for_booking: {
        Args: { _booking_id: string }
        Returns: undefined
      }
      to_intro_time_canonical: { Args: { p: string }; Returns: string }
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
