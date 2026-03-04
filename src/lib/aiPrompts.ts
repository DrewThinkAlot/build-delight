import { Transition, WeeklyUpdate, CoachingLog } from '@/types/transition';
import { getExpectedPct } from '@/data/sampleData';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──────────────────────────────────────────────────────────────

export interface CoachingContext {
  physician_name: string;
  specialty: string;
  coc_type: string;
  segmentation: string;
  city: string;
  state: string;
  msrp: number;
  guidance_number: number;
  current_paid_members: number;
  pct_to_guidance: number;
  pacing_status: string;
  expected_members: number;
  week_number: number;
  total_weeks: number;
  pct_of_transition: number;
  weeks_remaining: number;
  members_per_week_needed: number;
  projected_opening_number: number;
  risk_score: number;
  risk_tier: string;
  assigned_pa: string;
  pa_rating: number;
  physician_rating: number;
  staff_rating: number;
  physician_making_calls: boolean;
  forums_held: number;
  forums_scheduled: number;
  survey_prospects_left_pct: number;
  wtc_remaining: number;
  net_change: number;
  last_4_weeks_trend: number[];
  primary_obstacle: string;
  obstacle_category: string;
  what_worked: string;
  what_didnt: string;
  last_3_coaching_entries: CoachingEntry[];
  similar_hit_rate: number;
  remaining_enrollment_pct: number;
  overall_hit_rate: number;
  recovery_rate_near_miss: number;
}

export interface CoachingEntry {
  date: string;
  interaction_type: string;
  physician_mood: string;
  confidence_level: number;
  commitments_made: string;
  followed_through: boolean | null;
  topics_covered: string;
}

// ── Context Assembly ───────────────────────────────────────────────────

export function assembleCoachingContext(
  transition: Transition,
  updates: WeeklyUpdate[],
  logs: CoachingLog[],
  benchmarks: Record<string, any> | null
): CoachingContext {
  const latest = updates.length > 0 ? updates[0] : undefined; // already sorted desc
  const recentUpdates = updates.slice(0, 4);

  // Timeline
  const startDate = new Date(transition.transition_start);
  const openDate = new Date(transition.opening_date);
  const totalWeeks = transition.total_weeks ?? Math.round((openDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const weekNumber = latest?.week_number ?? Math.round((Date.now() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const pctOfTransition = totalWeeks > 0 ? Math.min(weekNumber / totalWeeks, 1.0) : 0;
  const weeksRemaining = Math.max(totalWeeks - weekNumber, 0);

  // Enrollment curve
  const expectedPct = getExpectedPct(pctOfTransition);
  const expectedMembers = Math.round(transition.guidance_number * expectedPct);
  const remainingPct = 1.0 - expectedPct;

  const currentMembers = latest?.current_paid_members ?? transition.current_paid_members ?? 0;
  const membersNeeded = transition.guidance_number - currentMembers;
  const perWeekNeeded = weeksRemaining > 0 ? Math.ceil(membersNeeded / weeksRemaining) : membersNeeded;
  const projectedOpening = expectedPct > 0 ? Math.round(currentMembers / expectedPct) : currentMembers;

  // Coaching entries
  const last3Logs: CoachingEntry[] = logs.slice(0, 3).map(e => ({
    date: e.log_date,
    interaction_type: e.interaction_type,
    physician_mood: e.physician_mood || 'Unknown',
    confidence_level: e.confidence_level || 0,
    commitments_made: e.commitments_made || '',
    followed_through: e.followed_through ?? null,
    topics_covered: e.topics_covered || '',
  }));

  // Benchmarks
  const similarHitRate = findSimilarHitRate(transition, benchmarks);

  return {
    physician_name: transition.physician_name,
    specialty: transition.specialty || transition.segmentation || '',
    coc_type: transition.coc_type || '',
    segmentation: transition.segmentation || '',
    city: transition.city || '',
    state: transition.state || '',
    msrp: transition.msrp_at_open || 0,
    guidance_number: transition.guidance_number,
    current_paid_members: currentMembers,
    pct_to_guidance: transition.guidance_number > 0 ? currentMembers / transition.guidance_number : 0,
    pacing_status: latest?.pacing_status || 'UNKNOWN',
    expected_members: expectedMembers,
    week_number: weekNumber,
    total_weeks: totalWeeks,
    pct_of_transition: pctOfTransition,
    weeks_remaining: weeksRemaining,
    members_per_week_needed: perWeekNeeded,
    projected_opening_number: projectedOpening,
    risk_score: transition.risk_score || 0,
    risk_tier: transition.risk_tier || 'UNKNOWN',
    assigned_pa: transition.assigned_pa || 'Unknown',
    pa_rating: latest?.pa_effectiveness_rating ?? 0,
    physician_rating: latest?.physician_engagement_rating ?? 0,
    staff_rating: latest?.staff_engagement_rating ?? 0,
    physician_making_calls: latest?.physician_making_personal_calls ?? false,
    forums_held: latest?.forums_held ?? 0,
    forums_scheduled: latest?.forums_scheduled ?? 0,
    survey_prospects_left_pct: latest?.survey_prospects_left_pct ?? 0,
    wtc_remaining: latest?.wtc_remaining ?? 0,
    net_change: latest?.net_change_from_last_week ?? 0,
    last_4_weeks_trend: recentUpdates.reverse().map(u => u.net_change_from_last_week ?? 0),
    primary_obstacle: latest?.primary_obstacle || 'None identified',
    obstacle_category: latest?.obstacle_category || 'other',
    what_worked: latest?.what_worked_this_week || 'Not specified',
    what_didnt: latest?.what_didnt_work || 'Not specified',
    last_3_coaching_entries: last3Logs,
    similar_hit_rate: similarHitRate,
    remaining_enrollment_pct: remainingPct,
    overall_hit_rate: (benchmarks as any)?.overall_hit_rate ?? 0.71,
    recovery_rate_near_miss: (benchmarks as any)?.recovery_rate_near_miss ?? 0.09,
  };
}

function findSimilarHitRate(transition: Transition, benchmarks: Record<string, any> | null): number {
  if (!benchmarks) return 0.71;
  const cocKey = (transition.segmentation || '').includes('Family')
    ? (transition.coc_type === 'COC In' ? 'FM COC In' : 'FM COC Out')
    : (transition.coc_type === 'COC In' ? 'IM COC In' : 'IM COC Out');
  const cocRate = (benchmarks as any)?.hit_rate_by_coc?.[cocKey]?.rate;
  if (cocRate != null) return cocRate;
  return (benchmarks as any)?.overall_hit_rate ?? 0.71;
}

// ── Fetch benchmarks from DB ───────────────────────────────────────────

export async function fetchActiveBenchmarks(): Promise<Record<string, any> | null> {
  const { data } = await supabase
    .from('risk_weights')
    .select('benchmarks')
    .eq('is_active', true)
    .order('calibration_date', { ascending: false })
    .limit(1)
    .single();
  return (data?.benchmarks as Record<string, any>) ?? null;
}

// ── Prompt Builders ────────────────────────────────────────────────────

function contextBlock(ctx: CoachingContext): string {
  const trendStr = ctx.last_4_weeks_trend.length > 0
    ? ctx.last_4_weeks_trend.map(n => (n >= 0 ? `+${n}` : `${n}`)).join(', ')
    : 'No trend data';

  const coachingHistory = ctx.last_3_coaching_entries.length > 0
    ? ctx.last_3_coaching_entries.map(e =>
        `  - ${e.date}: ${e.interaction_type} | Mood: ${e.physician_mood} | Confidence: ${e.confidence_level}/5 | Commitments: ${e.commitments_made || 'None'} | Followed through: ${e.followed_through === null ? 'Pending' : e.followed_through ? 'Yes' : 'No'}`
      ).join('\n')
    : '  No coaching entries yet';

  return `
=== TRANSITION CONTEXT ===
Physician: Dr. ${ctx.physician_name} (${ctx.specialty})
Location: ${ctx.city}, ${ctx.state}
COC Type: ${ctx.coc_type} | Segmentation: ${ctx.segmentation}
MSRP: $${ctx.msrp.toLocaleString()} | Guidance: ${ctx.guidance_number} members

--- CURRENT STATUS ---
Week ${ctx.week_number} of ${ctx.total_weeks} (${Math.round(ctx.pct_of_transition * 100)}% through transition)
Current paid members: ${ctx.current_paid_members} / ${ctx.guidance_number} (${Math.round(ctx.pct_to_guidance * 100)}% to guidance)
Expected at this point: ${ctx.expected_members} members
Pacing: ${ctx.pacing_status}
Weeks remaining: ${ctx.weeks_remaining}
Members/week needed: ${ctx.members_per_week_needed}
Projected opening: ${ctx.projected_opening_number}

--- RISK ---
Risk score: ${ctx.risk_score} | Tier: ${ctx.risk_tier}

--- TEAM RATINGS (1-5) ---
PA (${ctx.assigned_pa}): ${ctx.pa_rating}/5
Physician engagement: ${ctx.physician_rating}/5
Staff engagement: ${ctx.staff_rating}/5
Physician making personal calls: ${ctx.physician_making_calls ? 'Yes' : 'No'}
Forums: ${ctx.forums_held} held / ${ctx.forums_scheduled} scheduled

--- PIPELINE ---
Survey prospects remaining: ${ctx.survey_prospects_left_pct}%
WTC remaining: ${ctx.wtc_remaining}
Net change last week: ${ctx.net_change >= 0 ? '+' : ''}${ctx.net_change}
Last 4 weeks trend: ${trendStr}

--- OBSTACLES ---
Primary obstacle: ${ctx.primary_obstacle} (${ctx.obstacle_category})
What worked: ${ctx.what_worked}
What didn't: ${ctx.what_didnt}

--- COACHING HISTORY ---
${coachingHistory}

--- BENCHMARKS ---
Similar transitions hit rate: ${Math.round(ctx.similar_hit_rate * 100)}%
Overall hit rate: ${Math.round(ctx.overall_hit_rate * 100)}%
Remaining enrollment expected: ${Math.round(ctx.remaining_enrollment_pct * 100)}%
Recovery rate (near-miss): ${Math.round(ctx.recovery_rate_near_miss * 100)}%
`.trim();
}

export function buildSituationAssessmentPrompt(ctx: CoachingContext): string {
  return `You are a senior healthcare transition advisor analyzing the current state of a physician practice transition.

${contextBlock(ctx)}

Provide a concise SITUATION ASSESSMENT (3-5 paragraphs):
1. Overall status: Is this transition on track? Quantify the gap.
2. Key risks: What are the 2-3 biggest threats to hitting guidance?
3. Momentum: Is the trend improving, flat, or deteriorating? Use the 4-week trend.
4. Team dynamics: Rate the effectiveness of the PA, physician, and staff based on the data.
5. Prognosis: Based on similar transitions (${Math.round(ctx.similar_hit_rate * 100)}% hit rate), what's the realistic outlook?

Be direct and data-driven. Reference specific numbers. Don't sugarcoat — this is for experienced transition managers.`;
}

export function buildRecommendedActionsPrompt(ctx: CoachingContext): string {
  return `You are a senior healthcare transition advisor creating an action plan.

${contextBlock(ctx)}

Provide 4-6 SPECIFIC, ACTIONABLE recommendations prioritized by impact:

For each recommendation:
- **Action**: What exactly to do (be specific, not generic)
- **Why now**: Why this is urgent given the current data
- **Expected impact**: Quantify the expected member gain or risk reduction
- **Owner**: Who should execute (PA, physician, PTM, leadership)
- **Timeline**: This week, next 2 weeks, or ongoing

Focus on:
- Addressing the primary obstacle: "${ctx.primary_obstacle}"
- Building on what worked: "${ctx.what_worked}"
- Fixing what didn't work: "${ctx.what_didnt}"
- PA effectiveness (rated ${ctx.pa_rating}/5)${ctx.pa_rating <= 2 ? ' — consider PA swap' : ''}
- Physician engagement (rated ${ctx.physician_rating}/5)

Be tactical, not strategic. These recommendations should be executable by the end of the week.`;
}

export function buildPhysicianCoachingPlanPrompt(ctx: CoachingContext): string {
  const lastMood = ctx.last_3_coaching_entries.length > 0
    ? ctx.last_3_coaching_entries[0].physician_mood
    : 'Unknown';

  const followThroughRate = ctx.last_3_coaching_entries.filter(e => e.followed_through === true).length;
  const totalWithData = ctx.last_3_coaching_entries.filter(e => e.followed_through !== null).length;

  return `You are a physician relationship coach specializing in practice transitions.

${contextBlock(ctx)}

--- PHYSICIAN COACHING STATE ---
Last known mood: ${lastMood}
Follow-through rate: ${totalWithData > 0 ? `${followThroughRate}/${totalWithData}` : 'No data'}
Making personal calls: ${ctx.physician_making_calls ? 'Yes' : 'No'}

Create a PHYSICIAN COACHING PLAN for the next conversation:

1. **Opening approach**: How to start the conversation given their mood (${lastMood}) and the current numbers
2. **Key talking points** (3-4): What to discuss, with specific data points to reference
3. **Commitment asks** (2-3): Specific, measurable commitments to request from the physician
4. **Objection handling**: Anticipate pushback and prepare responses
5. **Follow-up plan**: When and how to check on commitments

If the physician has been ${ctx.physician_making_calls ? 'making' : 'NOT making'} personal calls, address this directly.
If engagement is low (${ctx.physician_rating}/5), suggest re-engagement strategies.

Tone: Empathetic but firm. The physician needs to feel supported AND accountable.`;
}

export function buildLeadershipTalkingPointsPrompt(ctx: CoachingContext): string {
  return `You are preparing a leadership briefing for a healthcare transition.

${contextBlock(ctx)}

Create LEADERSHIP TALKING POINTS (for presenting to senior leadership):

1. **Status summary** (2 sentences): Current position relative to guidance
2. **Trend** (1 sentence): Direction of travel with data
3. **Risk level**: ${ctx.risk_tier} — explain what this means for guidance attainment
4. **Key challenge**: The #1 thing leadership should know
5. **Ask** (if any): What do you need from leadership? (resources, intervention, etc.)
6. **Projected outcome**: Likely opening number and confidence level
7. **Comparison**: How this compares to similar transitions

Keep it executive-level: concise, numbers-driven, no jargon. Max 150 words total.`;
}

export type CoachingFeature = 'situation_assessment' | 'recommended_actions' | 'physician_coaching_plan' | 'leadership_talking_points';

export function buildPromptForFeature(feature: CoachingFeature, ctx: CoachingContext): string {
  switch (feature) {
    case 'situation_assessment': return buildSituationAssessmentPrompt(ctx);
    case 'recommended_actions': return buildRecommendedActionsPrompt(ctx);
    case 'physician_coaching_plan': return buildPhysicianCoachingPlanPrompt(ctx);
    case 'leadership_talking_points': return buildLeadershipTalkingPointsPrompt(ctx);
  }
}
