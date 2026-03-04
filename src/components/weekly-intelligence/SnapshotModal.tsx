import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { upsertSnapshot } from '@/hooks/useWeeklySnapshots';
import { toast } from 'sonner';
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
  // Next Sunday (or today if Sunday)
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

export function SnapshotModal({ open, onOpenChange, transition, onSaved }: SnapshotModalProps) {
  const [saving, setSaving] = useState(false);
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
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Log Weekly Snapshot</DialogTitle>
          <p className="text-xs text-muted-foreground">{transition.physician_name}</p>
        </DialogHeader>
        <div className="space-y-4 mt-2">
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
