import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAddTransition } from '@/hooks/useTransitionData';
import { getActiveWeights, calculateRiskScore, getSimilarTransitions, type ActiveWeightsResult, type RiskScoreResult, type BenchmarkComparison } from '@/lib/riskScorer';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { RiskScoreCard } from '@/components/shared/RiskScoreCard';
import { cn } from '@/lib/utils';
import { totalWeeks } from '@/lib/enrollmentCurve';
import { toast } from 'sonner';

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

export default function NewTransition() {
  const navigate = useNavigate();
  const addTransition = useAddTransition();
  const [showRisk, setShowRisk] = useState(false);
  const [finalResult, setFinalResult] = useState<RiskScoreResult | null>(null);
  const [calibration, setCalibration] = useState<ActiveWeightsResult | null>(null);

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

  useEffect(() => {
    getActiveWeights().then(setCalibration);
  }, []);

  const liveRisk: RiskScoreResult | null = useMemo(() => {
    if (!calibration) return null;
    const tw = totalWeeks(form.transition_start, form.opening_date);
    const input = {
      coc_type: form.coc_type,
      guidance_number: Number(form.guidance_number) || 0,
      msrp_at_open: form.msrp_at_open ? Number(form.msrp_at_open) : null,
      total_weeks: tw,
      state: form.state,
      physician_full_time: form.physician_full_time,
      physician_has_strong_patient_relationships: form.physician_has_strong_patient_relationships,
      physician_comfortable_discussing_fees: form.physician_comfortable_discussing_fees,
      physician_engagement_level: form.physician_engagement_level,
      partner_group_aligned: form.partner_group_aligned,
      medicaid_pct: form.medicaid_pct ? Number(form.medicaid_pct) / 100 : null,
      medicare_dual_pct: form.medicare_dual_pct ? Number(form.medicare_dual_pct) / 100 : null,
      pre_survey_patients: form.pre_survey_patients ? Number(form.pre_survey_patients) : null,
      pre_survey_over_55: form.pre_survey_over_55 ? Number(form.pre_survey_over_55) : null,
      specialty: form.specialty,
    };
    const result = calculateRiskScore(input, calibration.weights);
    result.calibration_date = calibration.calibrationDate;
    result.n_historical = calibration.nTransitions;
    return result;
  }, [form, calibration]);

  const comparisons: BenchmarkComparison[] = useMemo(() => {
    if (!calibration || !form.guidance_number) return [];
    return getSimilarTransitions({
      coc_type: form.coc_type,
      guidance_number: Number(form.guidance_number) || 0,
      msrp_at_open: null, total_weeks: null, state: form.state,
      physician_full_time: true, physician_has_strong_patient_relationships: true,
      physician_comfortable_discussing_fees: true, physician_engagement_level: 'High',
      partner_group_aligned: true, medicaid_pct: null, medicare_dual_pct: null,
      pre_survey_patients: null, pre_survey_over_55: null, specialty: form.specialty,
    }, calibration.benchmarks);
  }, [form.coc_type, form.guidance_number, form.state, form.specialty, calibration]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveRisk) return;

    const tw = totalWeeks(form.transition_start, form.opening_date) ?? 0;

    try {
      await addTransition.mutateAsync({
        physician_name: form.physician_name,
        physician_id: form.physician_id || undefined,
        transition_start: form.transition_start,
        opening_date: form.opening_date,
        guidance_number: Number(form.guidance_number) || 0,
        be_best_practice: Number(form.be_best_practice) || undefined,
        msrp_at_open: Number(form.msrp_at_open) || undefined,
        pre_survey_patients: Number(form.pre_survey_patients) || undefined,
        pre_survey_over_55: Number(form.pre_survey_over_55) || undefined,
        post_survey_patients: Number(form.post_survey_patients) || undefined,
        wtc_55_plus: Number(form.wtc_55_plus) || undefined,
        segmentation: form.segmentation || undefined,
        coc_type: form.coc_type,
        specialty: form.specialty || undefined,
        state: form.state || undefined,
        city: form.city || undefined,
        medicaid_pct: form.medicaid_pct ? Number(form.medicaid_pct) / 100 : undefined,
        medicare_dual_pct: form.medicare_dual_pct ? Number(form.medicare_dual_pct) / 100 : undefined,
        physician_engagement_level: form.physician_engagement_level,
        physician_full_time: form.physician_full_time,
        physician_has_strong_patient_relationships: form.physician_has_strong_patient_relationships,
        physician_comfortable_discussing_fees: form.physician_comfortable_discussing_fees,
        partner_group_aligned: form.partner_group_aligned,
        assigned_pa: form.assigned_pa || undefined,
        assigned_ptm: form.assigned_ptm || undefined,
        status: 'active',
        risk_score: liveRisk.score,
        risk_tier: liveRisk.tier as any,
        total_weeks: tw,
        current_paid_members: 0,
      } as any);
      setFinalResult(liveRisk);
      setShowRisk(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save transition');
    }
  };

  if (showRisk && finalResult) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-xl font-bold text-foreground">Risk Assessment</h1>
        <div className="metric-card text-center">
          <div className={cn('text-6xl font-bold font-mono',
            finalResult.tier === 'CRITICAL' ? 'text-status-critical' :
            finalResult.tier === 'HIGH' ? 'text-status-behind' :
            finalResult.tier === 'MODERATE' ? 'text-status-on-track' : 'text-status-ahead'
          )}>{finalResult.score}</div>
          <StatusBadge status={finalResult.tier} className="mt-2" />
        </div>
        {finalResult.factors.length > 0 && (
          <div className="metric-card">
            <h3 className="text-sm font-semibold text-foreground mb-3">Contributing Factors</h3>
            <div className="space-y-2">
              {finalResult.factors.map((f, i) => (
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basics */}
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

          {/* Dates */}
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

          {/* Numbers */}
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

          {/* Payer Mix */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-accent uppercase tracking-wider">Payer Mix</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelClass}>Medicaid %</label><input type="number" className={inputClass} value={form.medicaid_pct} onChange={e => set('medicaid_pct', e.target.value)} min="0" max="100" /></div>
              <div><label className={labelClass}>Medicare Dual %</label><input type="number" className={inputClass} value={form.medicare_dual_pct} onChange={e => set('medicare_dual_pct', e.target.value)} min="0" max="100" /></div>
            </div>
          </section>

          {/* Physician Assessment */}
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
              {([
                ['physician_full_time', 'Full-Time'],
                ['physician_has_strong_patient_relationships', 'Strong Patient Relationships'],
                ['physician_comfortable_discussing_fees', 'Comfortable Discussing Fees'],
                ['partner_group_aligned', 'Partner Group Aligned'],
              ] as const).map(([key, label]) => (
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

          {/* Team */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-accent uppercase tracking-wider">Team</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelClass}>Assigned PA</label><input className={inputClass} value={form.assigned_pa} onChange={e => set('assigned_pa', e.target.value)} /></div>
              <div><label className={labelClass}>Assigned PTM</label><input className={inputClass} value={form.assigned_ptm} onChange={e => set('assigned_ptm', e.target.value)} /></div>
            </div>
          </section>

          <div className="lg:hidden">
            <RiskScoreCard liveRisk={liveRisk} comparisons={comparisons} calibration={calibration} />
          </div>

          <button type="submit" disabled={addTransition.isPending} className="w-full px-4 py-3 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent/80 transition-colors disabled:opacity-50">
            {addTransition.isPending ? 'Saving...' : 'Save & Calculate Risk'}
          </button>
        </form>

        <div className="hidden lg:block">
          <div className="sticky top-6">
            <RiskScoreCard liveRisk={liveRisk} comparisons={comparisons} calibration={calibration} />
          </div>
        </div>
      </div>
    </div>
  );
}
