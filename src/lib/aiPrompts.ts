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

// ── Prompt Types & Dispatcher ──────────────────────────────────────────

export type CoachingFeature = 'weekly_analysis' | 'coaching_prep' | 'recovery_plan' | 'leadership_update';

export function buildPromptForFeature(feature: CoachingFeature, ctx: CoachingContext): string {
  switch (feature) {
    case 'weekly_analysis': return buildWeeklyAnalysisPrompt(ctx);
    case 'coaching_prep': return buildCoachingPrepPrompt(ctx);
    case 'recovery_plan': return buildRecoveryPlanPrompt(ctx);
    case 'leadership_update': return buildLeadershipUpdatePrompt(ctx);
  }
}

// ── Prompt Builders ────────────────────────────────────────────────────

function buildWeeklyAnalysisPrompt(ctx: CoachingContext): string {
  const coachingHistory = ctx.last_3_coaching_entries.length > 0
    ? ctx.last_3_coaching_entries.map(e =>
        `${e.date} (${e.interaction_type}): Mood=${e.physician_mood}, Confidence=${e.confidence_level}/5. ` +
        `Topics: ${e.topics_covered}. Commitments: ${e.commitments_made}. ` +
        `Followed through: ${e.followed_through === true ? 'Yes' : e.followed_through === false ? 'No' : 'Pending'}`
      ).join('\n')
    : 'No coaching interactions logged yet.';

  const trend = ctx.last_4_weeks_trend.length > 0
    ? ctx.last_4_weeks_trend.join(', ')
    : 'No trend data';

  return `You are an expert MDVIP transition strategist advising a Patient Enrollment Manager (PEM). The PEM does NOT contact patients directly. The PEM manages the transition — coaching the physician, evaluating the Patient Ambassador (PA), coordinating with the Practice Transition Manager (PTM), and making strategic decisions to ensure the transition hits guidance by opening day.

TRANSITION:
- Physician: ${ctx.physician_name} (${ctx.specialty}, ${ctx.coc_type})
- Location: ${ctx.city}, ${ctx.state} | MSRP: $${ctx.msrp.toLocaleString()}
- Guidance: ${ctx.guidance_number} | Current: ${ctx.current_paid_members} (${(ctx.pct_to_guidance * 100).toFixed(0)}%)
- Week ${ctx.week_number} of ${ctx.total_weeks} (${(ctx.pct_of_transition * 100).toFixed(0)}% complete)
- Pacing: ${ctx.pacing_status} — should be at ${ctx.expected_members}, actually at ${ctx.current_paid_members}
- Projected opening number at current pace: ${ctx.projected_opening_number}
- Need ${ctx.members_per_week_needed} members/week for remaining ${ctx.weeks_remaining} weeks
- Risk Score: ${ctx.risk_score} (${ctx.risk_tier})

TEAM EXECUTION THIS WEEK:
- PA Effectiveness: ${ctx.pa_rating}/5 (PA: ${ctx.assigned_pa})
- Physician Engagement: ${ctx.physician_rating}/5
- Staff Engagement: ${ctx.staff_rating}/5
- Physician making personal patient calls: ${ctx.physician_making_calls ? 'Yes' : 'No'}
- Forums held: ${ctx.forums_held} | Scheduled: ${ctx.forums_scheduled}

PIPELINE:
- Survey prospects still uncontacted: ${(ctx.survey_prospects_left_pct * 100).toFixed(0)}%
- WTC 55+ remaining to convert: ${ctx.wtc_remaining}
- Net change this week: ${ctx.net_change > 0 ? '+' : ''}${ctx.net_change}
- Last 4 weeks net change trend: ${trend}

CURRENT OBSTACLE: ${ctx.primary_obstacle}
CATEGORY: ${ctx.obstacle_category}
WHAT WORKED THIS WEEK: ${ctx.what_worked}
WHAT DIDN'T WORK: ${ctx.what_didnt}

RECENT COACHING HISTORY:
${coachingHistory}

BENCHMARK CONTEXT:
- Transitions with this profile hit guidance ${(ctx.similar_hit_rate * 100).toFixed(0)}% of the time
- ${ctx.weeks_remaining} weeks remaining — the enrollment curve says ${(ctx.remaining_enrollment_pct * 100).toFixed(0)}% of members typically join in this remaining window
- Overall FY26 hit rate: ${(ctx.overall_hit_rate * 100).toFixed(0)}%
- Post-open recovery is rare: only ${(ctx.recovery_rate_near_miss * 100).toFixed(0)}% of near-misses recovered after opening

As a transition strategist, provide:

1. SITUATION ASSESSMENT
3 sentences maximum. Where does this transition actually stand? Be direct and honest — don't sugarcoat. Reference the enrollment curve position and what it means for realistic outcomes.

2. YOUR TOP 3 PRIORITIES THIS WEEK
What should the PEM focus their management energy on? Each priority must be a specific action the PEM takes — not what the PA or doctor does, but what the PEM does to DRIVE the right behavior from others. Include who the PEM needs to talk to and what the specific ask is.

3. PHYSICIAN COACHING APPROACH
- What conversation does the PEM need to have with the doctor this week?
- What is the key message? (1 sentence)
- What specific ask should the PEM make?
- How should they frame it given the doctor's current engagement level (${ctx.physician_rating}/5)?
- If the physician mood from the last coaching interaction was negative, how to re-engage without creating defensiveness?

4. PA ASSESSMENT
Based on the PA rating (${ctx.pa_rating}/5) and the numbers, is the current PA effective? If ${ctx.pa_rating <= 2 ? 'the PA has been underperforming' : 'the PA is doing well'}, what should the PEM do? If a PA swap should be considered, how to approach it diplomatically with the PTM.

5. ESCALATION DECISION
Does this need to go to the PTM or leadership? Answer Yes or No with a clear rationale. If yes, provide 2-3 bullet points for that conversation — data-driven, not emotional.

Format your response with clear section headers. Be specific and actionable — no generic advice. Reference the actual numbers and context provided.`;
}

function buildCoachingPrepPrompt(ctx: CoachingContext): string {
  const lastCoaching = ctx.last_3_coaching_entries[0];
  const lastMood = lastCoaching?.physician_mood ?? 'Unknown';
  const lastCommitments = lastCoaching?.commitments_made ?? 'None recorded';
  const followedThrough = lastCoaching?.followed_through;
  const followedThroughText = followedThrough === true ? 'Yes — they followed through'
    : followedThrough === false ? 'No — they did NOT follow through'
    : 'Unknown / not yet assessed';

  return `You are preparing a Patient Enrollment Manager (PEM) for a coaching conversation with a transitioning MDVIP physician. The PEM's goal is to keep the doctor engaged, motivated, and actively participating in the transition — especially making personal patient calls and supporting patient forums.

The PEM is NOT the doctor's boss. The PEM is their strategic partner. Doctors respond to data and autonomy, not pressure.

PHYSICIAN CONTEXT:
- Dr. ${ctx.physician_name}, ${ctx.specialty} in ${ctx.city}, ${ctx.state}
- Current mood/engagement: ${lastMood} (from last coaching interaction)
- Last interaction: ${lastCoaching?.date ?? 'None logged'} (${lastCoaching?.interaction_type ?? 'N/A'})
- Topics discussed last time: ${lastCoaching?.topics_covered ?? 'N/A'}
- Commitments from last call: ${lastCommitments}
- Did they follow through: ${followedThroughText}
- PEM's confidence in follow-through: ${lastCoaching?.confidence_level ?? 'N/A'}/5

TRANSITION STATUS:
- ${ctx.current_paid_members}/${ctx.guidance_number} (${(ctx.pct_to_guidance * 100).toFixed(0)}%) — Pacing: ${ctx.pacing_status}
- ${ctx.weeks_remaining} weeks to opening
- Need ${ctx.members_per_week_needed} members per week
- Projected opening: ${ctx.projected_opening_number}
- Biggest obstacle: ${ctx.primary_obstacle}

WHAT'S WORKING: ${ctx.what_worked}
WHAT'S NOT: ${ctx.what_didnt}

Generate a coaching conversation plan for the PEM:

1. OPENING (2-3 sentences)
Build rapport and acknowledge something positive — even if it's a small win. Reference a specific number or recent progress. If the last interaction mood was negative (${lastMood}), start with empathy before data.

2. THE REAL CONVERSATION
Address the most important issue without being confrontational.
${ctx.physician_rating <= 2 ? '- The physician is disengaged. How does the PEM re-engage without nagging or creating resentment?' : ''}
${ctx.pacing_status === 'BEHIND' || ctx.pacing_status === 'CRITICAL' ? '- The transition is behind. How does the PEM create urgency without panic?' : ''}
${ctx.pa_rating <= 2 ? "- The PA isn't connecting. How does the PEM bring up the possibility of changes to the PA without alarming the doctor?" : ''}
${followedThrough === false ? "- The doctor didn't follow through on their commitment from last time. How does the PEM address this constructively?" : ''}
Provide specific talking points — not vague advice.

3. THE ASK
One specific, concrete thing the PEM needs the doctor to commit to this week.
- Make it small enough to be achievable but meaningful enough to move numbers
- Frame it with data: "If you call these X WTC patients, based on our conversion rates, that could add Y-Z members this week"
- Give the doctor autonomy in HOW they do it, but be specific about WHAT

4. CLOSE (2 sentences)
Reinforce the partnership. Confirm the next touchpoint date. Leave the doctor feeling supported, not pressured.

Write in a natural, conversational tone — this is a coaching guide, not a script. The PEM should adapt these talking points to their own voice.`;
}

function buildRecoveryPlanPrompt(ctx: CoachingContext): string {
  const trend = ctx.last_4_weeks_trend.length > 0
    ? ctx.last_4_weeks_trend.join(', ')
    : 'No trend data';
  const recentAvg = ctx.last_4_weeks_trend.length > 0
    ? (ctx.last_4_weeks_trend.reduce((s, v) => s + v, 0) / ctx.last_4_weeks_trend.length).toFixed(1)
    : '0';

  return `A physician transition is behind pace and needs strategic intervention from the Patient Enrollment Manager (PEM). The PEM does NOT contact patients directly — the PEM orchestrates recovery by managing the physician, PA, PTM, and support resources.

CURRENT STATE:
- Dr. ${ctx.physician_name}: ${ctx.current_paid_members}/${ctx.guidance_number} (${(ctx.pct_to_guidance * 100).toFixed(0)}%)
- Pacing: ${ctx.pacing_status} — should be at ${ctx.expected_members} based on enrollment curve
- ${ctx.weeks_remaining} weeks until opening
- Need ${ctx.members_per_week_needed} members/week (recent weekly average: ${recentAvg})
- Last 4 weeks trend: ${trend}
- PA: ${ctx.assigned_pa} (effectiveness: ${ctx.pa_rating}/5)
- Physician engagement: ${ctx.physician_rating}/5
- Staff engagement: ${ctx.staff_rating}/5
- Primary obstacle: ${ctx.primary_obstacle} (${ctx.obstacle_category})
- Survey prospects uncontacted: ${(ctx.survey_prospects_left_pct * 100).toFixed(0)}%
- WTC 55+ remaining: ${ctx.wtc_remaining}
- Physician making personal calls: ${ctx.physician_making_calls ? 'Yes' : 'No'}
- Forums held: ${ctx.forums_held} | Scheduled: ${ctx.forums_scheduled}

BENCHMARK CONTEXT:
- Similar transitions hit guidance ${(ctx.similar_hit_rate * 100).toFixed(0)}% of the time
- ${(ctx.remaining_enrollment_pct * 100).toFixed(0)}% of members typically enroll in the remaining window
- Post-open recovery rate for near-misses: only ${(ctx.recovery_rate_near_miss * 100).toFixed(0)}%
- Enrollment curve shows 73% of total members join by the midpoint of transition

RECOVERY TACTICS THAT WORKED IN FY26 DATA:
- PA swaps recovered transitions when the ambassador wasn't connecting (recovered 3 transitions)
- After-hours PA calls (5-6 PM) reached working-age 40-54 patients who don't answer during business hours
- Patient forums at capacity drove direct same-day conversions
- Physician personal call lists outperformed PA-only contact — patients respond to their doctor's voice
- SOU (Statement of Understanding) letters mailed to the full remaining patient list (1,000+ mailings)
- Community partnerships (YMCA, home builders, local magazines) generated non-patient joiners
- Scarcity messaging ("spots are limited, we're approaching capacity") created urgency
- Key timing: recovery interventions must happen BEFORE the 50% mark of the transition to be effective

Generate a 2-week recovery sprint plan AS THE PEM — what YOU orchestrate to save this transition:

1. IMMEDIATE (Days 1-3)
What specific calls do you make? What meetings do you set up? What do you request from each stakeholder (physician, PA, PTM, staff)? Be specific — "Call the PTM and request X" not "reach out to the team."

2. ESCALATION (Days 4-7)
What additional support do you bring in? Should you recommend a PA swap — and if so, how do you frame that conversation with the PTM? Does the transition director need to be involved? What specific data do you present to justify the escalation?

3. SUSTAINED PUSH (Days 8-14)
What daily/weekly rhythms do you establish? How do you keep momentum from the first week's interventions? What's the communication cadence with the physician, PA, and PTM during this sprint?

4. PHYSICIAN CONVERSATION
How do you frame the urgency to the doctor without creating panic or triggering cold feet? What's the 2-sentence message? What specific ask do you make? Reference the data to make it feel objective rather than personal.

5. METRICS TO WATCH DAILY
What 3-4 numbers tell you it's working or not? What's the minimum acceptable weekly net change to stay on a recovery trajectory?

6. DECISION POINT
At what specific milestone (week number, member count, or weekly pace) do you escalate to leadership or begin discussing mea culpa? What data do you need to make that call?

Be brutally honest about the math. If the numbers show this transition is likely unrecoverable, say so and explain why — the PEM needs to know when to shift from "save it" to "manage the exit."`;
}

function buildLeadershipUpdatePrompt(ctx: CoachingContext): string {
  const lastCoaching = ctx.last_3_coaching_entries[0];

  return `Generate a concise leadership status update on a physician transition at MDVIP. This will be delivered by a Patient Enrollment Manager (PEM) to their transition director or VP.

TRANSITION: Dr. ${ctx.physician_name} (${ctx.specialty}, ${ctx.coc_type})
LOCATION: ${ctx.city}, ${ctx.state}
STATUS: ${ctx.current_paid_members}/${ctx.guidance_number} (${(ctx.pct_to_guidance * 100).toFixed(0)}%) — ${ctx.pacing_status}
WEEK: ${ctx.week_number} of ${ctx.total_weeks} (${ctx.weeks_remaining} weeks remaining)
RISK: ${ctx.risk_tier} (score: ${ctx.risk_score})
NET CHANGE TREND: Last 4 weeks: ${ctx.last_4_weeks_trend.join(', ')}
NEED: ${ctx.members_per_week_needed} members/week to hit guidance
PROJECTED OPENING: ${ctx.projected_opening_number} (${(ctx.projected_opening_number / ctx.guidance_number * 100).toFixed(0)}% of guidance)
PA: ${ctx.assigned_pa} (rated ${ctx.pa_rating}/5)
PHYSICIAN ENGAGEMENT: ${ctx.physician_rating}/5
PRIMARY OBSTACLE: ${ctx.primary_obstacle}
KEY ACTIONS TAKEN: ${ctx.what_worked || 'None specified'}
LAST PHYSICIAN INTERACTION: ${lastCoaching ? `${lastCoaching.date} — mood: ${lastCoaching.physician_mood}` : 'None logged'}

Generate a 4-5 sentence leadership update that:
1. States the current position clearly with no hedging — use numbers
2. Explains the primary driver of current performance (positive or negative) in one sentence
3. States what you (the PEM) are doing about it — specific actions, not platitudes
4. Gives an honest projected outcome based on the trend
5. Flags if you need leadership support or a decision — and be specific about what you need

Tone: Confident, data-driven, concise. Leadership wants signal, not noise. No fluff, no excuses, no defensive hedging. If the transition is in trouble, say so directly and explain the plan.

Format as a single paragraph — this should read like a Slack message or email, not a report.`;
}
