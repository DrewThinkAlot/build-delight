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
