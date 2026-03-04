import { Transition, WeeklyUpdate, CoachingLog, Alert } from '@/types/transition';

export const ENROLLMENT_CURVE: [number, number][] = [
  [0.00, 0.050], [0.05, 0.143], [0.10, 0.273], [0.15, 0.393], [0.20, 0.463],
  [0.25, 0.518], [0.30, 0.562], [0.35, 0.607], [0.40, 0.651], [0.45, 0.693],
  [0.50, 0.730], [0.55, 0.757], [0.60, 0.789], [0.65, 0.820], [0.70, 0.850],
  [0.75, 0.870], [0.80, 0.900], [0.85, 0.920], [0.90, 0.940], [0.95, 0.970],
  [1.00, 1.000],
];

export function getExpectedPct(pctOfTransition: number): number {
  for (let i = 0; i < ENROLLMENT_CURVE.length - 1; i++) {
    const [x0, y0] = ENROLLMENT_CURVE[i];
    const [x1, y1] = ENROLLMENT_CURVE[i + 1];
    if (pctOfTransition >= x0 && pctOfTransition <= x1) {
      const t = (pctOfTransition - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return 1.0;
}


function weeksRemaining(openingDate: string): number {
  const now = new Date();
  const open = new Date(openingDate);
  return Math.max(0, Math.ceil((open.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000)));
}

function totalWeeks(start: string, end: string): number {
  return Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function pctElapsed(start: string, end: string): number {
  const total = totalWeeks(start, end);
  const elapsed = total - weeksRemaining(end);
  return Math.min(1, Math.max(0, elapsed / total));
}

export const sampleTransitions: Transition[] = [
  {
    id: 't1',
    physician_name: 'Dr. Sarah Chen',
    physician_id: 'SC-2026-01',
    transition_start: '2026-01-05',
    opening_date: '2026-05-25',
    guidance_number: 275,
    be_best_practice: 220,
    msrp_at_open: 2400,
    pre_survey_patients: 3200,
    pre_survey_over_55: 1900,
    post_survey_patients: 2800,
    wtc_55_plus: 850,
    segmentation: 'Internal Medicine / COC In',
    coc_type: 'COC In',
    specialty: 'Internal Medicine',
    state: 'TX',
    city: 'Austin',
    medicaid_pct: 0.08,
    medicare_dual_pct: 0.05,
    physician_engagement_level: 'High',
    physician_full_time: true,
    physician_has_strong_patient_relationships: true,
    physician_comfortable_discussing_fees: true,
    partner_group_aligned: true,
    assigned_pa: 'Maria Lopez',
    assigned_ptm: 'James Wilson',
    status: 'active',
    risk_score: 0,
    risk_tier: 'LOW',
    total_weeks: totalWeeks('2026-01-05', '2026-05-25'),
    current_paid_members: 121,
  },
  {
    id: 't2',
    physician_name: 'Dr. Robert Martinez',
    physician_id: 'RM-2025-12',
    transition_start: '2025-12-01',
    opening_date: '2026-04-13',
    guidance_number: 225,
    be_best_practice: 180,
    msrp_at_open: 2800,
    pre_survey_patients: 1800,
    pre_survey_over_55: 950,
    post_survey_patients: 1500,
    wtc_55_plus: 320,
    segmentation: 'Family Medicine / COC Out',
    coc_type: 'COC Out',
    specialty: 'Family Medicine',
    state: 'PA',
    city: 'Philadelphia',
    medicaid_pct: 0.18,
    medicare_dual_pct: 0.12,
    physician_engagement_level: 'Medium',
    physician_full_time: true,
    physician_has_strong_patient_relationships: false,
    physician_comfortable_discussing_fees: false,
    partner_group_aligned: true,
    assigned_pa: 'David Kim',
    assigned_ptm: 'James Wilson',
    status: 'active',
    risk_score: 64,
    risk_tier: 'CRITICAL',
    total_weeks: totalWeeks('2025-12-01', '2026-04-13'),
    current_paid_members: 76,
  },
  {
    id: 't3',
    physician_name: 'Dr. Lisa Park',
    physician_id: 'LP-2025-09',
    transition_start: '2025-09-15',
    opening_date: '2026-02-09',
    guidance_number: 300,
    be_best_practice: 240,
    msrp_at_open: 2200,
    pre_survey_patients: 3500,
    pre_survey_over_55: 2100,
    post_survey_patients: 3000,
    wtc_55_plus: 1100,
    segmentation: 'Family Medicine / COC In',
    coc_type: 'COC In',
    specialty: 'Family Medicine',
    state: 'TX',
    city: 'Houston',
    physician_engagement_level: 'High',
    physician_full_time: true,
    physician_has_strong_patient_relationships: true,
    physician_comfortable_discussing_fees: true,
    partner_group_aligned: true,
    assigned_pa: 'Rachel Green',
    assigned_ptm: 'James Wilson',
    status: 'completed',
    risk_score: 0,
    risk_tier: 'LOW',
    total_weeks: totalWeeks('2025-09-15', '2026-02-09'),
    current_paid_members: 312,
  },
];

export const sampleWeeklyUpdates: WeeklyUpdate[] = [
  // Dr. Chen updates
  ...[
    { week: 1, members: 42, pa: 4, phys: 5, staff: 4 },
    { week: 2, members: 68, pa: 4, phys: 5, staff: 4 },
    { week: 3, members: 95, pa: 5, phys: 5, staff: 5 },
    { week: 4, members: 121, pa: 5, phys: 5, staff: 5 },
  ].map((u, i) => ({
    id: `wu-t1-${u.week}`,
    transition_id: 't1',
    week_number: u.week,
    update_date: new Date(new Date('2026-01-05').getTime() + u.week * 7 * 86400000).toISOString().slice(0, 10),
    current_paid_members: u.members,
    net_change_from_last_week: i === 0 ? u.members : u.members - [42, 68, 95, 121][i - 1],
    survey_prospects_left_pct: 0.7 - u.week * 0.1,
    wtc_remaining: 850 - u.members * 2,
    expected_members_at_this_point: Math.round(275 * getExpectedPct(u.week / totalWeeks('2026-01-05', '2026-05-25'))),
    pacing_status: 'AHEAD' as const,
    pct_to_guidance: u.members / 275,
    projected_opening_number: Math.round(u.members / getExpectedPct(u.week / totalWeeks('2026-01-05', '2026-05-25'))),
    members_per_week_needed: Math.round((275 - u.members) / (totalWeeks('2026-01-05', '2026-05-25') - u.week)),
    pa_effectiveness_rating: u.pa,
    physician_engagement_rating: u.phys,
    staff_engagement_rating: u.staff,
    physician_making_personal_calls: true,
    forums_scheduled: 2,
    forums_held: u.week <= 2 ? 0 : 1,
    forum_attendance: u.week <= 2 ? 0 : 45,
    pa_swap_considered: false,
    pa_swap_executed: false,
    strategy_change_made: false,
    notes: `Week ${u.week} going well. Strong momentum.`,
    leadership_update_sent: true,
    ptm_sync_completed: true,
    physician_coaching_call_completed: true,
    created_at: new Date().toISOString(),
  })),
  // Dr. Martinez updates
  ...[
    { week: 1, members: 18, pa: 3, phys: 4, staff: 3 },
    { week: 2, members: 32, pa: 3, phys: 3, staff: 3 },
    { week: 3, members: 44, pa: 2, phys: 3, staff: 3 },
    { week: 4, members: 55, pa: 2, phys: 3, staff: 2 },
    { week: 5, members: 63, pa: 2, phys: 2, staff: 2 },
    { week: 6, members: 69, pa: 2, phys: 2, staff: 2 },
    { week: 7, members: 73, pa: 1, phys: 2, staff: 2 },
    { week: 8, members: 76, pa: 1, phys: 2, staff: 2 },
  ].map((u, i) => ({
    id: `wu-t2-${u.week}`,
    transition_id: 't2',
    week_number: u.week,
    update_date: new Date(new Date('2025-12-01').getTime() + u.week * 7 * 86400000).toISOString().slice(0, 10),
    current_paid_members: u.members,
    net_change_from_last_week: i === 0 ? u.members : u.members - [18, 32, 44, 55, 63, 69, 73, 76][i - 1],
    survey_prospects_left_pct: 0.65 - u.week * 0.03,
    wtc_remaining: 320 - u.members,
    expected_members_at_this_point: Math.round(225 * getExpectedPct(u.week / totalWeeks('2025-12-01', '2026-04-13'))),
    pacing_status: u.week <= 3 ? 'ON_TRACK' as const : u.week <= 5 ? 'BEHIND' as const : 'CRITICAL' as const,
    pct_to_guidance: u.members / 225,
    projected_opening_number: Math.round(u.members / getExpectedPct(u.week / totalWeeks('2025-12-01', '2026-04-13'))),
    members_per_week_needed: Math.round((225 - u.members) / Math.max(1, totalWeeks('2025-12-01', '2026-04-13') - u.week)),
    pa_effectiveness_rating: u.pa,
    physician_engagement_rating: u.phys,
    staff_engagement_rating: u.staff,
    physician_making_personal_calls: u.week <= 2,
    forums_scheduled: 0,
    forums_held: 0,
    pa_swap_considered: u.week >= 6,
    pa_swap_executed: false,
    strategy_change_made: false,
    notes: u.week >= 6 ? 'Momentum stalling. Need intervention.' : `Week ${u.week} update.`,
    primary_obstacle: u.week >= 5 ? 'PA not connecting with patients' : undefined,
    obstacle_category: u.week >= 5 ? 'pa_effectiveness' : undefined,
    leadership_update_sent: u.week % 2 === 0,
    ptm_sync_completed: true,
    physician_coaching_call_completed: u.week <= 5,
    created_at: new Date().toISOString(),
  })),
];

export const sampleCoachingLogs: CoachingLog[] = [
  {
    id: 'cl-1',
    transition_id: 't1',
    log_date: '2026-01-15',
    interaction_type: 'phone_call',
    duration_minutes: 25,
    topics_covered: 'Reviewed week 2 numbers. Discussed forum planning.',
    commitments_made: 'Will call top 20 patients personally this week.',
    your_action_items: 'Send forum logistics checklist to PTM.',
    physician_mood: 'enthusiastic',
    confidence_level: 5,
    follow_up_needed: false,
    followed_through: true,
    created_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 'cl-2',
    transition_id: 't2',
    log_date: '2026-01-10',
    interaction_type: 'zoom',
    duration_minutes: 40,
    topics_covered: 'Discussed declining velocity. PA performance concerns.',
    commitments_made: 'Will start making personal calls. Will attend next forum.',
    your_action_items: 'Evaluate PA swap options. Prepare recovery plan.',
    physician_mood: 'frustrated',
    confidence_level: 2,
    follow_up_needed: true,
    follow_up_date: '2026-01-17',
    follow_up_notes: 'Check if personal calls started.',
    followed_through: false,
    created_at: '2026-01-10T14:00:00Z',
  },
  {
    id: 'cl-3',
    transition_id: 't2',
    log_date: '2026-01-20',
    interaction_type: 'in_person_visit',
    duration_minutes: 60,
    topics_covered: 'In-person strategy session. Reviewed all data together.',
    commitments_made: 'Agreed to 3 personal calls per day. Will champion next forum.',
    your_action_items: 'Request PA evaluation from PTM. Draft recovery plan.',
    physician_mood: 'engaged',
    confidence_level: 3,
    follow_up_needed: true,
    follow_up_date: '2026-01-27',
    follow_up_notes: 'Verify call volume with staff.',
    created_at: '2026-01-20T09:00:00Z',
  },
];

export const sampleAlerts: Alert[] = [
  {
    id: 'a1',
    transition_id: 't2',
    severity: 'CRITICAL',
    rule_name: 'Critical Pacing',
    message: 'Enrollment critically behind curve. Activate recovery plan.',
    created_at: '2026-01-28T00:00:00Z',
  },
  {
    id: 'a2',
    transition_id: 't2',
    severity: 'HIGH',
    rule_name: 'PA Underperforming',
    message: 'PA rated ≤2/5 for 3 consecutive weeks. Consider PA swap.',
    created_at: '2026-01-28T00:00:00Z',
  },
  {
    id: 'a3',
    transition_id: 't2',
    severity: 'HIGH',
    rule_name: 'Declining Velocity',
    message: 'Net member change declining for 3 consecutive weeks.',
    created_at: '2026-01-28T00:00:00Z',
  },
  {
    id: 'a4',
    transition_id: 't2',
    severity: 'MODERATE',
    rule_name: 'No Forums Planned',
    message: 'No forums scheduled. 40%+ through transition and not ahead.',
    created_at: '2026-01-28T00:00:00Z',
  },
  {
    id: 'a5',
    transition_id: 't2',
    severity: 'MODERATE',
    rule_name: 'No Physician Calls',
    message: 'Doctor not making personal calls past week 3.',
    created_at: '2026-01-28T00:00:00Z',
  },
];
