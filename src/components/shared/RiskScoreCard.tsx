import { useState } from 'react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { AlertTriangle, ShieldCheck, Info, ChevronDown, ChevronUp, ClipboardCheck, BarChart3 } from 'lucide-react';
import type { RiskScoreResult, BenchmarkComparison, ActiveWeightsResult } from '@/lib/riskScorer';

const CHECKLIST_MAP: Record<string, string> = {
  coc_out: 'Plan additional patient communication touchpoints — COC Out patients need more reassurance and physician involvement (forums, personal calls)',
  small_guidance: 'Verify patient data quality — 3 FY26 mea culpas were caused by bad underlying data on small practices',
  msrp_very_high: 'Prepare physician with fee objection-handling scripts — price sensitivity above $2,700 is measurably real',
  msrp_high: 'Monitor price sensitivity signals early in transition',
  short_transition: 'Front-load outreach in weeks 1-3 — enrollment curve shows 46% of members join in the first 20% of transition time',
  medium_transition: 'Set aggressive early milestones — limited runway to course-correct',
  high_risk_state: 'Review state-specific precedents — research what worked for prior transitions in this state',
  moderate_risk_state: 'Be aware of regional performance patterns — this state has historically underperformed',
  physician_part_time: 'Establish clear weekly patient interaction commitments with the physician — part-time doctors need structured outreach schedules',
  weak_patient_relationships: 'Invest in patient forums and physician-led events — the doctor needs face time to build trust before asking for membership commitment',
  fee_discomfort: 'Schedule a fee messaging coaching session with the physician BEFORE transition starts — rehearse the value conversation',
  low_engagement: 'Plan an in-person kick-off visit — low-engagement physicians need early momentum and personal connection to the PEM',
  partner_misaligned: 'CRITICAL: Resolve partner alignment before proceeding — partner conflicts caused 3 mea culpas this year. Escalate to PTM/leadership if needed',
  high_medicaid: 'CRITICAL: Validate payer mix data independently — Durbin mea culpa was 70% medi-medi discovered too late. Realistic addressable panel may be much smaller than total panel',
  moderate_medicaid: 'Recalculate realistic addressable patient pool excluding Medicaid patients',
  high_dual_eligible: 'CRITICAL: Same as high Medicaid — dual-eligible patients almost never convert. Verify the real conversion-eligible pool size',
  low_55_plus: 'Build an outreach strategy for 40-54 age bracket — after-hours calls (5-6 PM) worked for reaching working-age patients in FY26',
};

interface RiskScoreCardProps {
  liveRisk: RiskScoreResult | null;
  comparisons: BenchmarkComparison[];
  calibration: ActiveWeightsResult | null;
}

export function RiskScoreCard({ liveRisk, comparisons, calibration }: RiskScoreCardProps) {
  const [factorsOpen, setFactorsOpen] = useState(true);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  if (!liveRisk) {
    return (
      <div className="metric-card text-center text-sm text-muted-foreground">
        <ShieldCheck className="h-5 w-5 mx-auto mb-2 text-muted-foreground/50" />
        Loading risk model…
      </div>
    );
  }

  const tierColor =
    liveRisk.tier === 'CRITICAL' ? 'border-status-critical' :
    liveRisk.tier === 'HIGH' ? 'border-status-behind' :
    liveRisk.tier === 'MODERATE' ? 'border-status-on-track' : 'border-status-ahead';

  const tierBg =
    liveRisk.tier === 'CRITICAL' ? 'bg-status-critical/10' :
    liveRisk.tier === 'HIGH' ? 'bg-status-behind/10' :
    liveRisk.tier === 'MODERATE' ? 'bg-status-on-track/10' : 'bg-status-ahead/10';

  const scoreColor =
    liveRisk.tier === 'CRITICAL' ? 'text-status-critical' :
    liveRisk.tier === 'HIGH' ? 'text-status-behind' :
    liveRisk.tier === 'MODERATE' ? 'text-status-on-track' : 'text-status-ahead';

  const checklistItems = liveRisk.factors
    .filter(f => CHECKLIST_MAP[f.id])
    .map(f => ({ id: f.id, text: CHECKLIST_MAP[f.id] }));

  return (
    <div className="space-y-4">
      {/* ── Score Card ── */}
      <div className={cn('metric-card text-center border-2 transition-colors', tierColor, tierBg)}>
        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Live Risk Score</p>
        <div className={cn('text-4xl font-bold font-mono', scoreColor)}>{liveRisk.score}</div>
        <StatusBadge status={liveRisk.tier} className="mt-1" />
        {calibration && (
          <p className="mt-2 text-[10px] text-muted-foreground/70 leading-tight">
            Based on {calibration.nTransitions} transitions · Calibrated {new Date(calibration.calibrationDate).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* ── Contributing Factors (collapsible) ── */}
      <div className="metric-card">
        <button
          type="button"
          onClick={() => setFactorsOpen(!factorsOpen)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-status-behind" />
            <h3 className="text-xs font-semibold text-foreground">
              Risk Factors ({liveRisk.factors.length})
            </h3>
          </div>
          {factorsOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>

        {factorsOpen && (
          <div className="mt-3 space-y-2">
            {liveRisk.factors.length === 0 ? (
              <div className="text-center py-2">
                <ShieldCheck className="h-4 w-4 mx-auto mb-1 text-status-ahead" />
                <p className="text-xs text-status-ahead font-medium">No risk factors identified</p>
              </div>
            ) : (
              liveRisk.factors.map((f) => (
                <div key={f.id} className="border-b border-border/40 pb-2 last:border-0 last:pb-0">
                  <div className="flex justify-between items-start gap-2 text-xs">
                    <div className="flex items-start gap-1.5 min-w-0">
                      <span className={cn('mt-0.5 shrink-0 w-2 h-2 rounded-full',
                        f.confidence === 'high' ? 'bg-status-ahead' :
                        f.confidence === 'low' ? 'bg-status-on-track' : 'bg-muted-foreground/40'
                      )} />
                      <span className="text-foreground leading-tight">{f.label}</span>
                    </div>
                    <span className="font-mono text-status-behind shrink-0">+{f.points}</span>
                  </div>
                  <div className="ml-3.5 mt-0.5 text-[10px] text-muted-foreground">
                    {f.confidence === 'high' && (
                      <span>n={f.n}, {((f.hit_rate ?? 0) * 100).toFixed(0)}% hit rate
                        {f.hit_rate != null && (f as any).hit_rate_absent != null && (
                          <> vs {(((f as any).hit_rate_absent ?? 0) * 100).toFixed(0)}% without</>
                        )}
                      </span>
                    )}
                    {f.confidence === 'low' && <span>n={f.n}, low sample</span>}
                    {f.confidence === 'qualitative' && <span>Expert judgment</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Similar Transitions ── */}
      {comparisons.length > 0 && (
        <div className="metric-card">
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart3 className="h-3.5 w-3.5 text-accent" />
            <h3 className="text-xs font-semibold text-foreground">Transitions like this one</h3>
          </div>
          <div className="space-y-1.5">
            {comparisons.map((c, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                <span className="text-foreground">{c.label}</span> hit guidance{' '}
                <span className="font-mono text-foreground">{(c.hit_rate * 100).toFixed(0)}%</span> of the time{' '}
                <span className="text-muted-foreground/70">(n={c.n})</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── Pre-Transition Checklist ── */}
      {checklistItems.length > 0 && (
        <div className="metric-card">
          <button
            type="button"
            onClick={() => setChecklistOpen(!checklistOpen)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-1.5">
              <ClipboardCheck className="h-3.5 w-3.5 text-accent" />
              <h3 className="text-xs font-semibold text-foreground">
                Pre-Transition Checklist ({checklistItems.length})
              </h3>
            </div>
            {checklistOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>

          {checklistOpen && (
            <div className="mt-3 space-y-2">
              {checklistItems.map((item) => (
                <label key={item.id} className="flex items-start gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={!!checked[item.id]}
                    onChange={() => setChecked(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                    className="accent-accent mt-0.5 shrink-0"
                  />
                  <span className={cn(
                    'text-xs leading-tight transition-colors',
                    checked[item.id] ? 'text-muted-foreground line-through' : 'text-foreground',
                    item.text.startsWith('CRITICAL') && !checked[item.id] && 'text-status-critical font-medium'
                  )}>
                    {item.text}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
