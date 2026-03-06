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
      action_completions: {
        Row: {
          action_key: string
          completed_at: string | null
          id: string
          transition_id: string
          user_id: string | null
          week_ending_date: string
        }
        Insert: {
          action_key: string
          completed_at?: string | null
          id?: string
          transition_id: string
          user_id?: string | null
          week_ending_date: string
        }
        Update: {
          action_key?: string
          completed_at?: string | null
          id?: string
          transition_id?: string
          user_id?: string | null
          week_ending_date?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          message: string
          rule_name: string
          severity: string
          transition_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          message: string
          rule_name: string
          severity: string
          transition_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          message?: string
          rule_name?: string
          severity?: string
          transition_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_transition_id_fkey"
            columns: ["transition_id"]
            isOneToOne: false
            referencedRelation: "transitions"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_logs: {
        Row: {
          commitments_made: string | null
          confidence_level: number | null
          created_at: string
          duration_minutes: number | null
          follow_up_date: string | null
          follow_up_needed: boolean | null
          follow_up_notes: string | null
          followed_through: boolean | null
          id: string
          interaction_type: string
          log_date: string
          physician_mood: string | null
          topics_covered: string | null
          transition_id: string
          user_id: string
          your_action_items: string | null
        }
        Insert: {
          commitments_made?: string | null
          confidence_level?: number | null
          created_at?: string
          duration_minutes?: number | null
          follow_up_date?: string | null
          follow_up_needed?: boolean | null
          follow_up_notes?: string | null
          followed_through?: boolean | null
          id?: string
          interaction_type: string
          log_date?: string
          physician_mood?: string | null
          topics_covered?: string | null
          transition_id: string
          user_id: string
          your_action_items?: string | null
        }
        Update: {
          commitments_made?: string | null
          confidence_level?: number | null
          created_at?: string
          duration_minutes?: number | null
          follow_up_date?: string | null
          follow_up_needed?: boolean | null
          follow_up_notes?: string | null
          followed_through?: boolean | null
          id?: string
          interaction_type?: string
          log_date?: string
          physician_mood?: string | null
          topics_covered?: string | null
          transition_id?: string
          user_id?: string
          your_action_items?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coaching_logs_transition_id_fkey"
            columns: ["transition_id"]
            isOneToOne: false
            referencedRelation: "transitions"
            referencedColumns: ["id"]
          },
        ]
      }
      data_imports: {
        Row: {
          error_count: number
          file_name: string
          id: string
          import_date: string
          new_count: number
          sheet_name: string | null
          skipped_count: number
          total_rows: number
          updated_count: number
        }
        Insert: {
          error_count?: number
          file_name: string
          id?: string
          import_date?: string
          new_count?: number
          sheet_name?: string | null
          skipped_count?: number
          total_rows?: number
          updated_count?: number
        }
        Update: {
          error_count?: number
          file_name?: string
          id?: string
          import_date?: string
          new_count?: number
          sheet_name?: string | null
          skipped_count?: number
          total_rows?: number
          updated_count?: number
        }
        Relationships: []
      }
      historical_transitions: {
        Row: {
          actual_yield: number | null
          city: string | null
          coc_type: string | null
          created_at: string
          data_vintage: string | null
          expected_yield: number | null
          fiscal_month: string | null
          guidance_number: number | null
          hit_guidance: boolean | null
          id: string
          import_date: string
          msrp_at_open: number | null
          opening_balance: number | null
          opening_date: string | null
          paid_members_current: number | null
          pct_to_guidance: number | null
          physician_id: string | null
          physician_name: string
          post_open_growth: number | null
          post_survey_patients: number | null
          pre_survey_over_55: number | null
          pre_survey_patients: number | null
          segmentation: string | null
          source_file: string | null
          state: string | null
          total_weeks: number | null
          updated_at: string
          wtc_55_plus: number | null
        }
        Insert: {
          actual_yield?: number | null
          city?: string | null
          coc_type?: string | null
          created_at?: string
          data_vintage?: string | null
          expected_yield?: number | null
          fiscal_month?: string | null
          guidance_number?: number | null
          hit_guidance?: boolean | null
          id?: string
          import_date?: string
          msrp_at_open?: number | null
          opening_balance?: number | null
          opening_date?: string | null
          paid_members_current?: number | null
          pct_to_guidance?: number | null
          physician_id?: string | null
          physician_name: string
          post_open_growth?: number | null
          post_survey_patients?: number | null
          pre_survey_over_55?: number | null
          pre_survey_patients?: number | null
          segmentation?: string | null
          source_file?: string | null
          state?: string | null
          total_weeks?: number | null
          updated_at?: string
          wtc_55_plus?: number | null
        }
        Update: {
          actual_yield?: number | null
          city?: string | null
          coc_type?: string | null
          created_at?: string
          data_vintage?: string | null
          expected_yield?: number | null
          fiscal_month?: string | null
          guidance_number?: number | null
          hit_guidance?: boolean | null
          id?: string
          import_date?: string
          msrp_at_open?: number | null
          opening_balance?: number | null
          opening_date?: string | null
          paid_members_current?: number | null
          pct_to_guidance?: number | null
          physician_id?: string | null
          physician_name?: string
          post_open_growth?: number | null
          post_survey_patients?: number | null
          pre_survey_over_55?: number | null
          pre_survey_patients?: number | null
          segmentation?: string | null
          source_file?: string | null
          state?: string | null
          total_weeks?: number | null
          updated_at?: string
          wtc_55_plus?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      risk_weights: {
        Row: {
          benchmarks: Json
          calibration_date: string
          calibration_label: string | null
          created_at: string
          id: string
          is_active: boolean
          n_hit: number
          n_missed: number
          n_transitions: number
          overall_hit_rate: number | null
          weights: Json
        }
        Insert: {
          benchmarks?: Json
          calibration_date?: string
          calibration_label?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          n_hit?: number
          n_missed?: number
          n_transitions?: number
          overall_hit_rate?: number | null
          weights?: Json
        }
        Update: {
          benchmarks?: Json
          calibration_date?: string
          calibration_label?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          n_hit?: number
          n_missed?: number
          n_transitions?: number
          overall_hit_rate?: number | null
          weights?: Json
        }
        Relationships: []
      }
      transitions: {
        Row: {
          assigned_pa: string | null
          assigned_ptm: string | null
          be_best_practice: number | null
          city: string | null
          coc_type: string | null
          created_at: string
          current_paid_members: number | null
          guidance_number: number
          id: string
          medicaid_pct: number | null
          medicare_dual_pct: number | null
          msrp_at_open: number | null
          opening_date: string
          partner_group_aligned: boolean | null
          physician_comfortable_discussing_fees: boolean | null
          physician_engagement_level: string | null
          physician_full_time: boolean | null
          physician_has_strong_patient_relationships: boolean | null
          physician_id: string | null
          physician_name: string
          post_survey_patients: number | null
          pre_survey_over_55: number | null
          pre_survey_patients: number | null
          risk_score: number | null
          risk_tier: string | null
          segmentation: string | null
          specialty: string | null
          state: string | null
          status: string
          total_weeks: number | null
          transition_start: string
          updated_at: string
          user_id: string
          wtc_55_plus: number | null
        }
        Insert: {
          assigned_pa?: string | null
          assigned_ptm?: string | null
          be_best_practice?: number | null
          city?: string | null
          coc_type?: string | null
          created_at?: string
          current_paid_members?: number | null
          guidance_number: number
          id?: string
          medicaid_pct?: number | null
          medicare_dual_pct?: number | null
          msrp_at_open?: number | null
          opening_date: string
          partner_group_aligned?: boolean | null
          physician_comfortable_discussing_fees?: boolean | null
          physician_engagement_level?: string | null
          physician_full_time?: boolean | null
          physician_has_strong_patient_relationships?: boolean | null
          physician_id?: string | null
          physician_name: string
          post_survey_patients?: number | null
          pre_survey_over_55?: number | null
          pre_survey_patients?: number | null
          risk_score?: number | null
          risk_tier?: string | null
          segmentation?: string | null
          specialty?: string | null
          state?: string | null
          status?: string
          total_weeks?: number | null
          transition_start: string
          updated_at?: string
          user_id: string
          wtc_55_plus?: number | null
        }
        Update: {
          assigned_pa?: string | null
          assigned_ptm?: string | null
          be_best_practice?: number | null
          city?: string | null
          coc_type?: string | null
          created_at?: string
          current_paid_members?: number | null
          guidance_number?: number
          id?: string
          medicaid_pct?: number | null
          medicare_dual_pct?: number | null
          msrp_at_open?: number | null
          opening_date?: string
          partner_group_aligned?: boolean | null
          physician_comfortable_discussing_fees?: boolean | null
          physician_engagement_level?: string | null
          physician_full_time?: boolean | null
          physician_has_strong_patient_relationships?: boolean | null
          physician_id?: string | null
          physician_name?: string
          post_survey_patients?: number | null
          pre_survey_over_55?: number | null
          pre_survey_patients?: number | null
          risk_score?: number | null
          risk_tier?: string | null
          segmentation?: string | null
          specialty?: string | null
          state?: string | null
          status?: string
          total_weeks?: number | null
          transition_start?: string
          updated_at?: string
          user_id?: string
          wtc_55_plus?: number | null
        }
        Relationships: []
      }
      weekly_snapshots: {
        Row: {
          created_at: string | null
          doctor_calls_last_week: number | null
          forum_attendance: number | null
          forums_held: number | null
          forums_scheduled: number | null
          guidance_number: number
          id: string
          notes: string | null
          obstacle_category: string | null
          pa_effectiveness_rating: number | null
          pa_swap_considered: boolean | null
          pa_swap_executed: boolean | null
          pacing_status: string | null
          paid_members: number
          physician_engagement_rating: number | null
          physician_making_personal_calls: boolean | null
          primary_obstacle: string | null
          staff_engagement_rating: number | null
          strategic_activities: string | null
          strategy_changed: boolean | null
          survey_prospects_left_pct: number | null
          touches_mer_last_week: number | null
          touches_pa_last_week: number | null
          transition_id: string
          updated_at: string | null
          user_id: string | null
          week_ending_date: string
          week_number: number | null
          weekly_needed_to_hit_guidance: number | null
          what_didnt_work: string | null
          what_worked_this_week: string | null
          wtc_remaining: number | null
        }
        Insert: {
          created_at?: string | null
          doctor_calls_last_week?: number | null
          forum_attendance?: number | null
          forums_held?: number | null
          forums_scheduled?: number | null
          guidance_number: number
          id?: string
          notes?: string | null
          obstacle_category?: string | null
          pa_effectiveness_rating?: number | null
          pa_swap_considered?: boolean | null
          pa_swap_executed?: boolean | null
          pacing_status?: string | null
          paid_members?: number
          physician_engagement_rating?: number | null
          physician_making_personal_calls?: boolean | null
          primary_obstacle?: string | null
          staff_engagement_rating?: number | null
          strategic_activities?: string | null
          strategy_changed?: boolean | null
          survey_prospects_left_pct?: number | null
          touches_mer_last_week?: number | null
          touches_pa_last_week?: number | null
          transition_id: string
          updated_at?: string | null
          user_id?: string | null
          week_ending_date: string
          week_number?: number | null
          weekly_needed_to_hit_guidance?: number | null
          what_didnt_work?: string | null
          what_worked_this_week?: string | null
          wtc_remaining?: number | null
        }
        Update: {
          created_at?: string | null
          doctor_calls_last_week?: number | null
          forum_attendance?: number | null
          forums_held?: number | null
          forums_scheduled?: number | null
          guidance_number?: number
          id?: string
          notes?: string | null
          obstacle_category?: string | null
          pa_effectiveness_rating?: number | null
          pa_swap_considered?: boolean | null
          pa_swap_executed?: boolean | null
          pacing_status?: string | null
          paid_members?: number
          physician_engagement_rating?: number | null
          physician_making_personal_calls?: boolean | null
          primary_obstacle?: string | null
          staff_engagement_rating?: number | null
          strategic_activities?: string | null
          strategy_changed?: boolean | null
          survey_prospects_left_pct?: number | null
          touches_mer_last_week?: number | null
          touches_pa_last_week?: number | null
          transition_id?: string
          updated_at?: string | null
          user_id?: string | null
          week_ending_date?: string
          week_number?: number | null
          weekly_needed_to_hit_guidance?: number | null
          what_didnt_work?: string | null
          what_worked_this_week?: string | null
          wtc_remaining?: number | null
        }
        Relationships: []
      }
      weekly_thresholds: {
        Row: {
          behind_pace_thresholds: Json
          id: string
          min_touches: number
          stalling_wow_threshold: number
          updated_at: string | null
        }
        Insert: {
          behind_pace_thresholds?: Json
          id?: string
          min_touches?: number
          stalling_wow_threshold?: number
          updated_at?: string | null
        }
        Update: {
          behind_pace_thresholds?: Json
          id?: string
          min_touches?: number
          stalling_wow_threshold?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      weekly_updates: {
        Row: {
          ai_leadership_talking_points: string | null
          ai_physician_coaching_plan: string | null
          ai_recommended_actions: string | null
          ai_situation_assessment: string | null
          created_at: string
          current_paid_members: number
          expected_members_at_this_point: number | null
          forum_attendance: number | null
          forums_held: number | null
          forums_scheduled: number | null
          id: string
          leadership_update_sent: boolean | null
          members_per_week_needed: number | null
          net_change_from_last_week: number | null
          notes: string | null
          obstacle_category: string | null
          pa_effectiveness_rating: number | null
          pa_swap_considered: boolean | null
          pa_swap_executed: boolean | null
          pacing_status: string | null
          pct_to_guidance: number | null
          physician_coaching_call_completed: boolean | null
          physician_engagement_rating: number | null
          physician_making_personal_calls: boolean | null
          primary_obstacle: string | null
          projected_opening_number: number | null
          ptm_sync_completed: boolean | null
          staff_engagement_rating: number | null
          strategy_change_description: string | null
          strategy_change_made: boolean | null
          survey_prospects_left_pct: number | null
          transition_id: string
          update_date: string
          user_id: string
          week_number: number
          what_didnt_work: string | null
          what_worked_this_week: string | null
          wtc_remaining: number | null
        }
        Insert: {
          ai_leadership_talking_points?: string | null
          ai_physician_coaching_plan?: string | null
          ai_recommended_actions?: string | null
          ai_situation_assessment?: string | null
          created_at?: string
          current_paid_members: number
          expected_members_at_this_point?: number | null
          forum_attendance?: number | null
          forums_held?: number | null
          forums_scheduled?: number | null
          id?: string
          leadership_update_sent?: boolean | null
          members_per_week_needed?: number | null
          net_change_from_last_week?: number | null
          notes?: string | null
          obstacle_category?: string | null
          pa_effectiveness_rating?: number | null
          pa_swap_considered?: boolean | null
          pa_swap_executed?: boolean | null
          pacing_status?: string | null
          pct_to_guidance?: number | null
          physician_coaching_call_completed?: boolean | null
          physician_engagement_rating?: number | null
          physician_making_personal_calls?: boolean | null
          primary_obstacle?: string | null
          projected_opening_number?: number | null
          ptm_sync_completed?: boolean | null
          staff_engagement_rating?: number | null
          strategy_change_description?: string | null
          strategy_change_made?: boolean | null
          survey_prospects_left_pct?: number | null
          transition_id: string
          update_date?: string
          user_id: string
          week_number: number
          what_didnt_work?: string | null
          what_worked_this_week?: string | null
          wtc_remaining?: number | null
        }
        Update: {
          ai_leadership_talking_points?: string | null
          ai_physician_coaching_plan?: string | null
          ai_recommended_actions?: string | null
          ai_situation_assessment?: string | null
          created_at?: string
          current_paid_members?: number
          expected_members_at_this_point?: number | null
          forum_attendance?: number | null
          forums_held?: number | null
          forums_scheduled?: number | null
          id?: string
          leadership_update_sent?: boolean | null
          members_per_week_needed?: number | null
          net_change_from_last_week?: number | null
          notes?: string | null
          obstacle_category?: string | null
          pa_effectiveness_rating?: number | null
          pa_swap_considered?: boolean | null
          pa_swap_executed?: boolean | null
          pacing_status?: string | null
          pct_to_guidance?: number | null
          physician_coaching_call_completed?: boolean | null
          physician_engagement_rating?: number | null
          physician_making_personal_calls?: boolean | null
          primary_obstacle?: string | null
          projected_opening_number?: number | null
          ptm_sync_completed?: boolean | null
          staff_engagement_rating?: number | null
          strategy_change_description?: string | null
          strategy_change_made?: boolean | null
          survey_prospects_left_pct?: number | null
          transition_id?: string
          update_date?: string
          user_id?: string
          week_number?: number
          what_didnt_work?: string | null
          what_worked_this_week?: string | null
          wtc_remaining?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_updates_transition_id_fkey"
            columns: ["transition_id"]
            isOneToOne: false
            referencedRelation: "transitions"
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
