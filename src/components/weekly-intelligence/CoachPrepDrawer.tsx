import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toggleActionCompletion } from '@/hooks/useWeeklySnapshots';
import type { TransitionIntelligence } from '@/types/weeklyIntelligence';
import type { Transition } from '@/types/transition';

interface CoachPrepDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transition: Transition;
  intel: TransitionIntelligence;
  onRefresh: () => void;
}

export function CoachPrepDrawer({ open, onOpenChange, transition, intel, onRefresh }: CoachPrepDrawerProps) {
  const { recommendations, signals, snapshots, completions } = intel;
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

  const redSignals = signals.filter(s => s.severity === 'red');
  const yellowSignals = signals.filter(s => s.severity === 'yellow');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border w-[400px] sm:w-[440px]">
        <SheetHeader>
          <SheetTitle className="text-foreground">{transition.physician_name}</SheetTitle>
          <p className="text-xs text-muted-foreground">Coach Prep • Key actions & blockers</p>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          {/* Key blockers from notes */}
          {latestSnapshot?.notes && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Latest Notes</h4>
              <p className="text-sm text-foreground bg-muted/30 rounded p-2">{latestSnapshot.notes}</p>
            </div>
          )}

          {/* Critical signals */}
          {redSignals.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-status-critical uppercase tracking-wider mb-2">Critical Signals</h4>
              {redSignals.map(s => (
                <div key={s.key} className="flex items-start gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full mt-1.5 bg-status-critical shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {yellowSignals.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-status-behind uppercase tracking-wider mb-2">Watch</h4>
              {yellowSignals.map(s => (
                <div key={s.key} className="flex items-start gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full mt-1.5 bg-status-behind shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations with checkboxes */}
          {recommendations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recommended Actions</h4>
              <div className="space-y-3">
                {recommendations.map(r => {
                  const done = completedKeys.has(r.key);
                  return (
                    <div key={r.key} className={cn('flex items-start gap-3', done && 'opacity-50')}>
                      <button
                        onClick={() => handleToggle(r.key)}
                        className={cn(
                          'mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors',
                          done ? 'bg-status-ahead border-status-ahead' : 'border-border hover:border-accent'
                        )}
                      >
                        {done && <CheckCircle2 className="h-3 w-3 text-background" />}
                      </button>
                      <div>
                        <p className={cn('text-sm font-medium text-foreground', done && 'line-through')}>{r.title}</p>
                        <p className="text-xs text-muted-foreground">{r.how}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {recommendations.length === 0 && signals.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No signals or recommendations yet. Log a weekly snapshot first.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
