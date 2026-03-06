export interface Transition {
  id: string;
  physician_name: string;
  physician_id?: string;
  transition_start: string;
  opening_date: string;
  guidance_number: number;
  be_best_practice?: number;
  msrp_at_open?: number;
  pre_survey_patients?: number;
  pre_survey_over_55?: number;
  post_survey_patients?: number;
  wtc_55_plus?: number;
  segmentation?: string;
  coc_type?: string;
  specialty?: string;
  state?: string;
  city?: string;
  medicaid_pct?: number;
  medicare_dual_pct?: number;
  physician_engagement_level?: string;
  physician_full_time: boolean;
  physician_has_strong_patient_relationships: boolean;
  physician_comfortable_discussing_fees: boolean;
  partner_group_aligned: boolean;
  assigned_pa?: string;
  assigned_ptm?: string;
  status: 'active' | 'completed' | 'mea_culpa';
  risk_score?: number;
  risk_tier?: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  total_weeks?: number;
  current_paid_members?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CoachingLog {
  id: string;
  transition_id: string;
  log_date: string;
  interaction_type: string;
  duration_minutes?: number;
  topics_covered?: string;
  commitments_made?: string;
  your_action_items?: string;
  physician_mood?: string;
  confidence_level?: number;
  follow_up_needed: boolean;
  follow_up_date?: string;
  follow_up_notes?: string;
  followed_through?: boolean;
  created_at?: string;
}

export interface Alert {
  id: string;
  transition_id: string;
  severity: 'MODERATE' | 'HIGH' | 'CRITICAL';
  rule_name: string;
  message: string;
  created_at: string;
}

export type PacingStatus = 'AHEAD' | 'ON_TRACK' | 'BEHIND' | 'CRITICAL';
export type RiskTier = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
