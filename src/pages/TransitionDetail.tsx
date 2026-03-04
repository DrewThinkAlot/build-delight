import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useTransitions } from '@/contexts/TransitionContext';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { StarRating } from '@/components/shared/StarRating';
import { RiskScoreCard } from '@/components/shared/RiskScoreCard';
import { cn } from '@/lib/utils';
import { ArrowLeft, Phone, Video, Mail, MessageSquare, MapPin, CheckCircle2, XCircle, Clock, Sparkles, Loader2, Copy, RefreshCw, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ENROLLMENT_CURVE, getExpectedPct } from '@/data/sampleData';
import { useState, useEffect, useMemo } from 'react';
import { getActiveWeights, calculateRiskScore, getSimilarTransitions, type ActiveWeightsResult, type RiskScoreResult, type BenchmarkComparison } from '@/lib/riskScorer';
import { useCoachingAI } from '@/hooks/useCoachingAI';
import { CoachingFeature } from '@/lib/aiPrompts';
import { getCachedContent } from '@/lib/aiCoachingService';
import { toast } from 'sonner';

const tabs = ['Overview', 'Weekly Updates', 'Coaching Log', 'AI Coaching', 'Alerts'] as const;

const moodEmoji: Record<string, string> = {
  enthusiastic: '🔥', engaged: '😊', neutral: '😐', frustrated: '😤', disengaged: '😞', cold_feet: '🥶',
};

const interactionIcon: Record<string, typeof Phone> = {
  phone_call: Phone, zoom: Video, email: Mail, text: MessageSquare, in_person_visit: MapPin,
};

export default function TransitionDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'coaching' ? 'AI Coaching' : 'Overview';
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>(initialTab);
  const { getTransition, getUpdatesForTransition, getLogsForTransition, getAlertsForTransition, getLatestUpdate } = useTransitions();

  // Risk scoring hooks (must be before early return)
  const [calibration, setCalibration] = useState<ActiveWeightsResult | null>(null);
  useEffect(() => { getActiveWeights().then(setCalibration); }, []);

  const transition = getTransition(id!);
  const updates = transition ? getUpdatesForTransition(id!) : [];
  const logs = transition ? getLogsForTransition(id!) : [];
  const alerts = transition ? getAlertsForTransition(id!) : [];
  const latest = transition ? getLatestUpdate(id!) : undefined;

  const liveRisk: RiskScoreResult | null = useMemo(() => {
    if (!calibration || !transition) return null;
    const input = {
      coc_type: transition.coc_type || '',
      guidance_number: transition.guidance_number,
      msrp_at_open: transition.msrp_at_open ?? null,
      total_weeks: transition.total_weeks ?? null,
      state: transition.state || '',
      physician_full_time: transition.physician_full_time,
      physician_has_strong_patient_relationships: transition.physician_has_strong_patient_relationships,
      physician_comfortable_discussing_fees: transition.physician_comfortable_discussing_fees,
      physician_engagement_level: transition.physician_engagement_level || 'High',
      partner_group_aligned: transition.partner_group_aligned,
      medicaid_pct: transition.medicaid_pct ?? null,
      medicare_dual_pct: transition.medicare_dual_pct ?? null,
      pre_survey_patients: transition.pre_survey_patients ?? null,
      pre_survey_over_55: transition.pre_survey_over_55 ?? null,
      specialty: transition.specialty,
    };
    const result = calculateRiskScore(input, calibration.weights);
    result.calibration_date = calibration.calibrationDate;
    result.n_historical = calibration.nTransitions;
    return result;
  }, [transition, calibration]);

  const comparisons: BenchmarkComparison[] = useMemo(() => {
    if (!calibration || !transition) return [];
    return getSimilarTransitions({
      coc_type: transition.coc_type || '', guidance_number: transition.guidance_number,
      msrp_at_open: null, total_weeks: null, state: transition.state || '',
      physician_full_time: true, physician_has_strong_patient_relationships: true,
      physician_comfortable_discussing_fees: true, physician_engagement_level: 'High',
      partner_group_aligned: true, medicaid_pct: null, medicare_dual_pct: null,
      pre_survey_patients: null, pre_survey_over_55: null, specialty: transition.specialty,
    }, calibration.benchmarks);
  }, [transition, calibration]);

  if (!transition) return <div className="text-center py-12 text-muted-foreground">Transition not found</div>;

  // Chart data
  const totalWeeks = transition.total_weeks || 20;
  const chartData = Array.from({ length: totalWeeks + 1 }, (_, i) => {
    const pct = i / totalWeeks;
    const expected = Math.round(transition.guidance_number * getExpectedPct(pct));
    const update = updates.find(u => u.week_number === i);
    return {
      week: i,
      expected,
      actual: update?.current_paid_members ?? null,
    };
  });
  // Fill actual up to latest week
  const sortedUpdates = [...updates].sort((a, b) => a.week_number - b.week_number);
  sortedUpdates.forEach(u => {
    const idx = chartData.findIndex(d => d.week === u.week_number);
    if (idx >= 0) chartData[idx].actual = u.current_paid_members;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">{transition.physician_name}</h1>
          <p className="text-sm text-muted-foreground">{transition.specialty} • {transition.city}, {transition.state} • {transition.coc_type}</p>
        </div>
        <div className="ml-auto">
          <StatusBadge status={latest?.pacing_status || transition.risk_tier || 'LOW'} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === tab ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}>
            {tab}
            {tab === 'Alerts' && alerts.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-status-critical/20 text-status-critical">{alerts.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'Overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
            {/* Risk score card */}
            <RiskScoreCard liveRisk={liveRisk} comparisons={comparisons} calibration={calibration} />

            <div className="space-y-4">
              {/* Pacing */}
              <div className="metric-card">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Progress</p>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {transition.current_paid_members || 0} <span className="text-muted-foreground text-base">/ {transition.guidance_number}</span>
                </div>
                <ProgressBar value={transition.current_paid_members || 0} max={transition.guidance_number} className="mt-2" />
                {latest && (
                  <div className="text-xs text-muted-foreground mt-2 space-y-1">
                    <p>Need {latest.members_per_week_needed}/week to hit guidance</p>
                    <p>Projected opening: {latest.projected_opening_number}</p>
                  </div>
                )}
              </div>

              {/* Team */}
              <div className="metric-card">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Team</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">PA</span><span className="text-foreground">{transition.assigned_pa}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">PTM</span><span className="text-foreground">{transition.assigned_ptm}</span></div>
                  {latest && (
                    <>
                      <div className="flex justify-between items-center"><span className="text-muted-foreground">PA Rating</span><StarRating value={latest.pa_effectiveness_rating || 0} /></div>
                      <div className="flex justify-between items-center"><span className="text-muted-foreground">Physician</span><StarRating value={latest.physician_engagement_rating || 0} /></div>
                      <div className="flex justify-between items-center"><span className="text-muted-foreground">Staff</span><StarRating value={latest.staff_engagement_rating || 0} /></div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Enrollment curve */}
          <div className="metric-card">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Enrollment Curve</p>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 25%, 18%)" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(215, 20%, 55%)' }} label={{ value: 'Week', position: 'insideBottom', offset: -5, fill: 'hsl(215, 20%, 55%)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(215, 20%, 55%)' }} />
                <Tooltip contentStyle={{ background: 'hsl(215, 35%, 10%)', border: '1px solid hsl(215, 25%, 18%)', borderRadius: '6px', color: 'hsl(210, 40%, 96%)' }} />
                <Area type="monotone" dataKey="expected" stroke="hsl(210, 60%, 50%)" fill="hsl(210, 60%, 50%)" fillOpacity={0.1} strokeDasharray="5 5" name="Expected" />
                <Area type="monotone" dataKey="actual" stroke="hsl(142, 70%, 45%)" fill="hsl(142, 70%, 45%)" fillOpacity={0.15} name="Actual" connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            <Link to={`/transitions/${id}/update`} className="px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/80 transition-colors">
              Log Weekly Update
            </Link>
            <Link to={`/transitions/${id}/coaching/new`} className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">
              Log Coaching Interaction
            </Link>
          </div>
        </div>
      )}

      {activeTab === 'Weekly Updates' && (
        <div className="space-y-4">
          <Link to={`/transitions/${id}/update`} className="inline-flex px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/80 transition-colors">
            + Log Weekly Update
          </Link>
          {updates.length === 0 ? (
            <p className="text-muted-foreground text-sm">No weekly updates yet.</p>
          ) : (
            <div className="space-y-3">
              {updates.map(u => (
                <div key={u.id} className="metric-card">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono font-bold text-foreground">W{u.week_number}</span>
                    <span className="text-sm text-muted-foreground">{u.update_date}</span>
                    <StatusBadge status={u.pacing_status || 'ON_TRACK'} />
                    <span className="font-mono text-foreground">{u.current_paid_members} members</span>
                    <span className={cn('text-sm font-mono', (u.net_change_from_last_week || 0) >= 0 ? 'text-status-ahead' : 'text-status-critical')}>
                      {(u.net_change_from_last_week || 0) >= 0 ? '+' : ''}{u.net_change_from_last_week}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground">PA</span><StarRating value={u.pa_effectiveness_rating || 0} /></div>
                    <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground">Dr</span><StarRating value={u.physician_engagement_rating || 0} /></div>
                    <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground">Staff</span><StarRating value={u.staff_engagement_rating || 0} /></div>
                  </div>
                  {u.notes && <p className="text-sm text-muted-foreground mt-2">{u.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'Coaching Log' && (
        <div className="space-y-4">
          <Link to={`/transitions/${id}/coaching/new`} className="inline-flex px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/80 transition-colors">
            + Log Coaching Interaction
          </Link>
          {logs.length >= 3 && (
            <div className="metric-card">
              <span className="text-sm text-muted-foreground">Engagement trending </span>
              {(() => {
                const recent = logs.slice(0, 3);
                const moods = recent.map(l => ['cold_feet', 'disengaged', 'frustrated', 'neutral', 'engaged', 'enthusiastic'].indexOf(l.physician_mood || 'neutral'));
                const trend = moods[0] > moods[2] ? '↑' : moods[0] < moods[2] ? '↓' : '→';
                return <span className={cn('text-lg font-bold', trend === '↑' ? 'text-status-ahead' : trend === '↓' ? 'text-status-critical' : 'text-status-on-track')}>{trend}</span>;
              })()}
              <span className="text-sm text-muted-foreground ml-1">over last 3 interactions</span>
            </div>
          )}
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No coaching logs yet.</p>
          ) : (
            <div className="space-y-3">
              {logs.map(l => {
                const Icon = interactionIcon[l.interaction_type] || Phone;
                return (
                  <div key={l.id} className="metric-card">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Icon className="h-4 w-4 text-accent" />
                      <span className="text-sm font-medium text-foreground">{l.log_date}</span>
                      <span className="text-lg">{moodEmoji[l.physician_mood || 'neutral']}</span>
                      <span className="text-xs text-muted-foreground">{l.duration_minutes}min</span>
                      <StarRating value={l.confidence_level || 0} />
                      {l.followed_through === true && <CheckCircle2 className="h-4 w-4 text-status-ahead" />}
                      {l.followed_through === false && <XCircle className="h-4 w-4 text-status-critical" />}
                      {l.followed_through === undefined && l.follow_up_needed && <Clock className="h-4 w-4 text-status-behind" />}
                    </div>
                    {l.topics_covered && <p className="text-sm text-foreground mt-2">{l.topics_covered}</p>}
                    {l.commitments_made && <p className="text-sm text-muted-foreground mt-1"><span className="text-accent">Commitments:</span> {l.commitments_made}</p>}
                    {l.your_action_items && <p className="text-sm text-muted-foreground mt-1"><span className="text-accent">Your actions:</span> {l.your_action_items}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'AI Coaching' && (
        <div className="space-y-4">
          {[
            { title: 'Weekly Situation Analysis', desc: 'Assessment & recommended actions', field: 'ai_situation_assessment' },
            { title: 'Physician Coaching Prep', desc: 'Coaching plan for your next interaction', field: 'ai_physician_coaching_plan' },
            ...(latest?.pacing_status === 'BEHIND' || latest?.pacing_status === 'CRITICAL'
              ? [{ title: 'Recovery Plan', desc: 'Structured recovery strategy', field: 'recovery' }]
              : []),
            { title: 'Leadership Update', desc: 'Talking points for leadership', field: 'ai_leadership_talking_points' },
          ].map(section => (
            <div key={section.title} className="metric-card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-accent" /> {section.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">{section.desc}</p>
                </div>
                <button className="px-3 py-1.5 rounded bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors">
                  Generate
                </button>
              </div>
              <textarea
                className="w-full min-h-[120px] bg-muted/50 border border-border rounded-md p-3 text-sm text-foreground placeholder:text-muted-foreground resize-y"
                placeholder="AI-generated content will appear here. You can also paste content manually."
              />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'Alerts' && (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active alerts.</p>
          ) : (
            alerts.map(a => (
              <div key={a.id} className="metric-card flex items-start gap-3">
                <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0',
                  a.severity === 'CRITICAL' ? 'bg-status-critical animate-pulse-glow' :
                  a.severity === 'HIGH' ? 'bg-status-behind' : 'bg-status-on-track'
                )} />
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={a.severity} />
                    <span className="text-sm font-medium text-foreground">{a.rule_name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{a.message}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
