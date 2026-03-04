import { describe, it, expect } from 'vitest';
import { generateRecommendations } from '@/lib/recommendations';
import type { Transition } from '@/types/transition';
import type { WeeklySnapshot, WeeklyMetrics, Signal } from '@/types/weeklyIntelligence';

const transition: Transition = {
  id: 't1', physician_name: 'Dr. Test', transition_start: '2026-01-01',
  opening_date: '2026-05-01', guidance_number: 200, status: 'active',
  physician_full_time: true, physician_has_strong_patient_relationships: true,
  physician_comfortable_discussing_fees: true, partner_group_aligned: true,
};

const snapshot: WeeklySnapshot = {
  id: 's1', transition_id: 't1', week_ending_date: '2026-04-01',
  paid_members: 100, guidance_number: 200, touches_mer_last_week: 10,
  touches_pa_last_week: 5, doctor_calls_last_week: 3,
  weekly_needed_to_hit_guidance: 25, strategic_activities: null,
  notes: null, strategy_changed: false, created_at: '', updated_at: '',
};

const metrics: WeeklyMetrics = {
  pace_to_guidance: 0.50, weeks_to_opening: 4, wow_change: 5,
  rolling_2wk: 10, rolling_3wk: 15, rolling_4wk: 20,
  growth_slope_4wk: 1, projected_paid_at_opening: 120,
  projected_pace_at_opening: 0.60, effort_to_growth_ratio: 2,
};

describe('generateRecommendations', () => {
  it('returns empty when no metrics or snapshot', () => {
    expect(generateRecommendations(transition, null, null, [])).toHaveLength(0);
  });

  it('returns maintain_momentum for on_track', () => {
    const signals: Signal[] = [{ key: 'on_track', title: '', severity: 'green', reason: '', numbers: {} }];
    const recs = generateRecommendations(transition, snapshot, metrics, signals);
    expect(recs.some(r => r.key === 'maintain_momentum')).toBe(true);
  });

  it('returns increase_mer_touches when behind + low effort', () => {
    const signals: Signal[] = [
      { key: 'behind_pace', title: '', severity: 'red', reason: '', numbers: {} },
      { key: 'low_effort', title: '', severity: 'red', reason: '', numbers: {} },
    ];
    const recs = generateRecommendations(transition, snapshot, metrics, signals);
    expect(recs.some(r => r.key === 'increase_mer_touches')).toBe(true);
  });

  it('returns strategy_reset when stalling', () => {
    const signals: Signal[] = [
      { key: 'stalling', title: '', severity: 'red', reason: '', numbers: {} },
    ];
    const recs = generateRecommendations(transition, snapshot, metrics, signals);
    expect(recs.some(r => r.key === 'strategy_reset')).toBe(true);
  });

  it('returns at most 5 recommendations sorted by priority', () => {
    const signals: Signal[] = [
      { key: 'behind_pace', title: '', severity: 'red', reason: '', numbers: {} },
      { key: 'low_effort', title: '', severity: 'red', reason: '', numbers: {} },
      { key: 'stalling', title: '', severity: 'red', reason: '', numbers: {} },
      { key: 'effort_not_converting', title: '', severity: 'yellow', reason: '', numbers: {} },
      { key: 'weekly_needed_rising', title: '', severity: 'yellow', reason: '', numbers: {} },
      { key: 'declining_trajectory', title: '', severity: 'yellow', reason: '', numbers: {} },
    ];
    const noCallsSnapshot = { ...snapshot, doctor_calls_last_week: 0, strategy_changed: false };
    const recs = generateRecommendations(transition, noCallsSnapshot, metrics, signals);
    expect(recs.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].priority).toBeLessThanOrEqual(recs[i].priority);
    }
  });
});
