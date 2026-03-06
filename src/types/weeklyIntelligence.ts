// ── Weekly Snapshot (mirrors DB table) ─────────────────────────────────

export interface WeeklySnapshot {
  id: string;
  transition_id: string;
  week_ending_date: string;
  paid_members: number;
  guidance_number: number;
  touches_mer_last_week: number;
  touches_pa_last_week: number | null;
  doctor_calls_last_week: number | null;
  weekly_needed_to_hit_guidance: number | null;
  strategic_activities: string | null;
  notes: string | null;
  strategy_changed: boolean;
  // Extended fields (consolidated from weekly_updates) — all optional/nullable
  pa_effectiveness_rating?: number | null;
  physician_engagement_rating?: number | null;
  staff_engagement_rating?: number | null;
  physician_making_personal_calls?: boolean;
  forums_scheduled?: number;
  forums_held?: number;
  forum_attendance?: number | null;
  pa_swap_considered?: boolean;
  pa_swap_executed?: boolean;
  primary_obstacle?: string | null;
  obstacle_category?: string | null;
  what_worked_this_week?: string | null;
  what_didnt_work?: string | null;
  survey_prospects_left_pct?: number | null;
  wtc_remaining?: number | null;
  pacing_status?: string | null;
  week_number?: number | null;
  created_at: string;
  updated_at: string;
}

// ── Computed Metrics ──────────────────────────────────────────────────

export interface WeeklyMetrics {
  pace_to_guidance: number;
  weeks_to_opening: number;
  wow_change: number;
  rolling_2wk: number;
  rolling_3wk: number;
  rolling_4wk: number;
  growth_slope_4wk: number;
  projected_paid_at_opening: number;
  projected_pace_at_opening: number;
  effort_to_growth_ratio: number;
}

// ── Signals ───────────────────────────────────────────────────────────

export interface Signal {
  key: string;
  title: string;
  severity: 'green' | 'yellow' | 'red';
  reason: string;
  numbers: Record<string, number | string>;
}

// ── Recommendations ───────────────────────────────────────────────────

export interface Recommendation {
  key: string;
  title: string;
  priority: number; // 1 = highest
  why: string;
  how: string;
}

// ── Thresholds (mirrors DB table) ─────────────────────────────────────

export interface WeeklyThresholds {
  behind_pace_thresholds: Record<string, number>;
  min_touches: number;
  stalling_wow_threshold: number;
}

export const DEFAULT_THRESHOLDS: WeeklyThresholds = {
  behind_pace_thresholds: {
    '0_4': 0.85,
    '5_8': 0.75,
    '9_12': 0.65,
    '13_plus': 0.55,
  },
  min_touches: 8,
  stalling_wow_threshold: 0,
};

// ── Action Completion ─────────────────────────────────────────────────

export interface ActionCompletion {
  id: string;
  transition_id: string;
  week_ending_date: string;
  action_key: string;
  completed_at: string;
}

// ── Composite result for a single transition ──────────────────────────

export interface TransitionIntelligence {
  transitionId: string;
  snapshots: WeeklySnapshot[];
  metrics: WeeklyMetrics | null;
  signals: Signal[];
  recommendations: Recommendation[];
  completions: ActionCompletion[];
}
