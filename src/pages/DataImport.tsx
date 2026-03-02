import { Upload, FileSpreadsheet, CheckCircle2, XCircle } from 'lucide-react';
import { useState } from 'react';

export default function DataImport() {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-foreground">Data Import</h1>
      <p className="text-sm text-muted-foreground">Import historical transition data from XLSX files.</p>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); }}
        className={`metric-card flex flex-col items-center justify-center py-16 border-2 border-dashed transition-colors cursor-pointer ${
          dragOver ? 'border-accent bg-accent/5' : 'border-border'
        }`}
      >
        <Upload className="h-10 w-10 text-muted-foreground mb-4" />
        <p className="text-sm text-foreground font-medium">Drop XLSX file here</p>
        <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
        <p className="text-xs text-muted-foreground mt-4 px-8 text-center">
          XLSX parsing will be connected via backend integration. This UI is ready to display parsed results.
        </p>
      </div>

      {/* Preview placeholder */}
      <div className="metric-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">Import Preview</h3>
        <div className="text-center py-8 text-muted-foreground text-sm">
          <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-30" />
          Upload a file to see preview
        </div>
      </div>

      {/* Import history */}
      <div className="metric-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">Import History</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm py-2 border-b border-border">
            <CheckCircle2 className="h-4 w-4 text-status-ahead shrink-0" />
            <span className="text-foreground">FY2025_Q4_transitions.xlsx</span>
            <span className="text-muted-foreground ml-auto text-xs">Jan 15, 2026</span>
          </div>
          <div className="flex items-center gap-3 text-sm py-2">
            <CheckCircle2 className="h-4 w-4 text-status-ahead shrink-0" />
            <span className="text-foreground">FY2025_Q3_transitions.xlsx</span>
            <span className="text-muted-foreground ml-auto text-xs">Oct 1, 2025</span>
          </div>
        </div>
      </div>
    </div>
  );
}
