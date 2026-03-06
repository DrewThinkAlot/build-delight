import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { StarRating } from '@/components/shared/StarRating';
import { upsertSnapshot } from '@/hooks/useWeeklySnapshots';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Transition } from '@/types/transition';

interface SnapshotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transition: Transition;
  onSaved: () => void;
}

function getWeekEndingDate(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

export function SnapshotModal({ open, onOpenChange, transition, onSaved }: SnapshotModalProps) {
  const [saving, setSaving] = useState(false);
  const [showDetailed, setShowDetailed] = useState(false);
  const [form, setForm] = useState({
    week_ending_date: getWeekEndingDate(),
    paid_members: transition.current_paid_members || 0,
    touches_mer_last_week: 0,
    touches_pa_last_week: '',
    doctor_calls_last_week: '',
    weekly_needed_to_hit_guidance: '',
    notes: '',
    strategic_activities: '',
    strategy_changed: false,
    // Detailed fields
    pa_effectiveness_rating: 0,
    physician_engagement_rating: 0,
    staff_engagement_rating: 0,
    physician_making_personal_calls: false,
    forums_scheduled: 0,
    forums_held: 0,
    forum_attendance: '',
    pa_swap_considered: false,
    pa_swap_executed: false,
    primary_obstacle: '',
    obstacle_category: '',
    what_worked_this_week: '',
    what_didnt_work: '',
    survey_prospects_left_pct: '',
    wtc_remaining: '',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await upsertSnapshot({
        transition_id: transition.id,
        week_ending_date: form.week_ending_date,
        paid_members: Number(form.paid_members),
        guidance_number: transition.guidance_number,
        touches_mer_last_week: Number(form.touches_mer_last_week) || 0,
        touches_pa_last_week: form.touches_pa_last_week ? Number(form.touches_pa_last_week) : null,
        doctor_calls_last_week: form.doctor_calls_last_week ? Number(form.doctor_calls_last_week) : null,
        weekly_needed_to_hit_guidance: form.weekly_needed_to_hit_guidance ? Number(form.weekly_needed_to_hit_guidance) : null,
        notes: form.notes || null,
        strategic_activities: form.strategic_activities || null,
        strategy_changed: form.strategy_changed,
        // Detailed fields
        pa_effectiveness_rating: form.pa_effectiveness_rating || null,
        physician_engagement_rating: form.physician_engagement_rating || null,
        staff_engagement_rating: form.staff_engagement_rating || null,
        physician_making_personal_calls: form.physician_making_personal_calls,
        forums_scheduled: form.forums_scheduled,
        forums_held: form.forums_held,
        forum_attendance: form.forum_attendance ? Number(form.forum_attendance) : null,
        pa_swap_considered: form.pa_swap_considered,
        pa_swap_executed: form.pa_swap_executed,
        primary_obstacle: form.primary_obstacle || null,
        obstacle_category: form.obstacle_category || null,
        what_worked_this_week: form.what_worked_this_week || null,
        what_didnt_work: form.what_didnt_work || null,
        survey_prospects_left_pct: form.survey_prospects_left_pct ? Number(form.survey_prospects_left_pct) : null,
        wtc_remaining: form.wtc_remaining ? Number(form.wtc_remaining) : null,
        pacing_status: null,
        week_number: null,
      });
      if (result.success) {
        toast.success('Snapshot saved');
        onSaved();
        onOpenChange(false);
      } else {
        toast.error(result.error || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save snapshot');
    } finally {
      setSaving(false);
    }
  };

  const update = (field: string, value: unknown) => setForm(f => ({ ...f, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Log Weekly Snapshot</DialogTitle>
          <p className="text-xs text-muted-foreground">{transition.physician_name}</p>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Quick mode fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Week Ending</Label>
              <Input type="date" value={form.week_ending_date} onChange={e => update('week_ending_date', e.target.value)} className="bg-muted/30 border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Paid Members</Label>
              <Input type="number" value={form.paid_members} onChange={e => update('paid_members', e.target.value)} className="bg-muted/30 border-border" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">MER Touches</Label>
              <Input type="number" value={form.touches_mer_last_week} onChange={e => update('touches_mer_last_week', e.target.value)} className="bg-muted/30 border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">PA Touches</Label>
              <Input type="number" value={form.touches_pa_last_week} onChange={e => update('touches_pa_last_week', e.target.value)} placeholder="—" className="bg-muted/30 border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Dr Calls</Label>
              <Input type="number" value={form.doctor_calls_last_week} onChange={e => update('doctor_calls_last_week', e.target.value)} placeholder="—" className="bg-muted/30 border-border" />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Weekly Needed to Hit Guidance</Label>
            <Input type="number" value={form.weekly_needed_to_hit_guidance} onChange={e => update('weekly_needed_to_hit_guidance', e.target.value)} placeholder="Auto-calculated if blank" className="bg-muted/30 border-border" />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Key observations this week…" className="bg-muted/30 border-border h-16" />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Strategic Activities</Label>
            <Textarea value={form.strategic_activities} onChange={e => update('strategic_activities', e.target.value)} placeholder="Forums, events, outreach…" className="bg-muted/30 border-border h-16" />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm text-foreground">Strategy Changed This Week?</Label>
            <Switch checked={form.strategy_changed} onCheckedChange={v => update('strategy_changed', v)} />
          </div>

          {/* Detailed mode toggle */}
          <button
            type="button"
            onClick={() => setShowDetailed(!showDetailed)}
            className="flex items-center gap-2 text-xs font-medium text-accent hover:text-accent/80 transition-colors w-full"
          >
            {showDetailed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Detailed Assessment (ratings, obstacles, forums)
          </button>

          {showDetailed && (
            <div className="space-y-4 border-t border-border pt-4">
              {/* Ratings */}
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Team Ratings</p>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">PA Effectiveness</Label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(v => (
                      <button key={v} type="button" onClick={() => update('pa_effectiveness_rating', form.pa_effectiveness_rating === v ? 0 : v)}
                        className={cn('w-7 h-7 rounded text-xs font-medium transition-colors',
                          form.pa_effectiveness_rating >= v ? 'bg-accent text-accent-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                        )}>{v}</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Physician Engagement</Label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(v => (
                      <button key={v} type="button" onClick={() => update('physician_engagement_rating', form.physician_engagement_rating === v ? 0 : v)}
                        className={cn('w-7 h-7 rounded text-xs font-medium transition-colors',
                          form.physician_engagement_rating >= v ? 'bg-accent text-accent-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                        )}>{v}</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Staff Engagement</Label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(v => (
                      <button key={v} type="button" onClick={() => update('staff_engagement_rating', form.staff_engagement_rating === v ? 0 : v)}
                        className={cn('w-7 h-7 rounded text-xs font-medium transition-colors',
                          form.staff_engagement_rating >= v ? 'bg-accent text-accent-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                        )}>{v}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Forums & Calls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Forums Scheduled</Label>
                  <Input type="number" value={form.forums_scheduled} onChange={e => update('forums_scheduled', e.target.value)} className="bg-muted/30 border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Forums Held</Label>
                  <Input type="number" value={form.forums_held} onChange={e => update('forums_held', e.target.value)} className="bg-muted/30 border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Forum Attendance</Label>
                  <Input type="number" value={form.forum_attendance} onChange={e => update('forum_attendance', e.target.value)} placeholder="—" className="bg-muted/30 border-border" />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm text-foreground">Physician Making Personal Calls?</Label>
                <Switch checked={form.physician_making_personal_calls} onCheckedChange={v => update('physician_making_personal_calls', v)} />
              </div>

              {/* Pipeline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Survey Prospects Left %</Label>
                  <Input type="number" value={form.survey_prospects_left_pct} onChange={e => update('survey_prospects_left_pct', e.target.value)} placeholder="—" className="bg-muted/30 border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">WTC 55+ Remaining</Label>
                  <Input type="number" value={form.wtc_remaining} onChange={e => update('wtc_remaining', e.target.value)} placeholder="—" className="bg-muted/30 border-border" />
                </div>
              </div>

              {/* PA Swap */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={form.pa_swap_considered} onCheckedChange={v => update('pa_swap_considered', v)} />
                  <Label className="text-xs text-muted-foreground">PA Swap Considered</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.pa_swap_executed} onCheckedChange={v => update('pa_swap_executed', v)} />
                  <Label className="text-xs text-muted-foreground">PA Swap Executed</Label>
                </div>
              </div>

              {/* Obstacles */}
              <div>
                <Label className="text-xs text-muted-foreground">Primary Obstacle</Label>
                <Input value={form.primary_obstacle} onChange={e => update('primary_obstacle', e.target.value)} placeholder="What's the main blocker?" className="bg-muted/30 border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Obstacle Category</Label>
                <Input value={form.obstacle_category} onChange={e => update('obstacle_category', e.target.value)} placeholder="e.g. physician engagement, PA performance…" className="bg-muted/30 border-border" />
              </div>

              {/* Learnings */}
              <div>
                <Label className="text-xs text-muted-foreground">What Worked This Week</Label>
                <Textarea value={form.what_worked_this_week} onChange={e => update('what_worked_this_week', e.target.value)} placeholder="Wins and effective tactics…" className="bg-muted/30 border-border h-16" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">What Didn't Work</Label>
                <Textarea value={form.what_didnt_work} onChange={e => update('what_didnt_work', e.target.value)} placeholder="Tactics that fell flat…" className="bg-muted/30 border-border h-16" />
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-accent-foreground font-medium text-sm rounded hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Save Snapshot'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
