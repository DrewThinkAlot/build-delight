import { describe, it, expect } from 'vitest';
import { generateSignals, worstSeverity } from '@/lib/weeklySignals';
import type { WeeklyMetrics, WeeklySnapshot, WeeklyThresholds } from '@/types/weeklyIntelligence';

const thresholds: WeeklyThresholds = {
  behind_pace_thresholds: { '0_4': 0.85, '5_8': 0.75, '9_12': 0.65, '13_plus': 0.55 },
  min_touches: 8,
  stalling_wow_threshold: 0,
};

function makeMetrics(overrides: Partial<WeeklyMetrics> = {}): WeeklyMetrics {
  return {
    pace_to_guidance: 0.8,
    weeks_to_opening: 6,
    wow_change: 10,
    rolling_2wk: 20,
    rolling_3wk: 30,
    rolling_4wk: 40,
    growth_slope_4wk: 2,
    projected_paid_at_opening: 250,
    projected_pace_at_opening: 1.0,
    effort_to_growth_ratio: 1.5,
    ...overrides,
  };
}

function makeSnapshot(paid: number, date: string, mer = 10): WeeklySnapshot {
  return {
    id: `s-${date}`, transition_id: 't1', week_ending_date: date,
    paid_members: paid, guidance_number: 200, touches_mer_last_week: mer,
    touches_pa_last_week: 5, doctor_calls_last_week: 3,
    weekly_needed_to_hit_guidance: null, strategic_activities: null,
    notes: null, strategy_changed: false, created_at: '', updated_at: '',
  };
}

describe('generateSignals', () => {
  it('returns on_track when pace is good', () => {
    const metrics = makeMetrics({ pace_to_guidance: 0.80, weeks_to_opening: 6 });
    const snapshots = [makeSnapshot(160, '2026-04-01')];
    const signals = generateSignals(metrics, snapshots, thresholds);
    expect(signals.some(s => s.key === 'on_track')).toBe(true);
  });

  it('flags behind_pace when below threshold', () => {
    const metrics = makeMetrics({ pace_to_guidance: 0.50, weeks_to_opening: 6 });
    const snapshots = [makeSnapshot(100, '2026-04-01')];
    const signals = generateSignals(metrics, snapshots, thresholds);
    expect(signals.some(s => s.key === 'behind_pace')).toBe(true);
  });

  it('flags stalling when wow is 0 for 2 weeks', () => {
    const metrics = makeMetrics({ wow_change: 0, pace_to_guidance: 0.50, weeks_to_opening: 6 });
    const snapshots = [
      makeSnapshot(100, '2026-03-18'),
      makeSnapshot(100, '2026-03-25'),
      makeSnapshot(100, '2026-04-01'),
    ];
    const signals = generateSignals(metrics, snapshots, thresholds);
    expect(signals.some(s => s.key === 'stalling')).toBe(true);
  });

  it('flags low_effort when behind pace and low touches', () => {
    const metrics = makeMetrics({ pace_to_guidance: 0.50, weeks_to_opening: 6, wow_change: 5 });
    const snapshots = [makeSnapshot(100, '2026-04-01', 3)]; // 3 < min 8
    const signals = generateSignals(metrics, snapshots, thresholds);
    expect(signals.some(s => s.key === 'behind_pace')).toBe(true);
    expect(signals.some(s => s.key === 'low_effort')).toBe(true);
  });

  it('flags declining_trajectory', () => {
    const metrics = makeMetrics({ growth_slope_4wk: -4 });
    const snapshots = [makeSnapshot(100, '2026-04-01')];
    const signals = generateSignals(metrics, snapshots, thresholds);
    expect(signals.some(s => s.key === 'declining_trajectory')).toBe(true);
    expect(signals.find(s => s.key === 'declining_trajectory')!.severity).toBe('red');
  });
});

describe('worstSeverity', () => {
  it('returns red when any red signal exists', () => {
    expect(worstSeverity([
      { key: 'a', title: '', severity: 'green', reason: '', numbers: {} },
      { key: 'b', title: '', severity: 'red', reason: '', numbers: {} },
    ])).toBe('red');
  });

  it('returns green for empty signals', () => {
    expect(worstSeverity([])).toBe('green');
  });
});
