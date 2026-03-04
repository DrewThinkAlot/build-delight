import { supabase } from "@/integrations/supabase/client";
import type { Weights, Benchmarks, RiskScoreInput } from "./riskScorer";
import { calculateRiskScore } from "./riskScorer";

// ── Types ──────────────────────────────────────────────────────────────

export interface HistoricalTransition {
  id: string;
  physician_name: string;
  opening_date: string | null;
  guidance_number: number | null;
  opening_balance: number | null;
  pct_to_guidance: number | null;
  hit_guidance: boolean | null;
  segmentation: string | null;
  coc_type: string | null;
  state: string | null;
  msrp_at_open: number | null;
  total_weeks: number | null;
  expected_yield: number | null;
  actual_yield: number | null;
  pre_survey_patients: number | null;
  pre_survey_over_55: number | null;
  paid_members_current: number | null;
  post_open_growth: number | null;
  fiscal_month: string | null;
  // recency weighting (calculated, not from DB)
  weight: number;
}

export interface FactorAnalysis {
  weight: number;
  hit_rate: number;
  hit_rate_absent: number;
  risk_delta: number;
  n: number;
  n_absent: number;
  significant: boolean;
  qualitative: false;
  description: string;
  confidence: "high" | "low" | "insufficient";
}

export interface QualitativeFactor {
  weight: number;
  hit_rate: null;
  n: 0;
  significant: false;
  qualitative: true;
  description: string;
  rationale: string;
  confidence: "qualitative";
  states?: string[];
  details?: Record<string, { hit_rate: number; n: number }>;
}

export interface WeightChange {
  type: "CHANGED" | "NEW" | "REMOVED" | "UNCHANGED";
  old_weight: number;
  new_weight: number;
  delta: number;
  old_hit_rate: number | null;
  new_hit_rate: number | null;
  old_n: number;
  new_n: number;
  reason: string;
}

export interface RecalibrationSummary {
  n_transitions: number;
  overall_hit_rate: number;
  recency_window_months: number;
  factors_data_driven: number;
  factors_significant: number;
  factors_low_confidence: number;
  factors_qualitative: number;
  factors_changed: number;
  total_risk_factors: number;
}

export interface RecalibrationResult {
  weights: Record<string, FactorAnalysis | QualitativeFactor>;
  benchmarks: Benchmarks;
  summary: RecalibrationSummary;
  weightChanges: Record<string, WeightChange> | null;
  previousCalibrationId: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────

function monthsBetween(d1: Date, d2: Date): number {
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
}

function weightedHitRate(transitions: HistoricalTransition[]): number {
  const totalWeight = transitions.reduce((sum, t) => sum + t.weight, 0);
  if (totalWeight === 0) return 0;
  const hitWeight = transitions
    .filter((t) => t.hit_guidance)
    .reduce((sum, t) => sum + t.weight, 0);
  return hitWeight / totalWeight;
}

function formatPct(val: number | null): string {
  if (val == null) return "N/A";
  return `${(val * 100).toFixed(0)}%`;
}

function createInsufficient(name: string, rationale: string): QualitativeFactor {
  return {
    weight: 0,
    hit_rate: null,
    n: 0,
    significant: false,
    qualitative: true,
    description: name,
    rationale,
    confidence: "qualitative",
  };
}

// ── Data Loading ───────────────────────────────────────────────────────

export async function loadHistoricalData(): Promise<HistoricalTransition[]> {
  const { data, error } = await supabase
    .from("historical_transitions")
    .select("*")
    .gt("guidance_number", 0)
    .not("opening_balance", "is", null);

  if (error) throw error;

  const now = new Date();
  return (data ?? []).map((t) => ({
    id: t.id,
    physician_name: t.physician_name,
    opening_date: t.opening_date,
    guidance_number: t.guidance_number,
    opening_balance: t.opening_balance,
    pct_to_guidance: t.pct_to_guidance,
    hit_guidance: t.hit_guidance,
    segmentation: t.segmentation,
    coc_type: t.coc_type,
    state: t.state,
    msrp_at_open: t.msrp_at_open,
    total_weeks: t.total_weeks,
    expected_yield: t.expected_yield,
    actual_yield: t.actual_yield,
    pre_survey_patients: t.pre_survey_patients,
    pre_survey_over_55: t.pre_survey_over_55,
    paid_members_current: t.paid_members_current,
    post_open_growth: t.post_open_growth,
    fiscal_month: t.fiscal_month,
    weight:
      t.opening_date && monthsBetween(new Date(t.opening_date), now) <= 6
        ? 2
        : 1,
  }));
}

// ── Core Factor Analysis ───────────────────────────────────────────────

function analyzeFactorPresent(
  transitions: HistoricalTransition[],
  filterFn: (t: HistoricalTransition) => boolean,
  description: string
): FactorAnalysis | null {
  const present = transitions.filter(filterFn);
  const absent = transitions.filter((t) => !filterFn(t));

  if (present.length === 0) return null;

  const presentHitRate = weightedHitRate(present);
  const absentHitRate = weightedHitRate(absent);
  const riskDelta = absentHitRate - presentHitRate;

  // Convert delta to 0-20 point weight (50% delta = 20 points, linear)
  const rawWeight = Math.round(riskDelta * 40);
  const weight = Math.max(0, Math.min(20, rawWeight));

  const n = present.length;

  return {
    weight,
    hit_rate: presentHitRate,
    hit_rate_absent: absentHitRate,
    risk_delta: riskDelta,
    n,
    n_absent: absent.length,
    significant: n >= 10,
    qualitative: false,
    description,
    confidence: n >= 10 ? "high" : n >= 3 ? "low" : "insufficient",
  };
}

// ── Benchmark Generation ───────────────────────────────────────────────

function generateBenchmarks(
  transitions: HistoricalTransition[],
  stateDetails: Record<string, { hit_rate: number; n: number }>
): Benchmarks {
  const hits = transitions.filter((t) => t.hit_guidance);
  const misses = transitions.filter((t) => !t.hit_guidance);

  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  // COC type benchmarks — normalize segmentation to standard keys
  const cocGroups: Record<string, HistoricalTransition[]> = {};
  for (const t of transitions) {
    const seg = t.segmentation || "Unknown";
    let key = "Unknown";
    if (seg.includes("Family") && seg.includes("COC In")) key = "FM COC In";
    else if (seg.includes("Family") && seg.includes("COC Out")) key = "FM COC Out";
    else if (seg.includes("Internal") && seg.includes("COC In")) key = "IM COC In";
    else if (seg.includes("Internal") && seg.includes("COC Out")) key = "IM COC Out";
    else if (seg.includes("Specialty")) key = "Specialty";
    if (!cocGroups[key]) cocGroups[key] = [];
    cocGroups[key].push(t);
  }

  const hit_rate_by_coc: Record<string, { rate: number; n: number }> = {};
  for (const [key, group] of Object.entries(cocGroups)) {
    if (key === "Unknown") continue;
    hit_rate_by_coc[key] = { rate: weightedHitRate(group), n: group.length };
  }

  // Size bracket benchmarks
  const sizeGroups = {
    small: transitions.filter((t) => t.guidance_number != null && Number(t.guidance_number) <= 125),
    medium: transitions.filter(
      (t) => t.guidance_number != null && Number(t.guidance_number) > 125 && Number(t.guidance_number) <= 250
    ),
    large: transitions.filter(
      (t) => t.guidance_number != null && Number(t.guidance_number) > 250 && Number(t.guidance_number) <= 400
    ),
  };

  const hit_rate_by_size: Record<string, { rate: number; n: number; max: number }> = {
    small: { rate: weightedHitRate(sizeGroups.small), n: sizeGroups.small.length, max: 125 },
    medium: { rate: weightedHitRate(sizeGroups.medium), n: sizeGroups.medium.length, max: 250 },
    large: { rate: weightedHitRate(sizeGroups.large), n: sizeGroups.large.length, max: 400 },
  };

  // MSRP benchmarks
  const msrpValid = transitions.filter((t) => t.msrp_at_open != null);
  const hit_rate_by_msrp: Record<string, { rate: number; n: number }> = {
    under_2200: (() => {
      const g = msrpValid.filter((t) => Number(t.msrp_at_open) <= 2200);
      return { rate: weightedHitRate(g), n: g.length };
    })(),
    "2200_to_2700": (() => {
      const g = msrpValid.filter((t) => Number(t.msrp_at_open) > 2200 && Number(t.msrp_at_open) <= 2700);
      return { rate: weightedHitRate(g), n: g.length };
    })(),
    over_2700: (() => {
      const g = msrpValid.filter((t) => Number(t.msrp_at_open) > 2700);
      return { rate: weightedHitRate(g), n: g.length };
    })(),
  };

  // Month benchmarks
  const monthGroups: Record<string, HistoricalTransition[]> = {};
  for (const t of transitions) {
    if (!t.fiscal_month) continue;
    if (!monthGroups[t.fiscal_month]) monthGroups[t.fiscal_month] = [];
    monthGroups[t.fiscal_month].push(t);
  }
  const hit_rate_by_month: Record<string, { rate: number; n: number }> = {};
  for (const [month, group] of Object.entries(monthGroups)) {
    hit_rate_by_month[month] = { rate: weightedHitRate(group), n: group.length };
  }

  // State benchmarks (reuse stateDetails from caller)
  const hit_rate_by_state: Record<string, { rate: number; n: number }> = {};
  for (const [state, detail] of Object.entries(stateDetails)) {
    hit_rate_by_state[state] = { rate: detail.hit_rate, n: detail.n };
  }

  // Near-miss recovery: transitions at 60-80% guidance that later reached 80%+
  const nearMisses = transitions.filter(
    (t) => t.pct_to_guidance != null && Number(t.pct_to_guidance) >= 0.6 && Number(t.pct_to_guidance) < 0.8
  );
  const recovered = nearMisses.filter(
    (t) =>
      t.paid_members_current != null &&
      t.guidance_number != null &&
      Number(t.guidance_number) > 0 &&
      Number(t.paid_members_current) / Number(t.guidance_number) >= 0.8
  );
  const recoveryRate = nearMisses.length > 0 ? recovered.length / nearMisses.length : 0;

  return {
    overall_hit_rate: weightedHitRate(transitions),
    n_transitions: transitions.length,
    avg_pct_to_guidance: avg(
      transitions.filter((t) => t.pct_to_guidance != null).map((t) => Number(t.pct_to_guidance))
    ),
    avg_yield_hit: avg(hits.filter((t) => t.actual_yield != null).map((t) => Number(t.actual_yield))),
    avg_yield_missed: avg(misses.filter((t) => t.actual_yield != null).map((t) => Number(t.actual_yield))),
    avg_post_open_growth: avg(
      transitions.filter((t) => t.post_open_growth != null).map((t) => Number(t.post_open_growth))
    ),
    recovery_rate_near_miss: recoveryRate,
    hit_rate_by_coc,
    hit_rate_by_size,
    hit_rate_by_msrp,
    hit_rate_by_state,
    hit_rate_by_month,
  };
}

// ── Main Recalibration ─────────────────────────────────────────────────

export async function runRecalibration(): Promise<RecalibrationResult> {
  // 1. Load historical data with recency weighting
  const transitions = await loadHistoricalData();

  if (transitions.length < 10) {
    throw new Error(
      `Need at least 10 historical transitions to recalibrate. Currently have ${transitions.length}.`
    );
  }

  const overallHitRate = weightedHitRate(transitions);

  // 2. Analyze each quantitative factor
  const weights: Record<string, FactorAnalysis | QualitativeFactor> = {};

  weights.coc_out =
    analyzeFactorPresent(
      transitions,
      (t) => t.coc_type === "COC Out" || (t.segmentation?.includes("COC Out") ?? false),
      "COC Out (patients must leave current practice)"
    ) ?? createInsufficient("COC Out", "Not enough COC Out transitions to analyze");

  weights.small_guidance =
    analyzeFactorPresent(
      transitions,
      (t) => t.guidance_number != null && Number(t.guidance_number) <= 125,
      "Small guidance target (≤125 patients)"
    ) ?? createInsufficient("Small guidance", "No transitions with guidance ≤125");

  weights.msrp_very_high =
    analyzeFactorPresent(
      transitions,
      (t) => t.msrp_at_open != null && Number(t.msrp_at_open) > 2700,
      "MSRP above $2,700"
    ) ?? createInsufficient("MSRP >$2,700", "No MSRP data available");

  weights.msrp_high =
    analyzeFactorPresent(
      transitions,
      (t) =>
        t.msrp_at_open != null &&
        Number(t.msrp_at_open) > 2500 &&
        Number(t.msrp_at_open) <= 2700,
      "MSRP $2,500–$2,700"
    ) ?? createInsufficient("MSRP $2,500-$2,700", "No MSRP data in this range");

  weights.short_transition =
    analyzeFactorPresent(
      transitions,
      (t) => t.total_weeks != null && Number(t.total_weeks) <= 12,
      "Very short transition (≤12 weeks)"
    ) ?? createInsufficient("Short transition", "No transitions ≤12 weeks in data");

  weights.medium_transition =
    analyzeFactorPresent(
      transitions,
      (t) =>
        t.total_weeks != null &&
        Number(t.total_weeks) > 12 &&
        Number(t.total_weeks) <= 16,
      "Short transition (13–16 weeks)"
    ) ?? createInsufficient("Medium-short transition", "No transitions 13-16 weeks in data");

  // 3. Dynamic state risk detection
  const stateStats: Record<
    string,
    { hits: number; total: number; n: number; weightedHits: number; weightedTotal: number }
  > = {};

  for (const t of transitions) {
    if (!t.state) continue;
    if (!stateStats[t.state]) {
      stateStats[t.state] = { hits: 0, total: 0, n: 0, weightedHits: 0, weightedTotal: 0 };
    }
    stateStats[t.state].n += 1;
    stateStats[t.state].total += 1;
    stateStats[t.state].weightedTotal += t.weight;
    if (t.hit_guidance) {
      stateStats[t.state].hits += 1;
      stateStats[t.state].weightedHits += t.weight;
    }
  }

  const highRiskStates: string[] = [];
  const moderateRiskStates: string[] = [];
  const stateDetails: Record<string, { hit_rate: number; n: number }> = {};

  for (const [state, stats] of Object.entries(stateStats)) {
    if (stats.n < 3) continue;
    const stateHitRate = stats.weightedHits / stats.weightedTotal;
    stateDetails[state] = { hit_rate: stateHitRate, n: stats.n };

    if (stateHitRate < overallHitRate - 0.2) {
      highRiskStates.push(state);
    } else if (stateHitRate < overallHitRate - 0.1) {
      moderateRiskStates.push(state);
    }
  }

  weights.high_risk_state = {
    weight: 10,
    hit_rate: null,
    n: 0,
    significant: highRiskStates.length > 0,
    qualitative: false as const,
    description: "High-risk state",
    confidence: "high" as const,
    states: highRiskStates,
    details: Object.fromEntries(highRiskStates.map((s) => [s, stateDetails[s]])),
  } as unknown as QualitativeFactor;

  weights.moderate_risk_state = {
    weight: 5,
    hit_rate: null,
    n: 0,
    significant: moderateRiskStates.length > 0,
    qualitative: false as const,
    description: "Moderate-risk state",
    confidence: "low" as const,
    states: moderateRiskStates,
    details: Object.fromEntries(moderateRiskStates.map((s) => [s, stateDetails[s]])),
  } as unknown as QualitativeFactor;

  // 4. Age composition analysis
  weights.low_55_plus =
    analyzeFactorPresent(
      transitions,
      (t) =>
        t.pre_survey_patients != null &&
        Number(t.pre_survey_patients) > 0 &&
        t.pre_survey_over_55 != null &&
        Number(t.pre_survey_over_55) / Number(t.pre_survey_patients) < 0.5,
      "Under 50% of patient panel is 55+"
    ) ?? createInsufficient("Low 55+", "Insufficient age composition data");

  // 5. Payer mix analysis (medicaid/dual data not in historical_transitions table, so qualitative)
  weights.high_medicaid = {
    weight: 20,
    hit_rate: null,
    n: 0,
    significant: false,
    qualitative: true,
    description: "High Medicaid population (>30%)",
    rationale:
      "Durbin mea culpa was 70% medi-medi. Medicaid patients rarely convert to membership model.",
    confidence: "qualitative",
  };

  weights.moderate_medicaid = {
    weight: 10,
    hit_rate: null,
    n: 0,
    significant: false,
    qualitative: true,
    description: "Moderate Medicaid population (15–30%)",
    rationale: "Reduces addressable patient pool for conversion.",
    confidence: "qualitative",
  };

  weights.high_dual_eligible = {
    weight: 20,
    hit_rate: null,
    n: 0,
    significant: false,
    qualitative: true,
    description: "High Medicare dual-eligible population (>30%)",
    rationale:
      "Dual-eligible patients extremely unlikely to pay membership fee.",
    confidence: "qualitative",
  };

  // 6. Qualitative factors (expert judgment)
  weights.physician_part_time = {
    weight: 10,
    hit_rate: null,
    n: 0,
    significant: false,
    qualitative: true,
    description: "Part-time physician",
    rationale:
      "Part-time doctors have limited patient touchpoints and lower panel utilization.",
    confidence: "qualitative",
  };

  weights.weak_patient_relationships = {
    weight: 12,
    hit_rate: null,
    n: 0,
    significant: false,
    qualitative: true,
    description: "Weak physician-patient relationships",
    rationale: "Weak relationships cited in 4 of 12 mea culpas.",
    confidence: "qualitative",
  };

  weights.fee_discomfort = {
    weight: 8,
    hit_rate: null,
    n: 0,
    significant: false,
    qualitative: true,
    description: "Physician uncomfortable discussing fees",
    rationale:
      "Fee discomfort noted in multiple missed transitions and 2 mea culpas (Hema Dave, Vitale).",
    confidence: "qualitative",
  };

  weights.low_engagement = {
    weight: 10,
    hit_rate: null,
    n: 0,
    significant: false,
    qualitative: true,
    description: "Low physician engagement at start",
    rationale:
      "Physician engagement is the #1 qualitative predictor — Aggarwal (18/195 after 2 months) is the clearest example.",
    confidence: "qualitative",
  };

  weights.partner_misaligned = {
    weight: 15,
    hit_rate: null,
    n: 0,
    significant: false,
    qualitative: true,
    description: "Partner/group practice not aligned with transition",
    rationale:
      "Partner conflicts caused 3 mea culpas (Noftz, Gazzola, Kaplan) — highest single-cause cancellation reason.",
    confidence: "qualitative",
  };

  // 7. Generate benchmarks
  const benchmarks = generateBenchmarks(transitions, stateDetails);

  // 8. Compare to previous calibration
  const { data: prevCalibration } = await supabase
    .from("risk_weights")
    .select("id, weights, benchmarks")
    .eq("is_active", true)
    .order("calibration_date", { ascending: false })
    .limit(1)
    .single();

  let weightChanges: Record<string, WeightChange> | null = null;
  let previousCalibrationId: string | null = null;

  if (prevCalibration) {
    previousCalibrationId = prevCalibration.id;
    const oldWeights = prevCalibration.weights as unknown as Record<
      string,
      { weight: number; hit_rate?: number | null; n?: number }
    >;
    weightChanges = {};

    for (const [key, newVal] of Object.entries(weights)) {
      if (!newVal) continue;
      const oldVal = oldWeights[key];

      if (!oldVal) {
        weightChanges[key] = {
          type: "NEW",
          old_weight: 0,
          new_weight: newVal.weight,
          delta: newVal.weight,
          old_hit_rate: null,
          new_hit_rate: newVal.hit_rate ?? null,
          old_n: 0,
          new_n: newVal.n ?? 0,
          reason: "New factor added to model",
        };
      } else if (oldVal.weight !== newVal.weight) {
        const delta = newVal.weight - oldVal.weight;
        let reason = "";
        if (newVal.qualitative) {
          reason = "Qualitative factor — weight unchanged (expert judgment)";
        } else if (delta > 0) {
          reason = `Hit rate dropped: ${formatPct(oldVal.hit_rate ?? null)} → ${formatPct(newVal.hit_rate ?? null)} (factor is riskier than previously measured)`;
        } else {
          reason = `Hit rate improved: ${formatPct(oldVal.hit_rate ?? null)} → ${formatPct(newVal.hit_rate ?? null)} (factor is less risky than previously measured)`;
        }

        weightChanges[key] = {
          type: "CHANGED",
          old_weight: oldVal.weight,
          new_weight: newVal.weight,
          delta,
          old_hit_rate: oldVal.hit_rate ?? null,
          new_hit_rate: newVal.hit_rate ?? null,
          old_n: oldVal.n ?? 0,
          new_n: newVal.n ?? 0,
          reason,
        };
      }
    }

    // Check for removed factors
    for (const [key, oldVal] of Object.entries(oldWeights)) {
      if (!weights[key]) {
        weightChanges[key] = {
          type: "REMOVED",
          old_weight: oldVal.weight,
          new_weight: 0,
          delta: -oldVal.weight,
          old_hit_rate: oldVal.hit_rate ?? null,
          new_hit_rate: null,
          old_n: oldVal.n ?? 0,
          new_n: 0,
          reason: "Factor removed from model",
        };
      }
    }
  }

  // 9. Build summary
  const allFactors = Object.values(weights).filter(Boolean);
  const dataDriven = allFactors.filter((f) => !f.qualitative && f.n > 0);

  const summary: RecalibrationSummary = {
    n_transitions: transitions.length,
    overall_hit_rate: overallHitRate,
    recency_window_months: 6,
    factors_data_driven: dataDriven.length,
    factors_significant: dataDriven.filter((f) => f.significant).length,
    factors_low_confidence: dataDriven.filter((f) => !f.significant && f.n >= 3).length,
    factors_qualitative: allFactors.filter((f) => f.qualitative).length,
    factors_changed: weightChanges
      ? Object.values(weightChanges).filter((c) => c.type === "CHANGED").length
      : 0,
    total_risk_factors: allFactors.length,
  };

  return {
    weights,
    benchmarks,
    summary,
    weightChanges,
    previousCalibrationId,
  };
}

// ── Save Calibration ───────────────────────────────────────────────────

export async function saveCalibration(result: RecalibrationResult, label?: string) {
  // Deactivate all existing active calibrations
  await supabase
    .from("risk_weights")
    .update({ is_active: false })
    .eq("is_active", true);

  const nHit = Math.round(result.summary.overall_hit_rate * result.summary.n_transitions);
  const nMissed = result.summary.n_transitions - nHit;

  // Insert the new calibration as active
  const { error } = await supabase.from("risk_weights").insert([{
    calibration_date: new Date().toISOString(),
    calibration_label: label ??
      `Auto-calibration from ${result.summary.n_transitions} transitions. ` +
      `${result.summary.factors_data_driven} data-driven, ` +
      `${result.summary.factors_qualitative} qualitative. ` +
      `${result.summary.factors_changed} changed.`,
    weights: JSON.parse(JSON.stringify(result.weights)),
    benchmarks: JSON.parse(JSON.stringify(result.benchmarks)),
    is_active: true,
    n_transitions: result.summary.n_transitions,
    n_hit: nHit,
    n_missed: nMissed,
    overall_hit_rate: result.summary.overall_hit_rate,
  }]);

  if (error) throw error;
}

// ── Backtest ───────────────────────────────────────────────────────────

export interface BacktestDetail {
  physician_name: string;
  risk_score: number;
  risk_tier: string;
  pct_to_guidance: number;
  hit_guidance: boolean;
  prediction_correct: boolean;
}

export interface TierAccuracy {
  tier: string;
  count: number;
  actualHitRate: number;
  expectedDirection: string;
  correct: boolean;
}

export interface BacktestResult {
  totalTransitions: number;
  tierAccuracy: TierAccuracy[];
  correlationCorrect: boolean;
  avgScoreHits: number;
  avgScoreMisses: number;
  details: BacktestDetail[];
}

function numAvg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

export function runBacktest(
  transitions: HistoricalTransition[],
  weights: Weights
): BacktestResult {
  const scored: BacktestDetail[] = transitions
    .filter((t) => t.guidance_number != null && t.pct_to_guidance != null && t.hit_guidance != null)
    .map((t) => {
      const input: RiskScoreInput = {
        coc_type: t.coc_type || "",
        guidance_number: Number(t.guidance_number),
        msrp_at_open: t.msrp_at_open != null ? Number(t.msrp_at_open) : null,
        total_weeks: t.total_weeks != null ? Number(t.total_weeks) : null,
        state: t.state || "",
        // Unknown qualitative fields — assume best case (no penalty)
        physician_full_time: true,
        physician_has_strong_patient_relationships: true,
        physician_comfortable_discussing_fees: true,
        physician_engagement_level: "High",
        partner_group_aligned: true,
        medicaid_pct: null,
        medicare_dual_pct: null,
        pre_survey_patients: t.pre_survey_patients != null ? Number(t.pre_survey_patients) : null,
        pre_survey_over_55: t.pre_survey_over_55 != null ? Number(t.pre_survey_over_55) : null,
      };

      const result = calculateRiskScore(input, weights);

      const isLowRisk = ["LOW", "MODERATE"].includes(result.tier);
      const predictionCorrect =
        (isLowRisk && !!t.hit_guidance) || (!isLowRisk && !t.hit_guidance);

      return {
        physician_name: t.physician_name,
        risk_score: result.score,
        risk_tier: result.tier,
        pct_to_guidance: Number(t.pct_to_guidance),
        hit_guidance: !!t.hit_guidance,
        prediction_correct: predictionCorrect,
      };
    });

  // Tier accuracy
  const tiers = ["LOW", "MODERATE", "HIGH", "CRITICAL"];
  const tierAccuracy: TierAccuracy[] = tiers.map((tier) => {
    const inTier = scored.filter((s) => s.risk_tier === tier);
    const hitRate =
      inTier.length > 0
        ? inTier.filter((s) => s.hit_guidance).length / inTier.length
        : 0;
    const isLowRisk = ["LOW", "MODERATE"].includes(tier);
    return {
      tier,
      count: inTier.length,
      actualHitRate: hitRate,
      expectedDirection: isLowRisk
        ? "Should hit guidance more often"
        : "Should miss guidance more often",
      correct: isLowRisk ? hitRate >= 0.6 : hitRate < 0.6,
    };
  });

  const hitsAvgScore = numAvg(scored.filter((s) => s.hit_guidance).map((s) => s.risk_score));
  const missesAvgScore = numAvg(scored.filter((s) => !s.hit_guidance).map((s) => s.risk_score));

  return {
    totalTransitions: scored.length,
    tierAccuracy,
    correlationCorrect: missesAvgScore > hitsAvgScore,
    avgScoreHits: hitsAvgScore,
    avgScoreMisses: missesAvgScore,
    details: scored.sort((a, b) => b.risk_score - a.risk_score),
  };
}
