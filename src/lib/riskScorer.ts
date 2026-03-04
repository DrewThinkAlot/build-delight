import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────

export interface RiskScoreInput {
  coc_type: string;
  guidance_number: number;
  msrp_at_open: number | null;
  total_weeks: number | null;
  state: string;
  physician_full_time: boolean;
  physician_has_strong_patient_relationships: boolean;
  physician_comfortable_discussing_fees: boolean;
  physician_engagement_level: string;
  partner_group_aligned: boolean;
  medicaid_pct: number | null;
  medicare_dual_pct: number | null;
  pre_survey_patients: number | null;
  pre_survey_over_55: number | null;
  specialty?: string;
}

export interface WeightData {
  weight: number;
  hit_rate?: number | null;
  hit_rate_absent?: number | null;
  risk_delta?: number | null;
  n?: number;
  n_absent?: number;
  significant?: boolean;
  qualitative?: boolean;
  description?: string;
  rationale?: string;
  states?: string[];
  details?: Record<string, { hit_rate: number; n: number }>;
}

export type Weights = Record<string, WeightData>;

export interface Benchmarks {
  overall_hit_rate: number;
  n_transitions: number;
  avg_pct_to_guidance: number;
  avg_yield_hit: number;
  avg_yield_missed: number;
  avg_post_open_growth: number;
  recovery_rate_near_miss: number;
  hit_rate_by_coc: Record<string, { rate: number; n: number }>;
  hit_rate_by_size: Record<string, { max: number; rate: number; n: number }>;
  hit_rate_by_msrp: Record<string, { rate: number; n: number }>;
  hit_rate_by_state: Record<string, { rate: number; n: number }>;
  hit_rate_by_month: Record<string, { rate: number; n: number }>;
}

export interface RiskFactor {
  id: string;
  label: string;
  points: number;
  hit_rate: number | null;
  n: number;
  significant: boolean;
  qualitative: boolean;
  confidence: 'high' | 'low' | 'qualitative';
}

export interface RiskScoreResult {
  score: number;
  tier: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  factors: RiskFactor[];
  calibration_date: string;
  n_historical: number;
}

export interface ActiveWeightsResult {
  weights: Weights;
  benchmarks: Benchmarks;
  calibrationDate: string;
  nTransitions: number;
}

export interface BenchmarkComparison {
  label: string;
  hit_rate: number;
  n: number;
}

// ── Cache ──────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cachedWeights: ActiveWeightsResult | null = null;
let cacheTimestamp = 0;

export function clearWeightsCache() {
  cachedWeights = null;
  cacheTimestamp = 0;
}

// ── Default fallback (FY26 seed) ───────────────────────────────────────

const DEFAULT_WEIGHTS: Weights = {
  coc_out: { weight: 15, hit_rate: 0.64, hit_rate_absent: 0.80, risk_delta: 0.16, n: 38, n_absent: 25, significant: true, description: 'COC Out (patients must leave current practice)' },
  small_guidance: { weight: 6, hit_rate: 0.69, hit_rate_absent: 0.72, risk_delta: 0.03, n: 16, n_absent: 52, significant: true, description: 'Small guidance target (≤125 patients)' },
  msrp_very_high: { weight: 14, hit_rate: 0.62, hit_rate_absent: 0.73, risk_delta: 0.11, n: 13, n_absent: 55, significant: true, description: 'MSRP above $2,700' },
  msrp_high: { weight: 5, hit_rate: 0.69, hit_rate_absent: 0.72, risk_delta: 0.03, n: 17, n_absent: 51, significant: true, description: 'MSRP $2,500–$2,700' },
  short_transition: { weight: 15, n: 0, significant: false, qualitative: true, description: 'Very short transition (≤12 weeks)' },
  medium_transition: { weight: 8, n: 0, significant: false, qualitative: true, description: 'Short transition (13–16 weeks)' },
  high_risk_state: { weight: 10, states: ['PA', 'NJ'], significant: true, description: 'High-risk state' },
  moderate_risk_state: { weight: 5, states: ['CA', 'NY'], significant: false, description: 'Moderate-risk state' },
  physician_part_time: { weight: 10, n: 0, significant: false, qualitative: true, description: 'Part-time physician' },
  weak_patient_relationships: { weight: 12, n: 0, significant: false, qualitative: true, description: 'Weak physician-patient relationships' },
  fee_discomfort: { weight: 8, n: 0, significant: false, qualitative: true, description: 'Physician uncomfortable discussing fees' },
  low_engagement: { weight: 10, n: 0, significant: false, qualitative: true, description: 'Low physician engagement at start' },
  partner_misaligned: { weight: 15, n: 0, significant: false, qualitative: true, description: 'Partner/group practice not aligned with transition' },
  high_medicaid: { weight: 20, n: 0, significant: false, qualitative: true, description: 'High Medicaid population (>30%)' },
  moderate_medicaid: { weight: 10, n: 0, significant: false, qualitative: true, description: 'Moderate Medicaid population (15–30%)' },
  high_dual_eligible: { weight: 20, n: 0, significant: false, qualitative: true, description: 'High Medicare dual-eligible population (>30%)' },
  low_55_plus: { weight: 8, n: 0, significant: false, qualitative: true, description: 'Under 50% of patient panel is 55+' },
};

const DEFAULT_BENCHMARKS: Benchmarks = {
  overall_hit_rate: 0.71, n_transitions: 68, avg_pct_to_guidance: 1.10,
  avg_yield_hit: 0.1893, avg_yield_missed: 0.0912, avg_post_open_growth: 22,
  recovery_rate_near_miss: 0.09,
  hit_rate_by_coc: { 'FM COC In': { rate: 0.85, n: 13 }, 'FM COC Out': { rate: 0.61, n: 23 }, 'IM COC In': { rate: 0.75, n: 12 }, 'IM COC Out': { rate: 0.67, n: 15 }, 'Specialty': { rate: 1.00, n: 4 } },
  hit_rate_by_size: { small: { max: 125, rate: 0.69, n: 16 }, medium: { max: 250, rate: 0.73, n: 26 }, large: { max: 400, rate: 0.69, n: 26 } },
  hit_rate_by_msrp: { under_2200: { rate: 0.78, n: 9 }, '2200_to_2700': { rate: 0.70, n: 33 }, over_2700: { rate: 0.62, n: 13 } },
  hit_rate_by_state: { TX: { rate: 0.89, n: 9 }, HI: { rate: 1.00, n: 3 }, AL: { rate: 1.00, n: 3 }, FL: { rate: 0.70, n: 10 }, SC: { rate: 0.67, n: 3 }, MO: { rate: 0.67, n: 3 }, NY: { rate: 0.67, n: 3 }, CA: { rate: 0.57, n: 7 }, PA: { rate: 0.33, n: 6 }, NJ: { rate: 0.33, n: 3 } },
  hit_rate_by_month: { July: { rate: 0.20, n: 5 }, August: { rate: 0.50, n: 6 }, September: { rate: 0.75, n: 4 }, October: { rate: 0.86, n: 7 }, November: { rate: 0.82, n: 11 }, December: { rate: 0.77, n: 13 }, January: { rate: 0.58, n: 12 }, February: { rate: 0.90, n: 10 } },
};

// ── getActiveWeights ───────────────────────────────────────────────────

export async function getActiveWeights(): Promise<ActiveWeightsResult> {
  if (cachedWeights && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedWeights;
  }

  try {
    const { data, error } = await supabase
      .from('risk_weights')
      .select('*')
      .eq('is_active', true)
      .order('calibration_date', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.warn('No active risk weights found, using defaults');
      return fallbackWeights();
    }

    const result: ActiveWeightsResult = {
      weights: (data.weights as unknown as Weights) ?? DEFAULT_WEIGHTS,
      benchmarks: (data.benchmarks as unknown as Benchmarks) ?? DEFAULT_BENCHMARKS,
      calibrationDate: data.calibration_date,
      nTransitions: data.n_transitions,
    };

    cachedWeights = result;
    cacheTimestamp = Date.now();
    return result;
  } catch (err) {
    console.error('Error fetching risk weights:', err);
    return fallbackWeights();
  }
}

function fallbackWeights(): ActiveWeightsResult {
  const result: ActiveWeightsResult = {
    weights: DEFAULT_WEIGHTS,
    benchmarks: DEFAULT_BENCHMARKS,
    calibrationDate: '2026-03-02T00:00:00Z',
    nTransitions: 68,
  };
  cachedWeights = result;
  cacheTimestamp = Date.now();
  return result;
}

// ── calculateRiskScore ─────────────────────────────────────────────────

export function calculateRiskScore(input: RiskScoreInput, weights: Weights): RiskScoreResult {
  const factors: RiskFactor[] = [];

  const checks: { id: string; condition: boolean }[] = [
    { id: 'coc_out', condition: input.coc_type === 'COC Out' || (!!input.coc_type && input.coc_type.includes('COC Out')) },
    { id: 'small_guidance', condition: input.guidance_number <= 125 },
    { id: 'msrp_very_high', condition: input.msrp_at_open != null && input.msrp_at_open > 2700 },
    { id: 'msrp_high', condition: input.msrp_at_open != null && input.msrp_at_open > 2500 && input.msrp_at_open <= 2700 },
    { id: 'short_transition', condition: input.total_weeks != null && input.total_weeks <= 12 },
    { id: 'medium_transition', condition: input.total_weeks != null && input.total_weeks > 12 && input.total_weeks <= 16 },
    { id: 'high_risk_state', condition: !!weights.high_risk_state?.states?.includes(input.state) },
    { id: 'moderate_risk_state', condition: !!weights.moderate_risk_state?.states?.includes(input.state) },
    { id: 'physician_part_time', condition: input.physician_full_time === false },
    { id: 'weak_patient_relationships', condition: input.physician_has_strong_patient_relationships === false },
    { id: 'fee_discomfort', condition: input.physician_comfortable_discussing_fees === false },
    { id: 'low_engagement', condition: input.physician_engagement_level === 'Low' },
    { id: 'partner_misaligned', condition: input.partner_group_aligned === false },
    { id: 'high_medicaid', condition: input.medicaid_pct != null && input.medicaid_pct > 0.30 },
    { id: 'moderate_medicaid', condition: input.medicaid_pct != null && input.medicaid_pct > 0.15 && input.medicaid_pct <= 0.30 },
    { id: 'high_dual_eligible', condition: input.medicare_dual_pct != null && input.medicare_dual_pct > 0.30 },
    { id: 'low_55_plus', condition: input.pre_survey_patients != null && input.pre_survey_patients > 0 && input.pre_survey_over_55 != null && (input.pre_survey_over_55 / input.pre_survey_patients) < 0.50 },
  ];

  let score = 0;

  for (const check of checks) {
    const wd = weights[check.id];
    if (check.condition && wd) {
      const points = wd.weight;
      score += points;
      factors.push({
        id: check.id,
        label: wd.description || check.id,
        points,
        hit_rate: wd.hit_rate ?? null,
        n: wd.n ?? 0,
        significant: wd.significant ?? false,
        qualitative: wd.qualitative ?? false,
        confidence: wd.significant ? 'high' : wd.qualitative ? 'qualitative' : 'low',
      });
    }
  }

  score = Math.min(score, 100);

  const tier = score <= 20 ? 'LOW' : score <= 40 ? 'MODERATE' : score <= 60 ? 'HIGH' : 'CRITICAL';

  return {
    score,
    tier,
    factors: factors.sort((a, b) => b.points - a.points),
    calibration_date: '',
    n_historical: 0,
  };
}

// ── getSimilarTransitions ──────────────────────────────────────────────

export function getSimilarTransitions(input: RiskScoreInput, benchmarks: Benchmarks): BenchmarkComparison[] {
  const comparisons: BenchmarkComparison[] = [];

  // COC type benchmark
  const isFamily = input.specialty?.includes('Family');
  const cocKey = input.coc_type?.includes('COC Out')
    ? (isFamily ? 'FM COC Out' : 'IM COC Out')
    : (isFamily ? 'FM COC In' : 'IM COC In');
  const cocBench = benchmarks.hit_rate_by_coc?.[cocKey];
  if (cocBench) {
    comparisons.push({ label: `${cocKey} transitions`, hit_rate: cocBench.rate, n: cocBench.n });
  }

  // Size bracket
  const sizeBracket = input.guidance_number <= 125 ? 'small' : input.guidance_number <= 250 ? 'medium' : 'large';
  const sizeBench = benchmarks.hit_rate_by_size?.[sizeBracket];
  if (sizeBench) {
    comparisons.push({ label: `${sizeBracket} transitions (≤${sizeBench.max})`, hit_rate: sizeBench.rate, n: sizeBench.n });
  }

  // State
  const stateBench = benchmarks.hit_rate_by_state?.[input.state];
  if (stateBench) {
    comparisons.push({ label: `${input.state} transitions`, hit_rate: stateBench.rate, n: stateBench.n });
  }

  return comparisons;
}
