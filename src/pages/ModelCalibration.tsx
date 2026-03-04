import { Settings, RefreshCw, Check, X, ChevronDown, Loader2, BarChart3 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  runRecalibration,
  saveCalibration,
  loadHistoricalData,
  runBacktest,
  type RecalibrationResult,
  type BacktestResult,
  type WeightChange,
} from '@/lib/recalibrationEngine';
import type { Weights } from '@/lib/riskScorer';
import { clearWeightsCache } from '@/lib/riskScorer';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';

// ── Types ──────────────────────────────────────────────────────────────

interface CalibrationRow {
  id: string;
  calibration_date: string;
  calibration_label: string | null;
  n_transitions: number;
  overall_hit_rate: number | null;
  is_active: boolean;
  n_hit: number;
  n_missed: number;
}

interface DataStats {
  totalTransitions: number;
  lastImportDate: string | null;
  newSinceCalibration: number;
}

// ── Helpers ────────────────────────────────────────────────────────────

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtPct = (v: number | null) => v == null ? '—' : `${(v * 100).toFixed(1)}%`;
const dot = (conf: string) => conf === 'high' ? '🟢' : conf === 'low' ? '🟡' : '⚪';

// ── Component ──────────────────────────────────────────────────────────

export default function ModelCalibration() {
  const [history, setHistory] = useState<CalibrationRow[]>([]);
  const [dataStats, setDataStats] = useState<DataStats>({ totalTransitions: 0, lastImportDate: null, newSinceCalibration: 0 });
  const [loading, setLoading] = useState(true);

  // Preview state
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<RecalibrationResult | null>(null);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [label, setLabel] = useState('');
  const [accepting, setAccepting] = useState(false);

  const active = history.find(h => h.is_active);

  // ── Load data ──────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [historyRes, countRes, importRes] = await Promise.all([
        supabase.from('risk_weights').select('id, calibration_date, calibration_label, n_transitions, overall_hit_rate, is_active, n_hit, n_missed').order('calibration_date', { ascending: false }),
        supabase.from('historical_transitions').select('id', { count: 'exact', head: true }),
        supabase.from('data_imports').select('import_date').order('import_date', { ascending: false }).limit(1),
      ]);

      setHistory((historyRes.data ?? []) as CalibrationRow[]);

      const activeRow = (historyRes.data ?? []).find((r: any) => r.is_active);
      let newSince = 0;
      if (activeRow) {
        const { count } = await supabase
          .from('historical_transitions')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', (activeRow as any).calibration_date);
        newSince = count ?? 0;
      }

      setDataStats({
        totalTransitions: countRes.count ?? 0,
        lastImportDate: importRes.data?.[0]?.import_date ?? null,
        newSinceCalibration: newSince,
      });
    } catch (e) {
      console.error('Failed to load calibration data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Actions ────────────────────────────────────────────────────────

  const handleRunPreview = async () => {
    setPreviewing(true);
    setPreviewResult(null);
    setBacktestResult(null);
    try {
      const result = await runRecalibration();
      setPreviewResult(result);
    } catch (e: any) {
      toast.error(e.message ?? 'Recalibration failed');
    } finally {
      setPreviewing(false);
    }
  };

  const handleRunBacktest = async () => {
    if (!previewResult) return;
    setBacktestLoading(true);
    try {
      const transitions = await loadHistoricalData();
      const bt = runBacktest(transitions, previewResult.weights as unknown as Weights);
      setBacktestResult(bt);
    } catch (e: any) {
      toast.error(e.message ?? 'Backtest failed');
    } finally {
      setBacktestLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!previewResult) return;
    setAccepting(true);
    try {
      await saveCalibration(previewResult, label || undefined);
      clearWeightsCache();
      toast.success('Model recalibrated. Risk scores will now use updated weights.');
      setPreviewResult(null);
      setBacktestResult(null);
      setLabel('');
      await loadData();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to save calibration');
    } finally {
      setAccepting(false);
    }
  };

  const handleKeepCurrent = () => {
    setPreviewResult(null);
    setBacktestResult(null);
    setLabel('');
  };

  // ── Active model summary ──────────────────────────────────────────

  const activeWeights = active ? null : null; // we show counts from history row

  // Count factor types from active calibration
  const [activeFactorCounts, setActiveFactorCounts] = useState<{ dataDriven: number; qualitative: number } | null>(null);
  useEffect(() => {
    if (!active) return;
    supabase.from('risk_weights').select('weights').eq('id', active.id).single().then(({ data }) => {
      if (!data?.weights) return;
      const w = data.weights as Record<string, any>;
      const all = Object.values(w);
      setActiveFactorCounts({
        dataDriven: all.filter((f: any) => !f.qualitative && (f.n ?? 0) > 0).length,
        qualitative: all.filter((f: any) => f.qualitative).length,
      });
    });
  }, [active]);

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-foreground">Model Calibration</h1>
      <p className="text-sm text-muted-foreground">Risk model weight calibration based on historical outcomes.</p>

      {/* ── Current Model ──────────────────────────────────────────── */}
      <div className="metric-card">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">Current Model</h3>
        </div>
        {active ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground text-xs block">Calibration Date</span>
              <span className="font-mono text-foreground">{fmtDate(active.calibration_date)}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs block">Transitions</span>
              <span className="font-mono text-foreground">{active.n_transitions}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs block">Hit Rate</span>
              <span className="font-mono text-status-ahead">{fmtPct(active.overall_hit_rate)}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs block">Factors</span>
              <span className="font-mono text-foreground">
                {activeFactorCounts
                  ? `${activeFactorCounts.dataDriven} data / ${activeFactorCounts.qualitative} qual`
                  : `${active.n_hit + active.n_missed > 0 ? active.n_hit + active.n_missed : '—'}`}
              </span>
            </div>
            {active.calibration_label && (
              <div className="col-span-2 md:col-span-4">
                <span className="text-muted-foreground text-xs block">Label</span>
                <span className="text-foreground text-sm">{active.calibration_label}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active calibration. Run a recalibration to create one.</p>
        )}
      </div>

      {/* ── Data Available ─────────────────────────────────────────── */}
      <div className="metric-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">Data Available</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground text-xs block">Total in DB</span>
            <span className="font-mono text-foreground">{dataStats.totalTransitions}</span>
          </div>
          <div>
            <span className="text-muted-foreground text-xs block">Last Import</span>
            <span className="font-mono text-foreground">{dataStats.lastImportDate ? fmtDate(dataStats.lastImportDate) : '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground text-xs block">New Since Cal</span>
            <span className={`font-mono ${dataStats.newSinceCalibration > 15 ? 'text-accent' : 'text-foreground'}`}>
              {dataStats.newSinceCalibration}
            </span>
          </div>
        </div>
      </div>

      {/* ── Run button ─────────────────────────────────────────────── */}
      {!previewResult && (
        <button
          onClick={handleRunPreview}
          disabled={previewing || dataStats.totalTransitions < 10}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/80 transition-colors disabled:opacity-50"
        >
          {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {previewing ? 'Running…' : 'Run Recalibration Preview'}
        </button>
      )}

      {/* ── Preview State ──────────────────────────────────────────── */}
      {previewResult && (
        <PreviewSection
          result={previewResult}
          backtestResult={backtestResult}
          backtestLoading={backtestLoading}
          label={label}
          setLabel={setLabel}
          onAccept={handleAccept}
          onKeep={handleKeepCurrent}
          onBacktest={handleRunBacktest}
          accepting={accepting}
        />
      )}

      {/* ── Calibration History ────────────────────────────────────── */}
      <div className="metric-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">Calibration History</h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No calibrations yet.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {history.map(row => (
              <div key={row.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-2 border-b border-border last:border-0">
                <span className="font-mono text-foreground">{fmtDate(row.calibration_date)}</span>
                <span className="text-muted-foreground truncate max-w-[200px]">{row.calibration_label || '—'}</span>
                <span className="text-muted-foreground">{row.n_transitions} trans • {fmtPct(row.overall_hit_rate)}</span>
                {row.is_active && <span className="sm:ml-auto status-badge status-ahead">Active</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Preview Sub-Component ────────────────────────────────────────────────

function PreviewSection({
  result,
  backtestResult,
  backtestLoading,
  label,
  setLabel,
  onAccept,
  onKeep,
  onBacktest,
  accepting,
}: {
  result: RecalibrationResult;
  backtestResult: BacktestResult | null;
  backtestLoading: boolean;
  label: string;
  setLabel: (v: string) => void;
  onAccept: () => void;
  onKeep: () => void;
  onBacktest: () => void;
  accepting: boolean;
}) {
  const { summary, weightChanges, weights } = result;

  // Build unified weight list for table
  const allFactors = Object.entries(weights).map(([key, val]) => {
    const change = weightChanges?.[key];
    return {
      key,
      description: val.description,
      oldWeight: change?.old_weight ?? val.weight,
      newWeight: val.weight,
      delta: change?.delta ?? 0,
      reason: change?.reason ?? (val.qualitative ? 'Qualitative — no structured data yet' : 'Unchanged'),
      confidence: val.confidence ?? (val.qualitative ? 'qualitative' : val.significant ? 'high' : 'low'),
      n: val.n,
      hitRate: val.hit_rate,
    };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.newWeight - a.newWeight);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="metric-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">Recalibration Preview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground text-xs block">Transitions</span>
            <span className="font-mono text-foreground">{summary.n_transitions} <span className="text-muted-foreground text-xs">(6mo weighted 2×)</span></span>
          </div>
          <div>
            <span className="text-muted-foreground text-xs block">Overall Hit Rate</span>
            <span className="font-mono text-status-ahead">{fmtPct(summary.overall_hit_rate)}</span>
          </div>
          <div>
            <span className="text-muted-foreground text-xs block">Data-Driven / Low / Qual</span>
            <span className="font-mono text-foreground">{summary.factors_data_driven} / {summary.factors_low_confidence} / {summary.factors_qualitative}</span>
          </div>
          <div>
            <span className="text-muted-foreground text-xs block">Weights Changed</span>
            <span className={`font-mono ${summary.factors_changed > 0 ? 'text-accent' : 'text-foreground'}`}>{summary.factors_changed}</span>
          </div>
        </div>
      </div>

      {/* Weight changes table */}
      <div className="metric-card overflow-x-auto">
        <h3 className="text-sm font-semibold text-foreground mb-3">Weight Changes</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 text-xs text-muted-foreground font-medium">Factor</th>
              <th className="pb-2 text-xs text-muted-foreground font-medium text-right">Old</th>
              <th className="pb-2 text-xs text-muted-foreground font-medium text-right">New</th>
              <th className="pb-2 text-xs text-muted-foreground font-medium text-right">Δ</th>
              <th className="pb-2 text-xs text-muted-foreground font-medium hidden md:table-cell">Reason</th>
            </tr>
          </thead>
          <tbody>
            {allFactors.map(f => (
              <tr key={f.key} className="border-b border-border/50">
                <td className="py-2 text-foreground">
                  <span className="mr-1.5">{dot(f.confidence)}</span>
                  {f.description}
                  {f.n > 0 && <span className="ml-1.5 text-xs text-muted-foreground">(n={f.n})</span>}
                </td>
                <td className="py-2 text-right font-mono text-muted-foreground">{f.oldWeight}</td>
                <td className="py-2 text-right font-mono text-foreground">{f.newWeight}</td>
                <td className={`py-2 text-right font-mono ${f.delta > 0 ? 'text-status-critical' : f.delta < 0 ? 'text-status-ahead' : 'text-muted-foreground'}`}>
                  {f.delta > 0 ? '+' : ''}{f.delta}
                </td>
                <td className="py-2 text-muted-foreground text-xs hidden md:table-cell max-w-[300px] truncate">{f.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Benchmark changes */}
      <Collapsible>
        <div className="metric-card">
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
            <h3 className="text-sm font-semibold text-foreground">Benchmark Changes</h3>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-2 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <BenchmarkItem label="Overall" value={fmtPct(result.benchmarks.overall_hit_rate)} />
              {Object.entries(result.benchmarks.hit_rate_by_coc).map(([k, v]) => (
                <BenchmarkItem key={k} label={k} value={`${fmtPct(v.rate)} (n=${v.n})`} />
              ))}
            </div>
            <div className="border-t border-border pt-2 grid grid-cols-2 md:grid-cols-3 gap-3">
              <p className="col-span-full text-xs text-muted-foreground font-medium">By Size</p>
              {Object.entries(result.benchmarks.hit_rate_by_size).map(([k, v]) => (
                <BenchmarkItem key={k} label={k} value={`${fmtPct(v.rate)} (n=${v.n})`} />
              ))}
            </div>
            <div className="border-t border-border pt-2 grid grid-cols-2 md:grid-cols-3 gap-3">
              <p className="col-span-full text-xs text-muted-foreground font-medium">By State</p>
              {Object.entries(result.benchmarks.hit_rate_by_state)
                .sort((a, b) => b[1].n - a[1].n)
                .slice(0, 12)
                .map(([k, v]) => (
                  <BenchmarkItem key={k} label={k} value={`${fmtPct(v.rate)} (n=${v.n})`} />
                ))}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Backtest */}
      <Collapsible>
        <div className="metric-card">
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
            <h3 className="text-sm font-semibold text-foreground">Backtest Results</h3>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3 text-sm">
            {!backtestResult && !backtestLoading && (
              <button onClick={onBacktest} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted text-foreground text-sm hover:bg-muted/80 transition-colors">
                <BarChart3 className="h-4 w-4" /> Run Backtest
              </button>
            )}
            {backtestLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Scoring historical transitions…
              </div>
            )}
            {backtestResult && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Scored {backtestResult.totalTransitions} historical transitions with proposed weights:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <span className="text-muted-foreground text-xs block">Avg Score (Hits)</span>
                    <span className="font-mono text-status-ahead">{backtestResult.avgScoreHits.toFixed(0)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Avg Score (Misses)</span>
                    <span className="font-mono text-status-critical">{backtestResult.avgScoreMisses.toFixed(0)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Correlation</span>
                    <span className="font-mono">{backtestResult.correlationCorrect ? '✅ Correct' : '⚠️ Inverted'}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  {backtestResult.tierAccuracy.map(ta => (
                    <div key={ta.tier} className="flex items-center gap-2 text-sm">
                      <span className="font-mono w-20 text-foreground">{ta.tier}</span>
                      <span className="text-muted-foreground">{ta.count} trans, {fmtPct(ta.actualHitRate)} hit</span>
                      <span>{ta.correct ? '✅' : '⚠️'}</span>
                    </div>
                  ))}
                </div>

                {/* Biggest model misses */}
                {(() => {
                  const misses = backtestResult.details
                    .filter(d => !d.prediction_correct)
                    .sort((a, b) => a.risk_score - b.risk_score)
                    .slice(0, 5);
                  if (misses.length === 0) return null;
                  return (
                    <div className="border-t border-border pt-2">
                      <p className="text-xs text-muted-foreground font-medium mb-1">Biggest model misses:</p>
                      {misses.map((m, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          Dr. {m.physician_name} scored {m.risk_score} ({m.risk_tier}) but {m.hit_guidance ? 'hit' : `missed at ${fmtPct(m.pct_to_guidance)}`}
                        </p>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Label + action buttons */}
      <div className="metric-card space-y-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Calibration Label</label>
          <Input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="FY26 Q3 Recalibration"
            className="max-w-sm"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={onAccept}
            disabled={accepting}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-status-ahead/20 text-status-ahead text-sm font-medium hover:bg-status-ahead/30 transition-colors disabled:opacity-50"
          >
            {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Accept New Calibration
          </button>
          <button
            onClick={onKeep}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            <X className="h-4 w-4" /> Keep Current
          </button>
        </div>
      </div>
    </div>
  );
}

function BenchmarkItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs block">{label}</span>
      <span className="font-mono text-foreground text-sm">{value}</span>
    </div>
  );
}
