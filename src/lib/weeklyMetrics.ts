import type { WeeklySnapshot, WeeklyMetrics } from '@/types/weeklyIntelligence';

/**
 * Compute weekly metrics from a transition's opening_date and its snapshots.
 * Snapshots must be sorted by week_ending_date ascending (oldest first).
 */
export function computeWeeklyMetrics(
  snapshots: WeeklySnapshot[],
  openingDate: string,
): WeeklyMetrics | null {
  if (snapshots.length === 0) return null;

  const latest = snapshots[snapshots.length - 1];
  const guidance = latest.guidance_number;
  const paid = latest.paid_members;

  // Pace
  const pace_to_guidance = guidance > 0 ? paid / guidance : 0;

  // Weeks to opening
  const openMs = new Date(openingDate).getTime();
  const latestMs = new Date(latest.week_ending_date).getTime();
  const weeks_to_opening = Math.max(0, Math.ceil((openMs - latestMs) / (7 * 86_400_000)));

  // WoW changes
  const wowChanges: number[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    wowChanges.push(snapshots[i].paid_members - snapshots[i - 1].paid_members);
  }

  const wow_change = wowChanges.length > 0 ? wowChanges[wowChanges.length - 1] : 0;

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const rolling_2wk = sum(wowChanges.slice(-2));
  const rolling_3wk = sum(wowChanges.slice(-3));
  const rolling_4wk = sum(wowChanges.slice(-4));

  // Growth slope (simple linear regression on last 4 wow changes)
  const slopeData = wowChanges.slice(-4);
  let growth_slope_4wk = 0;
  if (slopeData.length >= 2) {
    const n = slopeData.length;
    const xMean = (n - 1) / 2;
    const yMean = sum(slopeData) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (slopeData[i] - yMean);
      den += (i - xMean) ** 2;
    }
    growth_slope_4wk = den !== 0 ? Math.round(num / den * 100) / 100 : 0;
  }

  // Projections
  const recentAvg = wowChanges.length >= 3
    ? sum(wowChanges.slice(-3)) / Math.min(3, wowChanges.slice(-3).length)
    : wowChanges.length > 0
      ? sum(wowChanges) / wowChanges.length
      : 0;

  const projected_paid_at_opening = Math.round(paid + recentAvg * weeks_to_opening);
  const projected_pace_at_opening = guidance > 0 ? projected_paid_at_opening / guidance : 0;

  // Effort to growth ratio
  const touches = latest.touches_mer_last_week || 0;
  const effort_to_growth_ratio = touches / Math.max(wow_change, 1);

  return {
    pace_to_guidance: Math.round(pace_to_guidance * 1000) / 1000,
    weeks_to_opening,
    wow_change,
    rolling_2wk,
    rolling_3wk,
    rolling_4wk,
    growth_slope_4wk,
    projected_paid_at_opening,
    projected_pace_at_opening: Math.round(projected_pace_at_opening * 1000) / 1000,
    effort_to_growth_ratio: Math.round(effort_to_growth_ratio * 100) / 100,
  };
}
