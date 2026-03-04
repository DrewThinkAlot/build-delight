import { describe, it, expect } from 'vitest';
import { computeWeeklyMetrics } from '@/lib/weeklyMetrics';
import type { WeeklySnapshot } from '@/types/weeklyIntelligence';

function makeSnapshot(overrides: Partial<WeeklySnapshot> & { paid_members: number; week_ending_date: string }): WeeklySnapshot {
  return {
    id: 'snap-1',
    transition_id: 't1',
    guidance_number: 200,
    touches_mer_last_week: 10,
    touches_pa_last_week: 5,
    doctor_calls_last_week: 3,
    weekly_needed_to_hit_guidance: null,
    strategic_activities: null,
    notes: null,
    strategy_changed: false,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('computeWeeklyMetrics', () => {
  it('returns null for empty snapshots', () => {
    expect(computeWeeklyMetrics([], '2026-05-01')).toBeNull();
  });

  it('computes basic pace correctly', () => {
    const snapshots = [makeSnapshot({ paid_members: 100, week_ending_date: '2026-04-01' })];
    const result = computeWeeklyMetrics(snapshots, '2026-05-01');
    expect(result).not.toBeNull();
    expect(result!.pace_to_guidance).toBe(0.5); // 100/200
    expect(result!.weeks_to_opening).toBeGreaterThan(0);
  });

  it('computes wow_change from 2 snapshots', () => {
    const snapshots = [
      makeSnapshot({ paid_members: 80, week_ending_date: '2026-03-25' }),
      makeSnapshot({ paid_members: 100, week_ending_date: '2026-04-01' }),
    ];
    const result = computeWeeklyMetrics(snapshots, '2026-05-01');
    expect(result!.wow_change).toBe(20);
    expect(result!.rolling_2wk).toBe(20); // only 1 change
  });

  it('computes rolling sums and projections', () => {
    const snapshots = [
      makeSnapshot({ paid_members: 50, week_ending_date: '2026-03-04' }),
      makeSnapshot({ paid_members: 60, week_ending_date: '2026-03-11' }),
      makeSnapshot({ paid_members: 75, week_ending_date: '2026-03-18' }),
      makeSnapshot({ paid_members: 95, week_ending_date: '2026-03-25' }),
    ];
    const result = computeWeeklyMetrics(snapshots, '2026-05-01');
    expect(result!.rolling_3wk).toBe(10 + 15 + 20); // 45
    expect(result!.rolling_4wk).toBe(10 + 15 + 20); // only 3 changes
    expect(result!.projected_paid_at_opening).toBeGreaterThan(95);
  });

  it('handles effort_to_growth_ratio with zero growth', () => {
    const snapshots = [
      makeSnapshot({ paid_members: 100, week_ending_date: '2026-03-25' }),
      makeSnapshot({ paid_members: 100, week_ending_date: '2026-04-01', touches_mer_last_week: 15 }),
    ];
    const result = computeWeeklyMetrics(snapshots, '2026-05-01');
    // wow_change = 0, so ratio = touches / max(0, 1) = 15
    expect(result!.effort_to_growth_ratio).toBe(15);
  });
});
