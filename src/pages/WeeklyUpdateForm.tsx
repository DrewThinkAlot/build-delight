import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTransitions } from '@/contexts/TransitionContext';
import { StarRating } from '@/components/shared/StarRating';
import { getExpectedPct } from '@/data/sampleData';
import { WeeklyUpdate } from '@/types/transition';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { useCoachingAI } from '@/hooks/useCoachingAI';

export default function WeeklyUpdateForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getTransition, getUpdatesForTransition, getLogsForTransition, addWeeklyUpdate } = useTransitions();
  const { generateForTransition, isLoading: aiLoading, content: aiContent, error: aiError } = useCoachingAI();

  const transition = getTransition(id!);
  const updates = getUpdatesForTransition(id!);
  const logs = getLogsForTransition(id!);
  const lastUpdate = updates[0];
  const [saved, setSaved] = useState(false);
  const [savedUpdate, setSavedUpdate] = useState<WeeklyUpdate | null>(null);

  const [form, setForm] = useState({
    current_paid_members: '',
    survey_prospects_left_pct: 50,
    wtc_remaining: '',
    pa_effectiveness_rating: 3,
    physician_engagement_rating: 3,
    staff_engagement_rating: 3,
    physician_making_personal_calls: false,
    forums_scheduled: 0,
    forums_held: 0,
    forum_attendance: '',
    pa_swap_considered: false,
    pa_swap_executed: false,
    strategy_change_made: false,
    strategy_change_description: '',
    primary_obstacle: '',
    obstacle_category: '',
    what_worked_this_week: '',
    what_didnt_work: '',
    notes: '',
    leadership_update_sent: false,
    ptm_sync_completed: false,
    physician_coaching_call_completed: false,
  });

  if (!transition) return <div className="text-muted-foreground text-center py-12">Transition not found</div>;

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));
  const inputClass = "w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent";
  const labelClass = "block text-xs font-medium text-muted-foreground mb-1";
  const nextWeek = (lastUpdate?.week_number || 0) + 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const members = Number(form.current_paid_members);
    const totalW = transition.total_weeks || 20;
    const pctTrans = nextWeek / totalW;
    const expectedPct = getExpectedPct(pctTrans);
    const expectedMembers = Math.round(transition.guidance_number * expectedPct);
    const pacingRatio = expectedMembers > 0 ? members / expectedMembers : 1;
    const pacingStatus = pacingRatio >= 1.0 ? 'AHEAD' : pacingRatio >= 0.85 ? 'ON_TRACK' : pacingRatio >= 0.65 ? 'BEHIND' : 'CRITICAL';
    const weeksLeft = Math.max(1, totalW - nextWeek);

    const update: WeeklyUpdate = {
      id: `wu-${Date.now()}`,
      transition_id: id!,
      week_number: nextWeek,
      update_date: new Date().toISOString().slice(0, 10),
      current_paid_members: members,
      net_change_from_last_week: lastUpdate ? members - lastUpdate.current_paid_members : members,
      survey_prospects_left_pct: form.survey_prospects_left_pct / 100,
      wtc_remaining: Number(form.wtc_remaining) || undefined,
      expected_members_at_this_point: expectedMembers,
      pacing_status: pacingStatus as WeeklyUpdate['pacing_status'],
      pct_to_guidance: members / transition.guidance_number,
      projected_opening_number: Math.round(members / expectedPct),
      members_per_week_needed: Math.round((transition.guidance_number - members) / weeksLeft),
      pa_effectiveness_rating: form.pa_effectiveness_rating,
      physician_engagement_rating: form.physician_engagement_rating,
      staff_engagement_rating: form.staff_engagement_rating,
      physician_making_personal_calls: form.physician_making_personal_calls,
      forums_scheduled: form.forums_scheduled,
      forums_held: form.forums_held,
      forum_attendance: Number(form.forum_attendance) || undefined,
      pa_swap_considered: form.pa_swap_considered,
      pa_swap_executed: form.pa_swap_executed,
      strategy_change_made: form.strategy_change_made,
      strategy_change_description: form.strategy_change_description || undefined,
      notes: form.notes || undefined,
      primary_obstacle: form.primary_obstacle || undefined,
      obstacle_category: form.obstacle_category || undefined,
      what_worked_this_week: form.what_worked_this_week || undefined,
      what_didnt_work: form.what_didnt_work || undefined,
      leadership_update_sent: form.leadership_update_sent,
      ptm_sync_completed: form.ptm_sync_completed,
      physician_coaching_call_completed: form.physician_coaching_call_completed,
    };

    addWeeklyUpdate(update);
    setSavedUpdate(update);
    setSaved(true);
    toast.success('Weekly update saved');
  };

  const handleGenerateAI = async () => {
    if (!transition || !savedUpdate) return;
    const allUpdates = [savedUpdate, ...updates];
    await generateForTransition(transition, allUpdates, logs, 'weekly_analysis', true);
    navigate(`/transitions/${id}?tab=coaching`);
  };

  const handleSkip = () => {
    navigate(`/transitions/${id}`);
  };

  const Toggle = ({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) => (
    <label className="flex items-center gap-3 cursor-pointer">
      <button type="button" onClick={() => onChange(!value)}
        className={cn('w-10 h-5 rounded-full transition-colors relative', value ? 'bg-accent' : 'bg-muted')}>
        <div className={cn('w-4 h-4 rounded-full bg-foreground absolute top-0.5 transition-transform', value ? 'translate-x-5' : 'translate-x-0.5')} />
      </button>
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-foreground mb-1">Weekly Update — Week {nextWeek}</h1>
      <p className="text-sm text-muted-foreground mb-6">{transition.physician_name} • {transition.city}, {transition.state}</p>

      {lastUpdate && (
        <div className="metric-card mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Last Week (W{lastUpdate.week_number})</p>
          <p className="text-sm text-foreground font-mono">{lastUpdate.current_paid_members} members • {lastUpdate.pacing_status}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-accent uppercase tracking-wider">Numbers</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Current Paid Members *</label><input required type="number" className={inputClass} value={form.current_paid_members} onChange={e => set('current_paid_members', e.target.value)} /></div>
            <div><label className={labelClass}>WTC 55+ Remaining</label><input type="number" className={inputClass} value={form.wtc_remaining} onChange={e => set('wtc_remaining', e.target.value)} /></div>
          </div>
          <div>
            <label className={labelClass}>Survey Prospects Uncontacted: {form.survey_prospects_left_pct}%</label>
            <input type="range" min="0" max="100" className="w-full accent-accent" value={form.survey_prospects_left_pct} onChange={e => set('survey_prospects_left_pct', Number(e.target.value))} />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-accent uppercase tracking-wider">Team Ratings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><label className={labelClass}>PA Effectiveness</label><StarRating value={form.pa_effectiveness_rating} onChange={v => set('pa_effectiveness_rating', v)} size="md" /></div>
            <div><label className={labelClass}>Physician Engagement</label><StarRating value={form.physician_engagement_rating} onChange={v => set('physician_engagement_rating', v)} size="md" /></div>
            <div><label className={labelClass}>Staff Engagement</label><StarRating value={form.staff_engagement_rating} onChange={v => set('staff_engagement_rating', v)} size="md" /></div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-accent uppercase tracking-wider">Activities</h2>
          <Toggle value={form.physician_making_personal_calls} onChange={v => set('physician_making_personal_calls', v)} label="Physician making personal calls" />
          <div className="grid grid-cols-3 gap-4">
            <div><label className={labelClass}>Forums Scheduled</label><input type="number" className={inputClass} value={form.forums_scheduled} onChange={e => set('forums_scheduled', Number(e.target.value))} /></div>
            <div><label className={labelClass}>Forums Held</label><input type="number" className={inputClass} value={form.forums_held} onChange={e => set('forums_held', Number(e.target.value))} /></div>
            <div><label className={labelClass}>Attendance</label><input type="number" className={inputClass} value={form.forum_attendance} onChange={e => set('forum_attendance', e.target.value)} /></div>
          </div>
          <Toggle value={form.pa_swap_considered} onChange={v => set('pa_swap_considered', v)} label="PA swap considered" />
          <Toggle value={form.pa_swap_executed} onChange={v => set('pa_swap_executed', v)} label="PA swap executed" />
          <Toggle value={form.strategy_change_made} onChange={v => set('strategy_change_made', v)} label="Strategy change made" />
          {form.strategy_change_made && (
            <textarea className={inputClass} placeholder="Describe strategy change..." value={form.strategy_change_description} onChange={e => set('strategy_change_description', e.target.value)} />
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-accent uppercase tracking-wider">Observations</h2>
          <div><label className={labelClass}>Primary Obstacle</label><input className={inputClass} value={form.primary_obstacle} onChange={e => set('primary_obstacle', e.target.value)} /></div>
          <div><label className={labelClass}>Obstacle Category</label>
            <select className={inputClass} value={form.obstacle_category} onChange={e => set('obstacle_category', e.target.value)}>
              <option value="">Select</option>
              {['physician_engagement', 'pa_effectiveness', 'patient_affordability', 'data_quality', 'partner_conflict', 'coc_messaging', 'other'].map(c => (
                <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div><label className={labelClass}>What Worked</label><textarea className={inputClass} value={form.what_worked_this_week} onChange={e => set('what_worked_this_week', e.target.value)} /></div>
          <div><label className={labelClass}>What Didn't Work</label><textarea className={inputClass} value={form.what_didnt_work} onChange={e => set('what_didnt_work', e.target.value)} /></div>
          <div><label className={labelClass}>Notes</label><textarea className={inputClass} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-accent uppercase tracking-wider">Stakeholder Check-ins</h2>
          <Toggle value={form.leadership_update_sent} onChange={v => set('leadership_update_sent', v)} label="Leadership update sent" />
          <Toggle value={form.ptm_sync_completed} onChange={v => set('ptm_sync_completed', v)} label="PTM sync completed" />
          <Toggle value={form.physician_coaching_call_completed} onChange={v => set('physician_coaching_call_completed', v)} label="Physician coaching call completed" />
        </section>

        {!saved ? (
          <button type="submit" className="w-full px-4 py-3 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/80 transition-colors">
            Save Weekly Update
          </button>
        ) : (
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-5 space-y-4">
            <div className="flex items-center gap-2 text-accent">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">Weekly update saved</span>
            </div>
            <p className="text-sm text-muted-foreground">Generate AI situation analysis? The AI will analyze your update and provide priorities, coaching guidance, and escalation recommendations.</p>
            {aiLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                Analyzing transition data...
              </div>
            )}
            {aiError && <p className="text-sm text-status-critical">{aiError}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={handleGenerateAI} disabled={aiLoading}
                className="px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/80 transition-colors disabled:opacity-50 flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Generate Analysis
              </button>
              <button type="button" onClick={handleSkip}
                className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">
                Skip
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
