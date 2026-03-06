import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useTransition, useCoachingLogs, useAlerts } from '@/hooks/useTransitionData';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { StarRating } from '@/components/shared/StarRating';
import { RiskScoreCard } from '@/components/shared/RiskScoreCard';
import { cn } from '@/lib/utils';
import { ArrowLeft, Phone, Video, Mail, MessageSquare, MapPin, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ENROLLMENT_CURVE, getExpectedPct } from '@/lib/enrollmentCurve';
import { useState, useEffect, useMemo } from 'react';
import { getActiveWeights, calculateRiskScore, getSimilarTransitions, type ActiveWeightsResult, type RiskScoreResult, type BenchmarkComparison } from '@/lib/riskScorer';
import { useTransitionIntelligence } from '@/hooks/useWeeklySnapshots';
import { WeeklyIntelligencePanel } from '@/components/weekly-intelligence/WeeklyIntelligencePanel';
import { SnapshotModal } from '@/components/weekly-intelligence/SnapshotModal';
import { AICoachingTab } from '@/components/ai-coaching/AICoachingTab';
import { DetailSkeleton } from '@/components/shared/PageSkeleton';

const tabs = ['Overview', 'Weekly Snapshots', 'Coaching Log', 'AI Coaching', 'Alerts'] as const;

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

  const { data: transition, isLoading: tLoading } = useTransition(id);
  const { data: logs = [], isLoading: lLoading } = useCoachingLogs(id);
  const { data: alerts = [] } = useAlerts(id);

  // Risk scoring
  const [calibration, setCalibration] = useState<ActiveWeightsResult | null>(null);
  useEffect(() => { getActiveWeights().then(setCalibration); }, []);

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

  // Weekly Intelligence
  const { intel, loading: intelLoading, refresh: refreshIntel } = useTransitionIntelligence(transition);
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);

  const snapshots = intel?.snapshots ?? [];
  const latestSnap = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  if (tLoading || lLoading) return <DetailSkeleton />;
  if (!transition) return <div className="text-center py-12 text-muted-foreground">Transition not found</div>;

  // Chart data from snapshots
  const totalWeeks = transition.total_weeks || 20;
  const startDate = new Date(transition.transition_start);
  const chartData = Array.from({ length: totalWeeks + 1 }, (_, i) => {
    const pct = i / totalWeeks;
    const expected = Math.round(transition.guidance_number * getExpectedPct(pct));
    return { week: i, expected, actual: null as number | null };
  });
  // Map snapshots to week indices
  snapshots.forEach(s => {
    const snapDate = new Date(s.week_ending_date);
    const weekIdx = Math.round((snapDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (weekIdx >= 0 && weekIdx <= totalWeeks) {
      chartData[weekIdx] = { ...chartData[weekIdx], actual: s.paid_members };
    }
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
          <StatusBadge status={latestSnap?.pacing_status || transition.risk_tier || 'LOW'} />
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
          {intel && (
            <WeeklyIntelligencePanel
              transition={transition}
              intel={intel}
              onRefresh={refreshIntel}
              onOpenSnapshot={() => setSnapshotModalOpen(true)}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Static Intake Risk</p>
              <RiskScoreCard liveRisk={liveRisk} comparisons={comparisons} calibration={calibration} />
            </div>

            <div className="space-y-4">
              <div className="metric-card">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Progress</p>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {latestSnap?.paid_members ?? transition.current_paid_members ?? 0} <span className="text-muted-foreground text-base">/ {transition.guidance_number}</span>
                </div>
                <ProgressBar value={latestSnap?.paid_members ?? transition.current_paid_members ?? 0} max={transition.guidance_number} className="mt-2" />
                {intel?.metrics && (
                  <div className="text-xs text-muted-foreground mt-2 space-y-1">
                    <p>Projected at opening: {intel.metrics.projected_paid_at_opening}</p>
                  </div>
                )}
              </div>

              <div className="metric-card">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Team</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">PA</span><span className="text-foreground">{transition.assigned_pa}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">PTM</span><span className="text-foreground">{transition.assigned_ptm}</span></div>
                  {latestSnap && (
                    <>
                      <div className="flex justify-between items-center"><span className="text-muted-foreground">PA Rating</span><StarRating value={latestSnap.pa_effectiveness_rating || 0} /></div>
                      <div className="flex justify-between items-center"><span className="text-muted-foreground">Physician</span><StarRating value={latestSnap.physician_engagement_rating || 0} /></div>
                      <div className="flex justify-between items-center"><span className="text-muted-foreground">Staff</span><StarRating value={latestSnap.staff_engagement_rating || 0} /></div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

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

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setSnapshotModalOpen(true)}
              className="px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/80 transition-colors"
            >
              Log Weekly Snapshot
            </button>
            <Link to={`/transitions/${id}/coaching/new`} className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">
              Log Coaching Interaction
            </Link>
          </div>
        </div>
      )}

      {activeTab === 'Weekly Snapshots' && (
        <div className="space-y-4">
          <button
            onClick={() => setSnapshotModalOpen(true)}
            className="inline-flex px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/80 transition-colors"
          >
            + Log Weekly Snapshot
          </button>
          {snapshots.length === 0 ? (
            <p className="text-muted-foreground text-sm">No weekly snapshots yet.</p>
          ) : (
            <div className="space-y-3">
              {[...snapshots].reverse().map(s => {
                const prevIdx = snapshots.indexOf(s) - 1;
                const prev = prevIdx >= 0 ? snapshots[prevIdx] : null;
                const change = prev ? s.paid_members - prev.paid_members : null;
                return (
                  <div key={s.id} className="metric-card">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm text-muted-foreground">{s.week_ending_date}</span>
                      {s.pacing_status && <StatusBadge status={s.pacing_status} />}
                      <span className="font-mono text-foreground">{s.paid_members} members</span>
                      {change !== null && (
                        <span className={cn('text-sm font-mono', change >= 0 ? 'text-status-ahead' : 'text-status-critical')}>
                          {change >= 0 ? '+' : ''}{change}
                        </span>
                      )}
                    </div>
                    {(s.pa_effectiveness_rating || s.physician_engagement_rating || s.staff_engagement_rating) && (
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        {s.pa_effectiveness_rating && <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground">PA</span><StarRating value={s.pa_effectiveness_rating} /></div>}
                        {s.physician_engagement_rating && <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground">Dr</span><StarRating value={s.physician_engagement_rating} /></div>}
                        {s.staff_engagement_rating && <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground">Staff</span><StarRating value={s.staff_engagement_rating} /></div>}
                      </div>
                    )}
                    {s.notes && <p className="text-sm text-muted-foreground mt-2">{s.notes}</p>}
                  </div>
                );
              })}
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
        <AICoachingTab transition={transition} snapshots={snapshots} logs={logs} />
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

      {transition && (
        <SnapshotModal
          open={snapshotModalOpen}
          onOpenChange={setSnapshotModalOpen}
          transition={transition}
          onSaved={refreshIntel}
        />
      )}
    </div>
  );
}
