import { useState } from 'react';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { toggleActionCompletion } from '@/hooks/useWeeklySnapshots';
import type { TransitionIntelligence, WeeklySnapshot } from '@/types/weeklyIntelligence';
import type { Transition } from '@/types/transition';

interface WeeklyIntelligencePanelProps {
  transition: Transition;
  intel: TransitionIntelligence;
  onRefresh: () => void;
  onOpenSnapshot: () => void;
}

const severityDot: Record<string, string> = {
  green: 'bg-status-ahead',
  yellow: 'bg-status-behind',
  red: 'bg-status-critical',
};

const severityBadge: Record<string, string> = {
  green: 'status-ahead',
  yellow: 'status-behind',
  red: 'status-critical',
};

export function WeeklyIntelligencePanel({ transition, intel, onRefresh, onOpenSnapshot }: WeeklyIntelligencePanelProps) {
  const { metrics, signals, recommendations, snapshots, completions } = intel;
  const [showTable, setShowTable] = useState(false);

  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const latestWeekEnding = latestSnapshot?.week_ending_date ?? '';
  const completedKeys = new Set(
    completions.filter(c => c.week_ending_date === latestWeekEnding).map(c => c.action_key)
  );

  const handleToggle = async (key: string) => {
    const isCompleted = completedKeys.has(key);
    const ok = await toggleActionCompletion(transition.id, latestWeekEnding, key, !isCompleted);
    if (ok) onRefresh();
  };

  if (!metrics) {
    return (
      <div className="metric-card text-center py-6">
        <AlertTriangle className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No weekly snapshots yet.</p>
        <button onClick={onOpenSnapshot} className="mt-3 px-4 py-2 rounded bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/80 transition-colors">
          Log First Snapshot
        </button>
      </div>
    );
  }

  const projectedBadge = metrics.projected_pace_at_opening >= 0.8 ? 'Ahead' : 'Behind';
  const projectedColor = metrics.projected_pace_at_opening >= 0.8 ? 'text-status-ahead' : 'text-status-critical';

  return (
    <div className="space-y-4">
      {/* A) WEEKLY INTELLIGENCE CARD */}
      <div className="metric-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Weekly Intelligence</h3>
          <button onClick={onOpenSnapshot} className="text-xs px-2.5 py-1 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium">
            Log Update
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Pace to Guidance */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Pace to Guidance</p>
            <div className="text-2xl font-bold font-mono text-foreground">
              {Math.round(metrics.pace_to_guidance * 100)}%
            </div>
            <ProgressBar value={latestSnapshot?.paid_members ?? 0} max={transition.guidance_number} className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {latestSnapshot?.paid_members ?? 0} / {transition.guidance_number}
            </p>
          </div>

          {/* Projected Pace at Opening */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Projected at Opening</p>
            <div className="flex items-center gap-2">
              <span className={cn('text-2xl font-bold font-mono', projectedColor)}>
                {Math.round(metrics.projected_pace_at_opening * 100)}%
              </span>
              <span className={cn('status-badge text-[10px]', projectedBadge === 'Ahead' ? 'status-ahead' : 'status-critical')}>
                {projectedBadge}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ~{metrics.projected_paid_at_opening} members
            </p>
          </div>

          {/* Trend */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Trend</p>
            <div className="flex items-center gap-2">
              {metrics.wow_change >= 0 ? (
                <TrendingUp className="h-5 w-5 text-status-ahead" />
              ) : (
                <TrendingDown className="h-5 w-5 text-status-critical" />
              )}
              <span className={cn('text-lg font-bold font-mono', metrics.wow_change >= 0 ? 'text-status-ahead' : 'text-status-critical')}>
                {metrics.wow_change >= 0 ? '+' : ''}{metrics.wow_change}
              </span>
              <span className="text-xs text-muted-foreground">WoW</span>
            </div>
            <p className={cn('text-xs mt-1', metrics.growth_slope_4wk >= 0 ? 'text-status-ahead' : 'text-status-critical')}>
              {metrics.rolling_3wk >= 0 ? '+' : ''}{metrics.rolling_3wk} (3wk) • slope: {metrics.growth_slope_4wk}
            </p>
          </div>
        </div>
      </div>

      {/* B) SIGNALS CARD */}
      {signals.length > 0 && (
        <div className="metric-card">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Signals</h3>
          <div className="space-y-2">
            {signals.map(s => (
              <div key={s.key} className="flex items-start gap-2">
                <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', severityDot[s.severity])} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{s.title}</span>
                    <span className={cn('status-badge text-[10px]', severityBadge[s.severity])}>
                      {s.severity}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* C) RECOMMENDED ACTIONS CARD */}
      {recommendations.length > 0 && (
        <div className="metric-card">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recommended Actions</h3>
          <div className="space-y-3">
            {recommendations.map(r => {
              const done = completedKeys.has(r.key);
              return (
                <div key={r.key} className={cn('flex items-start gap-3 py-1', done && 'opacity-50')}>
                  <button
                    onClick={() => handleToggle(r.key)}
                    className={cn(
                      'mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors',
                      done ? 'bg-status-ahead border-status-ahead' : 'border-border hover:border-accent'
                    )}
                  >
                    {done && <CheckCircle2 className="h-3 w-3 text-background" />}
                  </button>
                  <div className="min-w-0">
                    <p className={cn('text-sm font-medium text-foreground', done && 'line-through')}>{r.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="text-accent">Why:</span> {r.why}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-accent">How:</span> {r.how}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* D) WEEKLY SNAPSHOTS TABLE */}
      <div className="metric-card">
        <button onClick={() => setShowTable(!showTable)} className="flex items-center justify-between w-full text-left">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Weekly Snapshots ({snapshots.length})
          </h3>
          {showTable ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {showTable && (
          <div className="overflow-x-auto mt-3 -mx-4 px-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-3 text-muted-foreground font-medium whitespace-nowrap">Week Ending</th>
                  <th className="text-right py-2 pr-3 text-muted-foreground font-medium">Paid</th>
                  <th className="text-right py-2 pr-3 text-muted-foreground font-medium">Guidance</th>
                  <th className="text-right py-2 pr-3 text-muted-foreground font-medium">WoW</th>
                  <th className="text-right py-2 pr-3 text-muted-foreground font-medium">Needed/wk</th>
                  <th className="text-right py-2 pr-3 text-muted-foreground font-medium">MER</th>
                  <th className="text-left py-2 pr-3 text-muted-foreground font-medium hidden sm:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody>
                {[...snapshots].reverse().map((s, i, arr) => {
                  const prev = i < arr.length - 1 ? arr[i + 1] : null;
                  const wow = prev ? s.paid_members - prev.paid_members : null;
                  return (
                    <tr key={s.id} className="border-b border-border/50">
                      <td className="py-1.5 pr-3 text-foreground whitespace-nowrap">{s.week_ending_date}</td>
                      <td className="py-1.5 pr-3 text-right text-foreground font-mono">{s.paid_members}</td>
                      <td className="py-1.5 pr-3 text-right text-muted-foreground font-mono">{s.guidance_number}</td>
                      <td className={cn('py-1.5 pr-3 text-right font-mono', wow != null && wow >= 0 ? 'text-status-ahead' : 'text-status-critical')}>
                        {wow != null ? (wow >= 0 ? '+' : '') + wow : '—'}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-muted-foreground font-mono">{s.weekly_needed_to_hit_guidance ?? '—'}</td>
                      <td className="py-1.5 pr-3 text-right text-muted-foreground font-mono">{s.touches_mer_last_week}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground truncate max-w-[150px] hidden sm:table-cell">{s.notes ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
