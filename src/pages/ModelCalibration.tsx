import { Settings, RefreshCw, Check, X } from 'lucide-react';
import { useState } from 'react';

const sampleFactors = [
  { factor: 'COC Out', oldWeight: 15, newWeight: 13, hitRate: 0.72, sampleSize: 45 },
  { factor: 'High MSRP (>$2,700)', oldWeight: 14, newWeight: 16, hitRate: 0.58, sampleSize: 23 },
  { factor: 'Short Timeline (≤12w)', oldWeight: 15, newWeight: 18, hitRate: 0.52, sampleSize: 12 },
  { factor: 'PA State', oldWeight: 10, newWeight: 10, hitRate: 0.65, sampleSize: 18 },
  { factor: 'Weak Relationships', oldWeight: 12, newWeight: 14, hitRate: 0.55, sampleSize: 8 },
  { factor: 'High Medicaid (>30%)', oldWeight: 20, newWeight: 22, hitRate: 0.45, sampleSize: 6 },
];

export default function ModelCalibration() {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-foreground">Model Calibration</h1>
      <p className="text-sm text-muted-foreground">Risk model weight calibration based on historical outcomes.</p>

      {/* Current model card */}
      <div className="metric-card">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">Current Model</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-muted-foreground text-xs block">Calibration Date</span><span className="font-mono text-foreground">Jan 1, 2026</span></div>
          <div><span className="text-muted-foreground text-xs block">Transitions</span><span className="font-mono text-foreground">187</span></div>
          <div><span className="text-muted-foreground text-xs block">Hit Rate</span><span className="font-mono text-status-ahead">78.6%</span></div>
          <div><span className="text-muted-foreground text-xs block">Factors</span><span className="font-mono text-foreground">14</span></div>
        </div>
      </div>

      {/* Data summary */}
      <div className="metric-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">Data Summary</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div><span className="text-muted-foreground text-xs block">Total in DB</span><span className="font-mono text-foreground">203</span></div>
          <div><span className="text-muted-foreground text-xs block">Last Import</span><span className="font-mono text-foreground">Jan 15, 2026</span></div>
          <div><span className="text-muted-foreground text-xs block">New Since Cal</span><span className="font-mono text-accent">16</span></div>
        </div>
      </div>

      <button onClick={() => setShowPreview(!showPreview)}
        className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/80 transition-colors">
        <RefreshCw className="h-4 w-4" /> Run Recalibration Preview
      </button>

      {showPreview && (
        <div className="space-y-4">
          <div className="metric-card overflow-x-auto">
            <h3 className="text-sm font-semibold text-foreground mb-3">Calibration Preview</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 text-xs text-muted-foreground font-medium">Factor</th>
                  <th className="pb-2 text-xs text-muted-foreground font-medium text-right">Old</th>
                  <th className="pb-2 text-xs text-muted-foreground font-medium text-right">New</th>
                  <th className="pb-2 text-xs text-muted-foreground font-medium text-right">Δ</th>
                  <th className="pb-2 text-xs text-muted-foreground font-medium text-right">Hit Rate</th>
                  <th className="pb-2 text-xs text-muted-foreground font-medium text-right">n</th>
                </tr>
              </thead>
              <tbody>
                {sampleFactors.map(f => {
                  const delta = f.newWeight - f.oldWeight;
                  return (
                    <tr key={f.factor} className="border-b border-border/50">
                      <td className="py-2 text-foreground">
                        {f.factor}
                        {f.sampleSize < 10 && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-status-behind/20 text-status-behind">Low n</span>}
                      </td>
                      <td className="py-2 text-right font-mono text-muted-foreground">{f.oldWeight}</td>
                      <td className="py-2 text-right font-mono text-foreground">{f.newWeight}</td>
                      <td className={`py-2 text-right font-mono ${delta > 0 ? 'text-status-critical' : delta < 0 ? 'text-status-ahead' : 'text-muted-foreground'}`}>
                        {delta > 0 ? '+' : ''}{delta}
                      </td>
                      <td className="py-2 text-right font-mono text-foreground">{(f.hitRate * 100).toFixed(0)}%</td>
                      <td className="py-2 text-right font-mono text-muted-foreground">{f.sampleSize}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 rounded-md bg-status-ahead/20 text-status-ahead text-sm font-medium hover:bg-status-ahead/30 transition-colors">
              <Check className="h-4 w-4" /> Accept New Calibration
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-md bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80 transition-colors">
              <X className="h-4 w-4" /> Keep Current
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            Actual recalibration engine will be connected via backend integration. This UI displays sample data.
          </p>
        </div>
      )}

      {/* Calibration history */}
      <div className="metric-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">Calibration History</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-3 py-2 border-b border-border">
            <span className="font-mono text-foreground">Jan 1, 2026</span>
            <span className="text-muted-foreground">187 transitions • 78.6% hit rate</span>
            <span className="ml-auto status-badge status-ahead">Active</span>
          </div>
          <div className="flex items-center gap-3 py-2">
            <span className="font-mono text-foreground">Jul 1, 2025</span>
            <span className="text-muted-foreground">156 transitions • 76.2% hit rate</span>
          </div>
        </div>
      </div>
    </div>
  );
}
