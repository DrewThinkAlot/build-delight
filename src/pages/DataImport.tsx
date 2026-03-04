import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, RefreshCw, MinusCircle } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import { parseTransitionXlsx, ParseResult, HistoricalTransition, ImportAction } from '@/utils/xlsxParser';
import { toast } from 'sonner';

const ACTION_STYLES: Record<ImportAction, { label: string; cls: string }> = {
  new: { label: 'New', cls: 'text-status-ahead' },
  updated: { label: 'Updated', cls: 'text-accent' },
  skipped: { label: 'No change', cls: 'text-muted-foreground' },
};

export default function DataImport() {
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  // Simulated existing records for dedup (will come from DB later)
  const [existingRecords] = useState<HistoricalTransition[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please upload an XLSX file.');
      return;
    }
    setFileName(file.name);
    setParsing(true);
    setResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseTransitionXlsx(buffer, existingRecords);
      setResult(parsed);
      if (parsed.success) {
        toast.success(`Parsed ${parsed.rows.length} rows: ${parsed.newCount} new, ${parsed.updatedCount} updated, ${parsed.skippedCount} unchanged`);
      } else {
        toast.error('Parsing failed — check errors below.');
      }
    } catch {
      toast.error('Failed to read file.');
    } finally {
      setParsing(false);
    }
  }, [existingRecords]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const PREVIEW_COLS: { key: keyof HistoricalTransition; label: string; width: string }[] = [
    { key: 'physician_name', label: 'Physician', width: 'min-w-[160px]' },
    { key: 'opening_date', label: 'Open Date', width: 'min-w-[100px]' },
    { key: 'guidance_number', label: 'Guidance', width: 'min-w-[80px]' },
    { key: 'opening_balance', label: 'Opening Bal', width: 'min-w-[90px]' },
    { key: 'pct_to_guidance', label: '% to Guide', width: 'min-w-[90px]' },
    { key: 'hit_guidance', label: 'Hit?', width: 'min-w-[50px]' },
    { key: 'segmentation', label: 'Segment', width: 'min-w-[100px]' },
    { key: 'coc_type', label: 'COC', width: 'min-w-[70px]' },
    { key: 'state', label: 'State', width: 'min-w-[50px]' },
    { key: 'paid_members_current', label: 'Paid Mbrs', width: 'min-w-[80px]' },
    { key: 'post_open_growth', label: 'Post-Open +/-', width: 'min-w-[100px]' },
  ];

  const formatCell = (row: HistoricalTransition, key: keyof HistoricalTransition) => {
    const val = row[key];
    if (val === null || val === undefined) return '—';
    if (key === 'pct_to_guidance' && typeof val === 'number') return `${(val * 100).toFixed(1)}%`;
    if (key === 'hit_guidance') return val ? '✓' : '✗';
    return String(val);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-foreground">Data Import</h1>
      <p className="text-sm text-muted-foreground">
        Import historical transition data from MDVIP monthly XLSX files.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`metric-card flex flex-col items-center justify-center py-16 border-2 border-dashed transition-colors cursor-pointer ${
          dragOver ? 'border-accent bg-accent/5' : 'border-border'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={onFileSelect}
        />
        {parsing ? (
          <>
            <Loader2 className="h-10 w-10 text-accent animate-spin mb-4" />
            <p className="text-sm text-foreground font-medium">Parsing {fileName}…</p>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-sm text-foreground font-medium">Drop XLSX file here</p>
            <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
          </>
        )}
      </div>

      {/* Errors */}
      {result && result.errors.length > 0 && (
        <div className="metric-card border-status-critical/30 bg-status-critical/5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-status-critical" />
            <h3 className="text-sm font-semibold text-foreground">Warnings / Errors</h3>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {result.errors.map((err, i) => (
              <li key={i}>• {err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary stats */}
      {result && result.success && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="metric-card text-center py-3">
            <p className="text-2xl font-bold text-foreground">{result.rows.length}</p>
            <p className="text-xs text-muted-foreground">Total Valid</p>
          </div>
          <div className="metric-card text-center py-3">
            <p className="text-2xl font-bold text-status-ahead">{result.newCount}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> New
            </p>
          </div>
          <div className="metric-card text-center py-3">
            <p className="text-2xl font-bold text-accent">{result.updatedCount}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <RefreshCw className="h-3 w-3" /> Updated
            </p>
          </div>
          <div className="metric-card text-center py-3">
            <p className="text-2xl font-bold text-muted-foreground">{result.skippedCount}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <MinusCircle className="h-3 w-3" /> No Change
            </p>
          </div>
        </div>
      )}

      {/* Preview table */}
      {result && result.success && result.rows.length > 0 && (
        <div className="metric-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">
              Import Preview — {result.rows.length} rows from "{result.sheetName}"
            </h3>
            <span className="text-xs text-muted-foreground">
              {result.filteredRows > 0 && `${result.filteredRows} rows filtered out`}
            </span>
          </div>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-3 text-muted-foreground font-medium min-w-[70px]">Action</th>
                  {PREVIEW_COLS.map((col) => (
                    <th key={col.key} className={`text-left py-2 pr-3 text-muted-foreground font-medium ${col.width}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.slice(0, 50).map((importRow, i) => {
                  const style = ACTION_STYLES[importRow.action];
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                      <td className={`py-1.5 pr-3 font-medium ${style.cls}`}>{style.label}</td>
                      {PREVIEW_COLS.map((col) => (
                        <td key={col.key} className={`py-1.5 pr-3 text-foreground ${col.width}`}>
                          <span className={
                            col.key === 'hit_guidance'
                              ? importRow.record.hit_guidance ? 'text-status-ahead' : 'text-status-critical'
                              : col.key === 'post_open_growth' && typeof importRow.record.post_open_growth === 'number'
                                ? importRow.record.post_open_growth > 0 ? 'text-status-ahead' : importRow.record.post_open_growth < 0 ? 'text-status-critical' : ''
                                : ''
                          }>
                            {formatCell(importRow.record, col.key)}
                          </span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {result.rows.length > 50 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Showing first 50 of {result.rows.length} rows
              </p>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !parsing && (
        <div className="metric-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Import Preview</h3>
          <div className="text-center py-8 text-muted-foreground text-sm">
            <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Upload a file to see preview
          </div>
        </div>
      )}

      {/* Import history placeholder */}
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
