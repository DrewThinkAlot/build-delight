import { Link } from 'react-router-dom';
import { useTransitions } from '@/contexts/TransitionContext';
import { MetricCard } from '@/components/shared/MetricCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { StarRating } from '@/components/shared/StarRating';
import { Users, AlertTriangle, CheckCircle2, TrendingUp, FileText, ChevronDown, ChevronRight, BarChart3 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAllTransitionsIntelligence } from '@/hooks/useWeeklySnapshots';
import { worstSeverity } from '@/lib/weeklySignals';
import { SnapshotModal } from '@/components/weekly-intelligence/SnapshotModal';
import { CoachPrepDrawer } from '@/components/weekly-intelligence/CoachPrepDrawer';
import type { Transition } from '@/types/transition';

export default function Dashboard() {
  const { transitions, getLatestUpdate, getAlertsForTransition, weeklyUpdates, coachingLogs } = useTransitions();
  const [showOnTrack, setShowOnTrack] = useState(false);
  const [recalBanner, setRecalBanner] = useState<{ show: boolean; count: number }>({ show: false, count: 0 });

  // Snapshot modal state
  const [snapshotTarget, setSnapshotTarget] = useState<Transition | null>(null);
  // Coach prep drawer state
  const [coachPrepTarget, setCoachPrepTarget] = useState<Transition | null>(null);

  const active = transitions.filter(t => t.status === 'active');
  const completed = transitions.filter(t => t.status === 'completed');

  // Weekly intelligence for all active transitions
  const { intelMap, refresh: refreshIntel } = useAllTransitionsIntelligence(active);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: activeCalib }, { count: totalCount }] = await Promise.all([
          supabase.from('risk_weights').select('calibration_date, n_transitions').eq('is_active', true).order('calibration_date', { ascending: false }).limit(1).single(),
          supabase.from('historical_transitions').select('id', { count: 'exact', head: true }),
        ]);
        if (activeCalib && totalCount != null) {
          const newSince = totalCount - activeCalib.n_transitions;
          if (newSince >= 15) setRecalBanner({ show: true, count: newSince });
        }
      } catch { /* silent */ }
    })();
  }, []);

  // Determine needs-attention using weekly signals when available, fallback to existing logic
  const needsAttention = active.filter(t => {
    const intel = intelMap[t.id];
    if (intel && intel.signals.length > 0) {
      const sev = worstSeverity(intel.signals);
      return sev === 'red' || sev === 'yellow';
    }
    // Fallback to existing logic
    const latest = getLatestUpdate(t.id);
    return latest?.pacing_status === 'BEHIND' || latest?.pacing_status === 'CRITICAL' ||
      t.risk_tier === 'HIGH' || t.risk_tier === 'CRITICAL';
  }).sort((a, b) => {
    const aIntel = intelMap[a.id];
    const bIntel = intelMap[b.id];
    const aSev = aIntel ? (worstSeverity(aIntel.signals) === 'red' ? 2 : 1) : 0;
    const bSev = bIntel ? (worstSeverity(bIntel.signals) === 'red' ? 2 : 1) : 0;
    if (bSev !== aSev) return bSev - aSev;
    return (b.risk_score || 0) - (a.risk_score || 0);
  });

  const onTrack = active.filter(t => !needsAttention.includes(t));

  // Action items: from recommendations for red/yellow transitions + legacy overdue checks
  const actionItems: { label: string; severity: string; transitionId: string; physicianName: string; actionKey?: string }[] = [];

  active.forEach(t => {
    const intel = intelMap[t.id];

    // From weekly intelligence recommendations
    if (intel && intel.recommendations.length > 0) {
      const completedKeys = new Set(intel.completions.map(c => c.action_key));
      intel.recommendations
        .filter(r => !completedKeys.has(r.key))
        .slice(0, 2)
        .forEach(r => {
          const sev = worstSeverity(intel.signals);
          actionItems.push({
            label: r.title,
            severity: sev === 'red' ? 'CRITICAL' : sev === 'yellow' ? 'HIGH' : 'MODERATE',
            transitionId: t.id,
            physicianName: t.physician_name,
            actionKey: r.key,
          });
        });
    }

    // Snapshot overdue check
    if (intel && intel.snapshots.length > 0) {
      const lastSnap = intel.snapshots[intel.snapshots.length - 1];
      const daysSince = (Date.now() - new Date(lastSnap.week_ending_date).getTime()) / 86400000;
      if (daysSince > 7) {
        actionItems.push({
          label: `Weekly snapshot overdue (${Math.floor(daysSince)} days)`,
          severity: 'MODERATE',
          transitionId: t.id,
          physicianName: t.physician_name,
        });
      }
    } else {
      // Legacy: check weekly updates overdue
      const updates = weeklyUpdates.filter(u => u.transition_id === t.id);
      const latestUpdate = updates.length ? updates.reduce((a, b) => a.week_number > b.week_number ? a : b) : null;
      if (latestUpdate) {
        const daysSince = (Date.now() - new Date(latestUpdate.update_date).getTime()) / 86400000;
        if (daysSince > 7) actionItems.push({ label: `Weekly update overdue (${Math.floor(daysSince)} days)`, severity: 'MODERATE', transitionId: t.id, physicianName: t.physician_name });
      } else {
        actionItems.push({ label: 'No weekly updates yet', severity: 'MODERATE', transitionId: t.id, physicianName: t.physician_name });
      }
    }

    // Legacy coaching check
    const logs = coachingLogs.filter(l => l.transition_id === t.id);
    const latestLog = logs.length ? logs.reduce((a, b) => new Date(a.log_date) > new Date(b.log_date) ? a : b) : null;
    if (latestLog) {
      const daysSince = (Date.now() - new Date(latestLog.log_date).getTime()) / 86400000;
      if (daysSince > 10) actionItems.push({ label: `No coaching interaction (${Math.floor(daysSince)} days)`, severity: 'MODERATE', transitionId: t.id, physicianName: t.physician_name });
    }

    // Legacy alerts
    const alerts = getAlertsForTransition(t.id);
    alerts.forEach(a => actionItems.push({ label: a.message, severity: a.severity, transitionId: t.id, physicianName: t.physician_name }));
  });

  return (
    <div className="space-y-6">
      {recalBanner.show && (
        <Link to="/calibration" className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-accent/10 border border-accent/20 text-sm text-accent hover:bg-accent/15 transition-colors">
          <BarChart3 className="h-4 w-4 shrink-0" />
          <span>📊 {recalBanner.count} new transitions since last calibration. Consider recalibrating your risk model.</span>
        </Link>
      )}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Portfolio Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Active transition overview</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Active" value={active.length} icon={Users} accentColor="text-accent" />
        <MetricCard label="On Track" value={onTrack.length} icon={TrendingUp} accentColor="text-status-ahead" />
        <MetricCard label="Behind" value={needsAttention.filter(t => {
          const intel = intelMap[t.id];
          if (intel) return worstSeverity(intel.signals) === 'yellow';
          const u = getLatestUpdate(t.id);
          return u?.pacing_status === 'BEHIND';
        }).length} icon={AlertTriangle} accentColor="text-status-behind" />
        <MetricCard label="Critical" value={needsAttention.filter(t => {
          const intel = intelMap[t.id];
          if (intel) return worstSeverity(intel.signals) === 'red';
          const u = getLatestUpdate(t.id);
          return u?.pacing_status === 'CRITICAL' || t.risk_tier === 'CRITICAL';
        }).length} icon={AlertTriangle} accentColor="text-status-critical" />
      </div>

      {/* Needs Attention */}
      {needsAttention.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-status-critical uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Needs Your Attention
          </h2>
          <div className="grid gap-3">
            {needsAttention.map(t => {
              const latest = getLatestUpdate(t.id);
              const intel = intelMap[t.id];
              const weeksLeft = t.opening_date ? Math.max(0, Math.ceil((new Date(t.opening_date).getTime() - Date.now()) / (7 * 86400000))) : 0;
              const topSignals = intel?.signals.filter(s => s.severity !== 'green').slice(0, 2) ?? [];

              return (
                <Link key={t.id} to={`/transitions/${t.id}`} className="metric-card hover:border-accent/40 transition-colors group">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{t.physician_name}</span>
                        <StatusBadge status={latest?.pacing_status || t.risk_tier || 'MODERATE'} />
                        <span className="text-xs text-muted-foreground">
                          {weeksLeft} weeks left
                        </span>
                      </div>
                      <div className="mt-2">
                        <ProgressBar value={intel?.metrics?.pace_to_guidance ? Math.round(intel.metrics.pace_to_guidance * t.guidance_number) : (t.current_paid_members || 0)} max={t.guidance_number} />
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                          <span className="font-mono">{intel?.snapshots?.length ? intel.snapshots[intel.snapshots.length - 1].paid_members : (t.current_paid_members || 0)} / {t.guidance_number}</span>
                          {intel?.metrics && <span>Projected: {intel.metrics.projected_paid_at_opening}</span>}
                          {!intel?.metrics && latest?.members_per_week_needed && <span>Need {latest.members_per_week_needed}/wk</span>}
                        </div>
                      </div>
                      {/* Signal titles */}
                      {topSignals.length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {topSignals.map(s => (
                            <span key={s.key} className={cn('text-[10px] px-1.5 py-0.5 rounded', s.severity === 'red' ? 'bg-status-critical/15 text-status-critical' : 'bg-status-behind/15 text-status-behind')}>
                              {s.title}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {t.risk_score !== undefined && (
                        <div className="text-center">
                          <div className={cn('text-lg font-bold font-mono',
                            t.risk_tier === 'CRITICAL' ? 'text-status-critical' :
                            t.risk_tier === 'HIGH' ? 'text-status-behind' :
                            t.risk_tier === 'MODERATE' ? 'text-status-on-track' : 'text-status-ahead'
                          )}>{t.risk_score}</div>
                          <div className="text-muted-foreground">Risk</div>
                        </div>
                      )}
                      {latest && (
                        <div className="hidden sm:flex items-center gap-2">
                          <div className="text-center">
                            <StarRating value={latest.pa_effectiveness_rating || 0} />
                            <div className="text-muted-foreground mt-0.5">PA</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); setSnapshotTarget(t); }}
                      className="text-xs px-2.5 py-1 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium"
                    >
                      Log Update
                    </button>
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); setCoachPrepTarget(t); }}
                      className="text-xs px-2.5 py-1 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium"
                    >
                      Coach Prep
                    </button>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Action Items */}
      {actionItems.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" /> Action Items This Week
          </h2>
          <div className="metric-card space-y-2">
            {actionItems.slice(0, 10).map((item, i) => (
              <Link key={i} to={`/transitions/${item.transitionId}`} className="flex items-start gap-2 py-1.5 hover:bg-muted/50 rounded px-2 -mx-2 transition-colors">
                <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0',
                  item.severity === 'CRITICAL' ? 'bg-status-critical' :
                  item.severity === 'HIGH' ? 'bg-status-behind' : 'bg-status-on-track'
                )} />
                <div>
                  <span className="text-sm text-foreground">{item.physicianName}</span>
                  <span className="text-sm text-muted-foreground ml-2">{item.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* On Track */}
      {onTrack.length > 0 && (
        <section>
          <button onClick={() => setShowOnTrack(!showOnTrack)} className="flex items-center gap-2 text-sm font-semibold text-status-ahead uppercase tracking-wider mb-3">
            {showOnTrack ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <TrendingUp className="h-4 w-4" /> On Track ({onTrack.length})
          </button>
          {showOnTrack && (
            <div className="grid gap-3">
              {onTrack.map(t => {
                const latest = getLatestUpdate(t.id);
                return (
                  <Link key={t.id} to={`/transitions/${t.id}`} className="metric-card hover:border-accent/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{t.physician_name}</span>
                          <StatusBadge status={latest?.pacing_status || 'ON_TRACK'} />
                        </div>
                        <ProgressBar value={t.current_paid_members || 0} max={t.guidance_number} className="mt-2" />
                        <span className="text-xs text-muted-foreground font-mono mt-1 block">
                          {t.current_paid_members || 0} / {t.guidance_number}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Completed This FY
          </h2>
          <div className="grid gap-2">
            {completed.map(t => (
              <Link key={t.id} to={`/transitions/${t.id}`} className="metric-card hover:border-accent/40 transition-colors flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-status-ahead shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-foreground">{t.physician_name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{t.specialty} • {t.city}, {t.state}</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold font-mono text-status-ahead">
                    {t.current_paid_members && t.guidance_number ? Math.round((t.current_paid_members / t.guidance_number) * 100) : 0}%
                  </div>
                  <div className="text-xs text-muted-foreground">{t.current_paid_members} / {t.guidance_number}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Snapshot Modal */}
      {snapshotTarget && (
        <SnapshotModal
          open={!!snapshotTarget}
          onOpenChange={open => { if (!open) setSnapshotTarget(null); }}
          transition={snapshotTarget}
          onSaved={refreshIntel}
        />
      )}

      {/* Coach Prep Drawer */}
      {coachPrepTarget && intelMap[coachPrepTarget.id] && (
        <CoachPrepDrawer
          open={!!coachPrepTarget}
          onOpenChange={open => { if (!open) setCoachPrepTarget(null); }}
          transition={coachPrepTarget}
          intel={intelMap[coachPrepTarget.id]}
          onRefresh={refreshIntel}
        />
      )}
    </div>
  );
}
