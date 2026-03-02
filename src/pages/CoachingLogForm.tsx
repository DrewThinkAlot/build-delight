import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTransitions } from '@/contexts/TransitionContext';
import { StarRating } from '@/components/shared/StarRating';
import { CoachingLog } from '@/types/transition';
import { cn } from '@/lib/utils';

const moods = ['enthusiastic', 'engaged', 'neutral', 'frustrated', 'disengaged', 'cold_feet'] as const;
const interactionTypes = [
  { value: 'phone_call', label: 'Phone Call' },
  { value: 'in_person_visit', label: 'In-Person Visit' },
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'zoom', label: 'Zoom' },
];

export default function CoachingLogForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getTransition, getLogsForTransition, addCoachingLog } = useTransitions();

  const transition = getTransition(id!);
  const logs = getLogsForTransition(id!);
  const previousLog = logs[0];

  const [previousFollowedThrough, setPreviousFollowedThrough] = useState<boolean | undefined>(undefined);

  const [form, setForm] = useState({
    log_date: new Date().toISOString().slice(0, 10),
    interaction_type: 'phone_call',
    duration_minutes: '',
    topics_covered: '',
    commitments_made: '',
    your_action_items: '',
    physician_mood: 'neutral',
    confidence_level: 3,
    follow_up_needed: false,
    follow_up_date: '',
    follow_up_notes: '',
  });

  if (!transition) return <div className="text-muted-foreground text-center py-12">Transition not found</div>;

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));
  const inputClass = "w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent";
  const labelClass = "block text-xs font-medium text-muted-foreground mb-1";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const log: CoachingLog = {
      id: `cl-${Date.now()}`,
      transition_id: id!,
      log_date: form.log_date,
      interaction_type: form.interaction_type,
      duration_minutes: Number(form.duration_minutes) || undefined,
      topics_covered: form.topics_covered || undefined,
      commitments_made: form.commitments_made || undefined,
      your_action_items: form.your_action_items || undefined,
      physician_mood: form.physician_mood,
      confidence_level: form.confidence_level,
      follow_up_needed: form.follow_up_needed,
      follow_up_date: form.follow_up_date || undefined,
      follow_up_notes: form.follow_up_notes || undefined,
    };
    addCoachingLog(log);
    navigate(`/transitions/${id}?tab=coaching`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-foreground mb-1">Log Coaching Interaction</h1>
      <p className="text-sm text-muted-foreground mb-6">{transition.physician_name}</p>

      {previousLog && (
        <div className="metric-card mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Previous Interaction — {previousLog.log_date}</p>
          <p className="text-sm text-foreground mb-2">{previousLog.topics_covered}</p>
          {previousLog.commitments_made && (
            <p className="text-sm text-muted-foreground mb-3"><span className="text-accent">Commitments:</span> {previousLog.commitments_made}</p>
          )}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Did they follow through?</span>
            <button type="button" onClick={() => setPreviousFollowedThrough(true)}
              className={cn('px-3 py-1 rounded text-xs font-medium transition-colors',
                previousFollowedThrough === true ? 'bg-status-ahead/20 text-status-ahead' : 'bg-muted text-muted-foreground')}>Yes</button>
            <button type="button" onClick={() => setPreviousFollowedThrough(false)}
              className={cn('px-3 py-1 rounded text-xs font-medium transition-colors',
                previousFollowedThrough === false ? 'bg-status-critical/20 text-status-critical' : 'bg-muted text-muted-foreground')}>No</button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelClass}>Date</label><input type="date" className={inputClass} value={form.log_date} onChange={e => set('log_date', e.target.value)} /></div>
          <div><label className={labelClass}>Duration (min)</label><input type="number" className={inputClass} value={form.duration_minutes} onChange={e => set('duration_minutes', e.target.value)} /></div>
        </div>

        <div>
          <label className={labelClass}>Interaction Type</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {interactionTypes.map(t => (
              <button key={t.value} type="button" onClick={() => set('interaction_type', t.value)}
                className={cn('px-3 py-1.5 rounded text-sm font-medium transition-colors',
                  form.interaction_type === t.value ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div><label className={labelClass}>Topics Covered</label><textarea className={inputClass} rows={3} value={form.topics_covered} onChange={e => set('topics_covered', e.target.value)} /></div>
        <div><label className={labelClass}>Commitments Made</label><textarea className={inputClass} rows={2} value={form.commitments_made} onChange={e => set('commitments_made', e.target.value)} /></div>
        <div><label className={labelClass}>Your Action Items</label><textarea className={inputClass} rows={2} value={form.your_action_items} onChange={e => set('your_action_items', e.target.value)} /></div>

        <div>
          <label className={labelClass}>Physician Mood</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {moods.map(m => (
              <button key={m} type="button" onClick={() => set('physician_mood', m)}
                className={cn('px-3 py-1.5 rounded text-sm font-medium transition-colors capitalize',
                  form.physician_mood === m ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
                {m.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>Confidence They'll Follow Through</label>
          <StarRating value={form.confidence_level} onChange={v => set('confidence_level', v)} size="md" />
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <button type="button" onClick={() => set('follow_up_needed', !form.follow_up_needed)}
              className={cn('w-10 h-5 rounded-full transition-colors relative', form.follow_up_needed ? 'bg-accent' : 'bg-muted')}>
              <div className={cn('w-4 h-4 rounded-full bg-foreground absolute top-0.5 transition-transform', form.follow_up_needed ? 'translate-x-5' : 'translate-x-0.5')} />
            </button>
            <span className="text-sm text-foreground">Follow-up needed</span>
          </label>
          {form.follow_up_needed && (
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelClass}>Follow-up Date</label><input type="date" className={inputClass} value={form.follow_up_date} onChange={e => set('follow_up_date', e.target.value)} /></div>
              <div><label className={labelClass}>Follow-up Notes</label><input className={inputClass} value={form.follow_up_notes} onChange={e => set('follow_up_notes', e.target.value)} /></div>
            </div>
          )}
        </div>

        <button type="submit" className="w-full px-4 py-3 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/80 transition-colors">
          Save Coaching Log
        </button>
      </form>
    </div>
  );
}
