import type { WeeklySnapshot, WeeklyMetrics, Signal, Recommendation } from '@/types/weeklyIntelligence';
import type { Transition } from '@/types/transition';

/**
 * Generate rule-based recommendations from signals + context.
 * Returns top 3-5 actions sorted by priority.
 */
export function generateRecommendations(
  transition: Transition,
  latestSnapshot: WeeklySnapshot | null,
  metrics: WeeklyMetrics | null,
  signals: Signal[],
): Recommendation[] {
  if (!metrics || !latestSnapshot) return [];

  const recs: Recommendation[] = [];
  const signalKeys = new Set(signals.map(s => s.key));
  const touches = latestSnapshot.touches_mer_last_week || 0;
  const targetTouches = Math.max(12, touches + 4);

  // Behind pace + Low effort → increase touches
  if (signalKeys.has('behind_pace') && signalKeys.has('low_effort')) {
    recs.push({
      key: 'increase_mer_touches',
      title: `Increase MER touches to ${targetTouches} next week`,
      priority: 1,
      why: `Only ${touches} touches while behind pace at ${Math.round(metrics.pace_to_guidance * 100)}%.`,
      how: 'Schedule additional outreach blocks. Focus on unconverted survey respondents and WTC patients. Set daily touch targets.',
    });
  }

  // Behind pace without low effort → intensify strategy
  if (signalKeys.has('behind_pace') && !signalKeys.has('low_effort')) {
    recs.push({
      key: 'intensify_strategy',
      title: 'Intensify outreach strategy',
      priority: 2,
      why: `Behind pace despite ${touches} touches. Current approach may need adjustment.`,
      how: 'Review messaging effectiveness. Target highest-propensity patients. Consider adding forum or community event.',
    });
  }

  // Effort not converting → shift tactics
  if (signalKeys.has('effort_not_converting')) {
    recs.push({
      key: 'shift_tactics',
      title: 'Shift tactics: fee objection script + physician calls',
      priority: 1,
      why: `${touches} touches yielded only ${metrics.wow_change} new members (ratio: ${metrics.effort_to_growth_ratio}).`,
      how: 'Deploy fee objection scripts. Have physician make 3+ personal calls/day. Focus on warm leads who attended forum or expressed interest.',
    });
  }

  // Stalling → strategy reset
  if (signalKeys.has('stalling') || signalKeys.has('stalling_rolling')) {
    recs.push({
      key: 'strategy_reset',
      title: 'Run strategy reset: doc call + staff huddle + outreach event',
      priority: 1,
      why: `Enrollment has stalled. Rolling 3-week total: ${metrics.rolling_3wk} members.`,
      how: 'Schedule physician coaching call this week. Hold staff huddle to realign. Plan an outreach event or forum within 10 days.',
    });
  }

  // Weekly needed rising → escalate
  if (signalKeys.has('weekly_needed_rising')) {
    recs.push({
      key: 'escalate_support',
      title: 'Escalate support + remove blockers',
      priority: 2,
      why: 'Weekly target keeps rising, making guidance harder to reach each week.',
      how: 'Engage PTM for additional resources. Identify and remove top blockers. Adjust outreach plan to front-load high-value activities.',
    });
  }

  // Declining trajectory → reverse trend
  if (signalKeys.has('declining_trajectory')) {
    recs.push({
      key: 'reverse_decline',
      title: 'Reverse declining growth trend',
      priority: 2,
      why: `4-week growth slope is ${metrics.growth_slope_4wk} members/week.`,
      how: 'Diagnose root cause: PA effectiveness? Physician engagement? Market saturation? Take corrective action on the primary driver.',
    });
  }

  // General: if doctor calls are zero or null and behind
  if (signalKeys.has('behind_pace') && (!latestSnapshot.doctor_calls_last_week || latestSnapshot.doctor_calls_last_week === 0)) {
    recs.push({
      key: 'start_doctor_calls',
      title: 'Start physician personal calls',
      priority: 2,
      why: 'No physician personal calls recorded while behind pace.',
      how: 'Have physician commit to 3-5 personal calls per day targeting top prospects. Provide call list with patient context.',
    });
  }

  // General: if strategy hasn't changed in weeks and signals are red
  if (signals.some(s => s.severity === 'red') && !latestSnapshot.strategy_changed) {
    recs.push({
      key: 'consider_strategy_change',
      title: 'Consider strategy pivot',
      priority: 3,
      why: 'Red signals present but no strategy changes logged recently.',
      how: 'Review what\'s not working. Consider PA swap evaluation, forum scheduling, or outreach event.',
    });
  }

  // Positive: on track → maintain momentum
  if (signalKeys.has('on_track')) {
    recs.push({
      key: 'maintain_momentum',
      title: 'Maintain current momentum',
      priority: 5,
      why: `On track at ${Math.round(metrics.pace_to_guidance * 100)}% of guidance.`,
      how: 'Continue current outreach cadence. Look for opportunities to accelerate. Prepare for any upcoming milestones.',
    });
  }

  // Sort by priority and take top 5
  return recs.sort((a, b) => a.priority - b.priority).slice(0, 5);
}
