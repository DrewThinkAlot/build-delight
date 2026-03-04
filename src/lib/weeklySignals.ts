import type { WeeklySnapshot, WeeklyMetrics, WeeklyThresholds, Signal } from '@/types/weeklyIntelligence';
import { DEFAULT_THRESHOLDS } from '@/types/weeklyIntelligence';

/**
 * Generate explainable signals from metrics + snapshots.
 * Snapshots sorted ascending by date.
 */
export function generateSignals(
  metrics: WeeklyMetrics,
  snapshots: WeeklySnapshot[],
  thresholds: WeeklyThresholds = DEFAULT_THRESHOLDS,
): Signal[] {
  const signals: Signal[] = [];
  const wto = metrics.weeks_to_opening;

  // 1. Behind pace (threshold depends on weeks-to-opening bucket)
  const bucket = wto <= 4 ? '0_4' : wto <= 8 ? '5_8' : wto <= 12 ? '9_12' : '13_plus';
  const paceThreshold = thresholds.behind_pace_thresholds[bucket] ?? 0.65;
  if (metrics.pace_to_guidance < paceThreshold) {
    const pct = Math.round(metrics.pace_to_guidance * 100);
    const needed = Math.round(paceThreshold * 100);
    signals.push({
      key: 'behind_pace',
      title: 'Behind Pace',
      severity: pct < needed * 0.7 ? 'red' : 'yellow',
      reason: `At ${pct}% of guidance with ${wto} weeks left. Need ${needed}% for this stage.`,
      numbers: { pace_pct: pct, threshold_pct: needed, weeks_left: wto },
    });
  }

  // 2. Stalling (wow_change <= stalling threshold for 2+ weeks, or rolling_3wk < threshold)
  const wowChanges: number[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    wowChanges.push(snapshots[i].paid_members - snapshots[i - 1].paid_members);
  }
  const lastTwo = wowChanges.slice(-2);
  const stallingThreshold = thresholds.stalling_wow_threshold;
  const isStalling = lastTwo.length >= 2 && lastTwo.every(c => c <= stallingThreshold);
  if (isStalling) {
    signals.push({
      key: 'stalling',
      title: 'Enrollment Stalling',
      severity: 'red',
      reason: `WoW change ≤${stallingThreshold} for the last ${lastTwo.length} weeks (${lastTwo.join(', ')}).`,
      numbers: { last_2_wow: lastTwo.join(', '), threshold: stallingThreshold },
    });
  } else if (metrics.rolling_3wk <= stallingThreshold * 3 && wowChanges.length >= 3) {
    signals.push({
      key: 'stalling_rolling',
      title: 'Enrollment Slowing',
      severity: 'yellow',
      reason: `3-week rolling total is ${metrics.rolling_3wk} members.`,
      numbers: { rolling_3wk: metrics.rolling_3wk },
    });
  }

  // 3. Weekly needed rising (increased 2 weeks in a row)
  if (snapshots.length >= 3) {
    const neededValues = snapshots.slice(-3).map(s => s.weekly_needed_to_hit_guidance).filter((v): v is number => v != null);
    if (neededValues.length >= 3 && neededValues[2] > neededValues[1] && neededValues[1] > neededValues[0]) {
      signals.push({
        key: 'weekly_needed_rising',
        title: 'Weekly Target Rising',
        severity: 'yellow',
        reason: `Weekly needed has risen 2 weeks in a row: ${neededValues.join(' → ')}/wk.`,
        numbers: { current: neededValues[2], prior: neededValues[1], before: neededValues[0] },
      });
    }
  }

  // 4. Low effort (touches below min when behind pace)
  const latestTouches = snapshots[snapshots.length - 1]?.touches_mer_last_week ?? 0;
  const isBehind = signals.some(s => s.key === 'behind_pace');
  if (isBehind && latestTouches < thresholds.min_touches) {
    signals.push({
      key: 'low_effort',
      title: 'Low Outreach Effort',
      severity: 'red',
      reason: `Only ${latestTouches} MER touches last week (min: ${thresholds.min_touches}) while behind pace.`,
      numbers: { touches: latestTouches, min_required: thresholds.min_touches },
    });
  }

  // 5. Effort not converting (high touches but low wow)
  if (latestTouches >= thresholds.min_touches && metrics.wow_change <= 2 && latestTouches > 0) {
    signals.push({
      key: 'effort_not_converting',
      title: 'Effort Not Converting',
      severity: 'yellow',
      reason: `${latestTouches} touches produced only ${metrics.wow_change} new members. Ratio: ${metrics.effort_to_growth_ratio}.`,
      numbers: { touches: latestTouches, wow_change: metrics.wow_change, ratio: metrics.effort_to_growth_ratio },
    });
  }

  // 6. Declining trajectory
  if (metrics.growth_slope_4wk < -1) {
    signals.push({
      key: 'declining_trajectory',
      title: 'Declining Growth Trajectory',
      severity: metrics.growth_slope_4wk < -3 ? 'red' : 'yellow',
      reason: `4-week growth slope is ${metrics.growth_slope_4wk} members/week.`,
      numbers: { slope: metrics.growth_slope_4wk },
    });
  }

  // 7. On track / ahead (positive signal)
  if (signals.length === 0 && metrics.pace_to_guidance >= paceThreshold) {
    signals.push({
      key: 'on_track',
      title: 'On Track',
      severity: 'green',
      reason: `At ${Math.round(metrics.pace_to_guidance * 100)}% of guidance with ${wto} weeks remaining.`,
      numbers: { pace_pct: Math.round(metrics.pace_to_guidance * 100), weeks_left: wto },
    });
  }

  return signals;
}

/** Get the worst severity from a set of signals */
export function worstSeverity(signals: Signal[]): 'green' | 'yellow' | 'red' {
  if (signals.some(s => s.severity === 'red')) return 'red';
  if (signals.some(s => s.severity === 'yellow')) return 'yellow';
  return 'green';
}
