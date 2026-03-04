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
import { useTransitionIntelligence } from '@/hooks/useWeeklySnapshots';
import { WeeklyIntelligencePanel } from '@/components/weekly-intelligence/WeeklyIntelligencePanel';
import { SnapshotModal } from '@/components/weekly-intelligence/SnapshotModal';

const tabs = ['Overview', 'Weekly Updates', 'Coaching Log', 'AI Coaching', 'Alerts'] as const;

const moodEmoji: Record<string, string> = {
  enthusiastic: '🔥', engaged: '😊', neutral: '😐', frustrated: '😤', disengaged: '😞', cold_feet: '🥶',
};

const interactionIcon: Record<string, typeof Phone> = {
  phone_call: Phone, zoom: Video, email: Mail, text: MessageSquare, in_person_visit: MapPin,
};

// ── AI Coaching Tab Component ───────────────────────────────────────────

import { Transition, WeeklyUpdate, CoachingLog } from '@/types/transition';

interface AICoachingTabProps {
  transition: Transition;
  updates: WeeklyUpdate[];
  logs: CoachingLog[];
  latest: WeeklyUpdate | undefined;
}

const SECTIONS: {
  key: CoachingFeature;
  title: string;
  desc: string;
  bgClass: string;
}[] = [
  { key: 'weekly_analysis', title: 'Weekly Situation Analysis', desc: 'Assessment, priorities & recommended actions', bgClass: 'bg-blue-500/5 border-blue-500/20' },
  { key: 'coaching_prep', title: 'Physician Coaching Prep', desc: 'Conversation plan for your next physician interaction', bgClass: 'bg-emerald-500/5 border-emerald-500/20' },
  { key: 'recovery_plan', title: 'Recovery Sprint Plan', desc: '2-week recovery playbook when pacing falls behind', bgClass: 'bg-amber-500/5 border-amber-500/20' },
  { key: 'leadership_update', title: 'Leadership Update', desc: 'Concise status update for leadership briefing', bgClass: 'bg-purple-500/5 border-purple-500/20' },
];

function AICoachingSection({ section, transition, updates, logs, latest }: {
  section: typeof SECTIONS[number];
  transition: Transition;
  updates: WeeklyUpdate[];
  logs: CoachingLog[];
  latest: WeeklyUpdate | undefined;
}) {
  const { generateForTransition, isLoading, content, error, result, reset } = useCoachingAI();
  const [hasGenerated, setHasGenerated] = useState(false);

  // Load cached content on mount
  useEffect(() => {
    const cached = getCachedContent(updates, section.key);
    if (cached) {
      generateForTransition(transition, updates, logs, section.key, false);
      setHasGenerated(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = async (regenerate = false) => {
    setHasGenerated(true);
    await generateForTransition(transition, updates, logs, section.key, regenerate);
  };

  const handleCopy = (forSlack = false) => {
    let text = content;
    if (forSlack) {
      // Strip markdown headers for Slack
      text = text.replace(/^#{1,3}\s+/gm, '').replace(/\*\*/g, '*');
    }
    navigator.clipboard.writeText(text);
    toast.success(forSlack ? 'Copied for Slack' : 'Copied to clipboard');
  };

  // Recovery plan: only show when behind
  if (section.key === 'recovery_plan') {
    const pacing = latest?.pacing_status;
    if (pacing !== 'BEHIND' && pacing !== 'CRITICAL') {
      return (
        <div className="metric-card opacity-60">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-muted-foreground">{section.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Recovery plan available when pacing falls behind.</p>
        </div>
      );
    }
  }

  // Coaching prep: show last coaching entry context
  const lastLog = logs[0];

  return (
    <div className={cn('rounded-lg border p-4 space-y-3', section.bgClass)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" /> {section.title}
          </h3>
          <p className="text-xs text-muted-foreground">{section.desc}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasGenerated && content && !isLoading && (
            <>
              <button onClick={() => handleCopy(false)} className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Copy">
                <Copy className="h-3.5 w-3.5" />
              </button>
              {section.key === 'leadership_update' && (
                <button onClick={() => handleCopy(true)} className="px-2 py-1 rounded text-xs bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                  Copy for Slack
                </button>
              )}
              <button onClick={() => handleGenerate(true)} className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Regenerate">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {!isLoading && (
            <button onClick={() => handleGenerate(hasGenerated)} className="px-3 py-1.5 rounded bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors">
              {hasGenerated && content ? 'Regenerate' : 'Generate'}
            </button>
          )}
        </div>
      </div>

      {/* Coaching prep context */}
      {section.key === 'coaching_prep' && !content && !isLoading && (
        lastLog ? (
          <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2 space-y-0.5">
            <p className="font-medium text-foreground/80">Last coaching: {lastLog.log_date} ({lastLog.interaction_type.replace(/_/g, ' ')})</p>
            <p>Mood: {moodEmoji[lastLog.physician_mood || 'neutral']} {lastLog.physician_mood} • Confidence: {lastLog.confidence_level}/5</p>
            {lastLog.commitments_made && <p>Commitments: {lastLog.commitments_made}</p>}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            No coaching history logged yet. Results will improve as you log physician interactions.
          </div>
        )
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center gap-3 py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <span className="text-sm text-muted-foreground">Analyzing transition data...</span>
        </div>
      )}

      {/* Streaming / completed content */}
      {content && (
        <div className="space-y-2">
          <div className="prose prose-sm prose-invert max-w-none text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {content.split(/\n(?=#{1,3}\s|(?:\d+\.\s+\*\*)|(?:\*\*\d+\.))/g).map((block, i) => {
              const headerMatch = block.match(/^(#{1,3})\s+(.+?)(?:\n|$)/);
              if (headerMatch) {
                const rest = block.slice(headerMatch[0].length);
                return (
                  <div key={i} className="mt-3 first:mt-0">
                    <h4 className="text-sm font-bold text-foreground mb-1">{headerMatch[2]}</h4>
                    <div>{formatMarkdown(rest)}</div>
                  </div>
                );
              }
              return <div key={i}>{formatMarkdown(block)}</div>;
            })}
          </div>
          {isLoading && <span className="inline-block w-1.5 h-4 bg-accent animate-pulse rounded-sm" />}
          {result && result.generated_at !== 'cached' && (
            <p className="text-[10px] text-muted-foreground/60 pt-1">
              Generated {new Date(result.generated_at).toLocaleString()} • {result.model}
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-sm text-status-critical bg-status-critical/10 rounded p-3">
          {error}
        </div>
      )}
    </div>
  );
}

/** Simple inline markdown: bold and bullet formatting */
function formatMarkdown(text: string): React.ReactNode {
  if (!text.trim()) return null;
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // Bold
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((seg, j) => {
      if (seg.startsWith('**') && seg.endsWith('**')) {
        return <strong key={j} className="text-foreground font-semibold">{seg.slice(2, -2)}</strong>;
      }
      return seg;
    });

    // Bullets
    const bulletMatch = line.match(/^(\s*)[-•]\s/);
    if (bulletMatch) {
      const indent = bulletMatch[1].length;
      return (
        <div key={i} className="flex gap-1.5" style={{ paddingLeft: `${indent * 8 + 4}px` }}>
          <span className="text-accent mt-0.5 shrink-0">•</span>
          <span>{parts}</span>
        </div>
      );
    }

    return <p key={i} className={line.trim() === '' ? 'h-2' : ''}>{parts}</p>;
  });
}

function AICoachingTab({ transition, updates, logs, latest }: AICoachingTabProps) {
  // Empty state: no weekly updates
  if (updates.length === 0) {
    return (
      <div className="metric-card text-center py-10">
        <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-semibold text-foreground mb-2">AI Coaching Needs Data</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Log your first weekly update to enable AI coaching. The AI needs current pacing data, team ratings, and observations to generate useful recommendations.
        </p>
        <Link to={`/transitions/${transition.id}/update`} className="inline-flex mt-4 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/80 transition-colors">
          Log Weekly Update
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {SECTIONS.map(section => (
        <AICoachingSection
          key={section.key}
          section={section}
          transition={transition}
          updates={updates}
          logs={logs}
          latest={latest}
        />
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

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

  // Weekly Intelligence
  const { intel, loading: intelLoading, refresh: refreshIntel } = useTransitionIntelligence(transition);
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);

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
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
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
        <AICoachingTab transition={transition} updates={updates} logs={logs} latest={latest} />
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
