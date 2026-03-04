import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateRiskScore, getSimilarTransitions, type RiskScoreInput, type Weights, type Benchmarks } from '@/lib/riskScorer';

// Mock supabase so the module loads without network
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'test' } }) }) }) }) }) }) },
}));

const baseInput: RiskScoreInput = {
  coc_type: 'COC In',
  guidance_number: 200,
  msrp_at_open: 2400,
  total_weeks: 20,
  state: 'TX',
  physician_full_time: true,
  physician_has_strong_patient_relationships: true,
  physician_comfortable_discussing_fees: true,
  physician_engagement_level: 'High',
  partner_group_aligned: true,
  medicaid_pct: 0.05,
  medicare_dual_pct: 0.05,
  pre_survey_patients: 2000,
  pre_survey_over_55: 1200,
};

const weights: Weights = {
  coc_out: { weight: 15, significant: true, description: 'COC Out' },
  small_guidance: { weight: 6, significant: true, description: 'Small guidance' },
  msrp_very_high: { weight: 14, significant: true, description: 'MSRP >2700' },
  msrp_high: { weight: 5, significant: true, description: 'MSRP 2500-2700' },
  short_transition: { weight: 15, significant: false, qualitative: true, description: 'Short transition' },
  medium_transition: { weight: 8, significant: false, qualitative: true, description: 'Med transition' },
  high_risk_state: { weight: 10, states: ['PA', 'NJ'], significant: true, description: 'High risk state' },
  moderate_risk_state: { weight: 5, states: ['CA', 'NY'], significant: false, description: 'Mod risk state' },
  physician_part_time: { weight: 10, significant: false, qualitative: true, description: 'Part time' },
  weak_patient_relationships: { weight: 12, significant: false, qualitative: true, description: 'Weak relationships' },
  fee_discomfort: { weight: 8, significant: false, qualitative: true, description: 'Fee discomfort' },
  low_engagement: { weight: 10, significant: false, qualitative: true, description: 'Low engagement' },
  partner_misaligned: { weight: 15, significant: false, qualitative: true, description: 'Partner misaligned' },
  high_medicaid: { weight: 20, significant: false, qualitative: true, description: 'High Medicaid' },
  moderate_medicaid: { weight: 10, significant: false, qualitative: true, description: 'Mod Medicaid' },
  high_dual_eligible: { weight: 20, significant: false, qualitative: true, description: 'High dual' },
  low_55_plus: { weight: 8, significant: false, qualitative: true, description: 'Low 55+' },
};

describe('calculateRiskScore', () => {
  it('returns LOW tier with zero factors for ideal input', () => {
    const result = calculateRiskScore(baseInput, weights);
    expect(result.score).toBe(0);
    expect(result.tier).toBe('LOW');
    expect(result.factors).toHaveLength(0);
  });

  it('flags COC Out correctly', () => {
    const input = { ...baseInput, coc_type: 'COC Out' };
    const result = calculateRiskScore(input, weights);
    expect(result.factors.some(f => f.id === 'coc_out')).toBe(true);
    expect(result.score).toBe(15);
  });

  it('flags multiple risk factors and caps at 100', () => {
    const input: RiskScoreInput = {
      ...baseInput,
      coc_type: 'COC Out',
      guidance_number: 100,
      msrp_at_open: 2800,
      total_weeks: 10,
      state: 'PA',
      physician_full_time: false,
      physician_has_strong_patient_relationships: false,
      physician_comfortable_discussing_fees: false,
      physician_engagement_level: 'Low',
      partner_group_aligned: false,
      medicaid_pct: 0.35,
      medicare_dual_pct: 0.35,
      pre_survey_patients: 1000,
      pre_survey_over_55: 400,
    };
    const result = calculateRiskScore(input, weights);
    expect(result.score).toBe(100); // capped
    expect(result.tier).toBe('CRITICAL');
    expect(result.factors.length).toBeGreaterThan(5);
  });

  it('assigns correct tiers', () => {
    // MODERATE: score 21-40
    const modInput = { ...baseInput, coc_type: 'COC Out', msrp_at_open: 2600 }; // 15 + 5 = 20 → hmm, exactly 20 is LOW
    const modResult = calculateRiskScore({ ...modInput, guidance_number: 100 }, weights); // +6 = 26
    expect(modResult.tier).toBe('MODERATE');
  });

  it('sorts factors by points descending', () => {
    const input = { ...baseInput, coc_type: 'COC Out', state: 'PA', physician_full_time: false };
    const result = calculateRiskScore(input, weights);
    for (let i = 1; i < result.factors.length; i++) {
      expect(result.factors[i - 1].points).toBeGreaterThanOrEqual(result.factors[i].points);
    }
  });
});

describe('getSimilarTransitions', () => {
  const benchmarks: Benchmarks = {
    overall_hit_rate: 0.71,
    n_transitions: 68,
    avg_pct_to_guidance: 1.1,
    avg_yield_hit: 0.19,
    avg_yield_missed: 0.09,
    avg_post_open_growth: 22,
    recovery_rate_near_miss: 0.09,
    hit_rate_by_coc: { 'IM COC In': { rate: 0.75, n: 12 } },
    hit_rate_by_size: { medium: { max: 250, rate: 0.73, n: 26 } },
    hit_rate_by_msrp: {},
    hit_rate_by_state: { TX: { rate: 0.89, n: 9 } },
    hit_rate_by_month: {},
  };

  it('returns matching benchmarks', () => {
    const input = { ...baseInput, specialty: 'Internal Medicine' };
    const result = getSimilarTransitions(input, benchmarks);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.some(c => c.label.includes('IM COC In'))).toBe(true);
    expect(result.some(c => c.label.includes('TX'))).toBe(true);
  });

  it('returns empty for no matching benchmarks', () => {
    const emptyBench: Benchmarks = { ...benchmarks, hit_rate_by_coc: {}, hit_rate_by_size: {}, hit_rate_by_state: {} };
    const result = getSimilarTransitions(baseInput, emptyBench);
    expect(result).toHaveLength(0);
  });
});
