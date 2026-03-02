import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTransitions } from '@/contexts/TransitionContext';
import { calculateRiskScore } from '@/data/sampleData';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';
import { Transition } from '@/types/transition';

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

function totalWeeks(start: string, end: string) {
  return Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (7 * 86400000));
}

export default function NewTransition() {
  const navigate = useNavigate();
  const { addTransition } = useTransitions();
  const [showRisk, setShowRisk] = useState(false);
  const [riskResult, setRiskResult] = useState<{ score: number; tier: string; factors: { label: string; points: number }[] } | null>(null);

  const [form, setForm] = useState({
    physician_name: '', physician_id: '', specialty: '', city: '', state: '',
    coc_type: 'COC In', segmentation: '',
    transition_start: '', opening_date: '',
    guidance_number: '', be_best_practice: '', msrp_at_open: '',
    pre_survey_patients: '', pre_survey_over_55: '', post_survey_patients: '', wtc_55_plus: '',
    medicaid_pct: '', medicare_dual_pct: '',
    physician_engagement_level: 'High',
    physician_full_time: true,
    physician_has_strong_patient_relationships: true,
    physician_comfortable_discussing_fees: true,
    partner_group_aligned: true,
    assigned_pa: '', assigned_ptm: '',
  });

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tw = form.transition_start && form.opening_date ? totalWeeks(form.transition_start, form.opening_date) : 0;
    const partial: Partial<Transition> = {
      ...form,
      guidance_number: Number(form.guidance_number) || 0,
      be_best_practice: Number(form.be_best_practice) || undefined,
      msrp_at_open: Number(form.msrp_at_open) || undefined,
      pre_survey_patients: Number(form.pre_survey_patients) || undefined,
      pre_survey_over_55: Number(form.pre_survey_over_55) || undefined,
      post_survey_patients: Number(form.post_survey_patients) || undefined,
      wtc_55_plus: Number(form.wtc_55_plus) || undefined,
      medicaid_pct: form.medicaid_pct ? Number(form.medicaid_pct) / 100 : undefined,
      medicare_dual_pct: form.medicare_dual_pct ? Number(form.medicare_dual_pct) / 100 : undefined,
      total_weeks: tw,
    };

    const risk = calculateRiskScore(partial);
    const t: Transition = {
      id: `t-${Date.now()}`,
      physician_name: form.physician_name,
      physician_id: form.physician_id,
      transition_start: form.transition_start,
      opening_date: form.opening_date,
      guidance_number: Number(form.guidance_number) || 0,
      be_best_practice: Number(form.be_best_practice) || undefined,
      msrp_at_open: Number(form.msrp_at_open) || undefined,
      pre_survey_patients: Number(form.pre_survey_patients) || undefined,
      pre_survey_over_55: Number(form.pre_survey_over_55) || undefined,
      post_survey_patients: Number(form.post_survey_patients) || undefined,
      wtc_55_plus: Number(form.wtc_55_plus) || undefined,
      segmentation: form.segmentation,
      coc_type: form.coc_type,
      specialty: form.specialty,
      state: form.state,
      city: form.city,
      medicaid_pct: form.medicaid_pct ? Number(form.medicaid_pct) / 100 : undefined,
      medicare_dual_pct: form.medicare_dual_pct ? Number(form.medicare_dual_pct) / 100 : undefined,
      physician_engagement_level: form.physician_engagement_level,
      physician_full_time: form.physician_full_time,
      physician_has_strong_patient_relationships: form.physician_has_strong_patient_relationships,
      physician_comfortable_discussing_fees: form.physician_comfortable_discussing_fees,
      partner_group_aligned: form.partner_group_aligned,
      assigned_pa: form.assigned_pa,
      assigned_ptm: form.assigned_ptm,
      status: 'active',
      risk_score: risk.score,
      risk_tier: risk.tier as Transition['risk_tier'],
      total_weeks: tw,
      current_paid_members: 0,
    };

    addTransition(t);
    setRiskResult(risk);
    setShowRisk(true);
  };

  if (showRisk && riskResult) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-xl font-bold text-foreground">Risk Assessment</h1>
        <div className="metric-card text-center">
          <div className={cn('text-6xl font-bold font-mono',
            riskResult.tier === 'CRITICAL' ? 'text-status-critical' :
            riskResult.tier === 'HIGH' ? 'text-status-behind' :
            riskResult.tier === 'MODERATE' ? 'text-status-on-track' : 'text-status-ahead'
          )}>{riskResult.score}</div>
          <StatusBadge status={riskResult.tier} className="mt-2" />
        </div>
        {riskResult.factors.length > 0 && (
          <div className="metric-card">
            <h3 className="text-sm font-semibold text-foreground mb-3">Contributing Factors</h3>
            <div className="space-y-2">
              {riskResult.factors.map((f, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className="font-mono text-status-behind">+{f.points}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <button onClick={() => navigate('/')} className="w-full px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/80 transition-colors">
          Go to Dashboard
        </button>
      </div>
    );
  }

  const inputClass = "w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent";
  const labelClass = "block text-xs font-medium text-muted-foreground mb-1";

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-foreground mb-6">New Transition</h1>
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Basics */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-accent uppercase tracking-wider">Basics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelClass}>Physician Name *</label><input required className={inputClass} value={form.physician_name} onChange={e => set('physician_name', e.target.value)} /></div>
            <div><label className={labelClass}>Physician ID</label><input className={inputClass} value={form.physician_id} onChange={e => set('physician_id', e.target.value)} /></div>
            <div><label className={labelClass}>Specialty</label><input className={inputClass} value={form.specialty} onChange={e => set('specialty', e.target.value)} /></div>
            <div><label className={labelClass}>City</label><input className={inputClass} value={form.city} onChange={e => set('city', e.target.value)} /></div>
            <div><label className={labelClass}>State</label>
              <select className={inputClass} value={form.state} onChange={e => set('state', e.target.value)}>
                <option value="">Select</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>COC Type</label>
              <select className={inputClass} value={form.coc_type} onChange={e => set('coc_type', e.target.value)}>
                <option value="COC In">COC In</option><option value="COC Out">COC Out</option>
              </select>
            </div>
            <div className="sm:col-span-2"><label className={labelClass}>Segmentation</label><input className={inputClass} value={form.segmentation} onChange={e => set('segmentation', e.target.value)} placeholder="e.g. Family Medicine / COC In" /></div>
          </div>
        </section>

        {/* Section 2: Dates */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-accent uppercase tracking-wider">Dates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelClass}>Transition Start</label><input type="date" className={inputClass} value={form.transition_start} onChange={e => set('transition_start', e.target.value)} /></div>
            <div><label className={labelClass}>Opening Date</label><input type="date" className={inputClass} value={form.opening_date} onChange={e => set('opening_date', e.target.value)} /></div>
          </div>
          {form.transition_start && form.opening_date && (
            <p className="text-xs text-muted-foreground">Total weeks: <span className="font-mono text-foreground">{totalWeeks(form.transition_start, form.opening_date)}</span></p>
          )}
        </section>

        {/* Section 3: Numbers */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-accent uppercase tracking-wider">Numbers</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div><label className={labelClass}>Guidance # *</label><input required type="number" className={inputClass} value={form.guidance_number} onChange={e => set('guidance_number', e.target.value)} /></div>
            <div><label className={labelClass}>BE Best Practice</label><input type="number" className={inputClass} value={form.be_best_practice} onChange={e => set('be_best_practice', e.target.value)} /></div>
            <div><label className={labelClass}>MSRP</label><input type="number" className={inputClass} value={form.msrp_at_open} onChange={e => set('msrp_at_open', e.target.value)} placeholder="$" /></div>
            <div><label className={labelClass}>Pre-Survey Patients</label><input type="number" className={inputClass} value={form.pre_survey_patients} onChange={e => set('pre_survey_patients', e.target.value)} /></div>
            <div><label className={labelClass}>Pre-Survey 55+</label><input type="number" className={inputClass} value={form.pre_survey_over_55} onChange={e => set('pre_survey_over_55', e.target.value)} /></div>
            <div><label className={labelClass}>Post-Survey Patients</label><input type="number" className={inputClass} value={form.post_survey_patients} onChange={e => set('post_survey_patients', e.target.value)} /></div>
            <div><label className={labelClass}>WTC 55+</label><input type="number" className={inputClass} value={form.wtc_55_plus} onChange={e => set('wtc_55_plus', e.target.value)} /></div>
          </div>
        </section>

        {/* Section 4: Payer Mix */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-accent uppercase tracking-wider">Payer Mix</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Medicaid %</label><input type="number" className={inputClass} value={form.medicaid_pct} onChange={e => set('medicaid_pct', e.target.value)} min="0" max="100" /></div>
            <div><label className={labelClass}>Medicare Dual %</label><input type="number" className={inputClass} value={form.medicare_dual_pct} onChange={e => set('medicare_dual_pct', e.target.value)} min="0" max="100" /></div>
          </div>
        </section>

        {/* Section 5: Physician Assessment */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-accent uppercase tracking-wider">Physician Assessment</h2>
          <div>
            <label className={labelClass}>Engagement Level</label>
            <div className="flex gap-3 mt-1">
              {['High', 'Medium', 'Low'].map(l => (
                <label key={l} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="engagement" value={l} checked={form.physician_engagement_level === l} onChange={() => set('physician_engagement_level', l)} className="accent-accent" />
                  <span className="text-sm text-foreground">{l}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              ['physician_full_time', 'Full-Time'],
              ['physician_has_strong_patient_relationships', 'Strong Patient Relationships'],
              ['physician_comfortable_discussing_fees', 'Comfortable Discussing Fees'],
              ['partner_group_aligned', 'Partner Group Aligned'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <button type="button" onClick={() => set(key, !(form as any)[key])}
                  className={cn('w-10 h-5 rounded-full transition-colors relative',
                    (form as any)[key] ? 'bg-accent' : 'bg-muted'
                  )}>
                  <div className={cn('w-4 h-4 rounded-full bg-foreground absolute top-0.5 transition-transform',
                    (form as any)[key] ? 'translate-x-5' : 'translate-x-0.5'
                  )} />
                </button>
                <span className="text-sm text-foreground">{label}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Section 6: Team */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-accent uppercase tracking-wider">Team</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Assigned PA</label><input className={inputClass} value={form.assigned_pa} onChange={e => set('assigned_pa', e.target.value)} /></div>
            <div><label className={labelClass}>Assigned PTM</label><input className={inputClass} value={form.assigned_ptm} onChange={e => set('assigned_ptm', e.target.value)} /></div>
          </div>
        </section>

        <button type="submit" className="w-full px-4 py-3 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/80 transition-colors">
          Save & Calculate Risk
        </button>
      </form>
    </div>
  );
}
