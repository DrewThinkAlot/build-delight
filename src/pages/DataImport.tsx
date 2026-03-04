import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, RefreshCw, MinusCircle, Database } from 'lucide-react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { parseTransitionXlsx, ImportPreview, ParsedTransition } from '@/utils/xlsxParser';
import { confirmImport, fetchExistingRecords } from '@/utils/importService';
import { toast } from 'sonner';

export default function DataImport() {
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [committed, setCommitted] = useState(false);
  const [existingRecords, setExistingRecords] = useState<{ physician_name: string; opening_date: string | null; paid_members_current: number | null; post_open_growth: number | null }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing records on mount for dedup
  useEffect(() => {
    fetchExistingRecords()
      .then(setExistingRecords)
      .catch(err => console.error('Failed to fetch existing records:', err));
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please upload an XLSX file.');
      return;
    }
    setParsing(true);
    setPreview(null);
    setCommitted(false);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseTransitionXlsx(buffer, file.name, existingRecords);
      setPreview(parsed);
      const total = parsed.newTransitions.length + parsed.updatedTransitions.length + parsed.skippedTransitions.length;
      toast.success(`Parsed ${total} guided transitions: ${parsed.newTransitions.length} new, ${parsed.updatedTransitions.length} updated, ${parsed.skippedTransitions.length} unchanged`);
    } catch {
      toast.error('Failed to read file.');
    } finally {
      setParsing(false);
    }
  }, [existingRecords]);

  const handleConfirm = useCallback(async () => {
    if (!preview) return;
    setCommitting(true);
    try {
      const result = await confirmImport(preview);
      if (result.success) {
        toast.success(`Import complete: ${result.inserted} inserted, ${result.updated} updated`);
        setCommitted(true);
        // Refresh existing records
        const updated = await fetchExistingRecords();
        setExistingRecords(updated);
      } else {
        toast.error(`Import had errors: ${result.errors.join('; ')}`);
      }
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCommitting(false);
    }
  }, [preview]);

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

  const PREVIEW_COLS: { key: keyof ParsedTransition; label: string }[] = [
    { key: 'physician_name', label: 'Physician' },
    { key: 'opening_date', label: 'Open Date' },
    { key: 'guidance_number', label: 'Guidance' },
    { key: 'opening_balance', label: 'Opening Bal' },
    { key: 'pct_to_guidance', label: '% to Guide' },
    { key: 'hit_guidance', label: 'Hit?' },
    { key: 'segmentation', label: 'Segment' },
    { key: 'coc_type', label: 'COC' },
    { key: 'state', label: 'State' },
    { key: 'paid_members_current', label: 'Paid Mbrs' },
    { key: 'post_open_growth', label: 'Post-Open +/-' },
  ];

  const formatCell = (row: ParsedTransition, key: keyof ParsedTransition) => {
    const val = row[key];
    if (val === null || val === undefined) return '—';
    if (key === 'pct_to_guidance' && typeof val === 'number') return `${(val * 100).toFixed(1)}%`;
    if (key === 'hit_guidance') return val ? '✓' : '✗';
    return String(val);
  };

  const hasChanges = preview && (preview.newTransitions.length > 0 || preview.updatedTransitions.length > 0);

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
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileSelect} />
        {parsing ? (
          <>
            <Loader2 className="h-10 w-10 text-accent animate-spin mb-4" />
            <p className="text-sm text-foreground font-medium">Parsing…</p>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-sm text-foreground font-medium">Drop XLSX file here</p>
            <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
          </>
        )}
      </div>

      {/* Parse errors */}
      {preview && preview.errors.length > 0 && (
        <div className="metric-card border-status-critical/30 bg-status-critical/5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-status-critical" />
            <h3 className="text-sm font-semibold text-foreground">Parse Errors ({preview.errors.length})</h3>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground max-h-32 overflow-y-auto">
            {preview.errors.map((err, i) => (
              <li key={i}>Row {err.row}: {err.physician_name ?? '(unknown)'} — {err.error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary stats */}
      {preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="metric-card text-center py-3">
              <p className="text-2xl font-bold text-foreground">{preview.guidedTransitions}</p>
              <p className="text-xs text-muted-foreground">Guided</p>
            </div>
            <div className="metric-card text-center py-3">
              <p className="text-2xl font-bold text-status-ahead">{preview.newTransitions.length}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> New
              </p>
            </div>
            <div className="metric-card text-center py-3">
              <p className="text-2xl font-bold text-accent">{preview.updatedTransitions.length}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <RefreshCw className="h-3 w-3" /> Updated
              </p>
            </div>
            <div className="metric-card text-center py-3">
              <p className="text-2xl font-bold text-muted-foreground">{preview.skippedTransitions.length}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <MinusCircle className="h-3 w-3" /> Unchanged
              </p>
            </div>
            <div className="metric-card text-center py-3">
              <p className="text-2xl font-bold text-muted-foreground">{preview.filteredRows}</p>
              <p className="text-xs text-muted-foreground">Filtered Out</p>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            File: <span className="text-foreground">{preview.fileName}</span> · 
            Sheet: <span className="text-foreground">{preview.sheetName ?? 'N/A'}</span> · 
            Vintage: <span className="text-foreground">{new Date().toISOString().split('T')[0]}</span>
          </div>
        </div>
      )}

      {/* Updated transitions detail */}
      {preview && preview.updatedTransitions.length > 0 && (
        <div className="metric-card">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-accent" />
            Updated Transitions ({preview.updatedTransitions.length})
          </h3>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Physician</th>
                  <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Open Date</th>
                  <th className="text-right py-2 pr-3 text-muted-foreground font-medium">Old Members</th>
                  <th className="text-right py-2 pr-3 text-muted-foreground font-medium">New Members</th>
                  <th className="text-right py-2 pr-3 text-muted-foreground font-medium">Old Growth</th>
                  <th className="text-right py-2 pr-3 text-muted-foreground font-medium">New Growth</th>
                </tr>
              </thead>
              <tbody>
                {preview.updatedTransitions.map((upd, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1.5 pr-3 text-foreground">{upd.physician_name}</td>
                    <td className="py-1.5 pr-3 text-foreground">{upd.opening_date ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-right text-muted-foreground">{upd.old_paid_members ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-right text-accent font-medium">{upd.new_paid_members ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-right text-muted-foreground">{upd.old_post_open_growth ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-right text-accent font-medium">{upd.new_post_open_growth ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New transitions preview */}
      {preview && preview.newTransitions.length > 0 && (
        <div className="metric-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            New Transitions ({preview.newTransitions.length})
          </h3>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {PREVIEW_COLS.map((col) => (
                    <th key={String(col.key)} className="text-left py-2 pr-3 text-muted-foreground font-medium whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.newTransitions.slice(0, 50).map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                    {PREVIEW_COLS.map((col) => (
                      <td key={String(col.key)} className="py-1.5 pr-3 text-foreground whitespace-nowrap">
                        <span className={
                          col.key === 'hit_guidance'
                            ? row.hit_guidance ? 'text-status-ahead' : 'text-status-critical'
                            : col.key === 'post_open_growth' && typeof row.post_open_growth === 'number'
                              ? row.post_open_growth > 0 ? 'text-status-ahead' : row.post_open_growth < 0 ? 'text-status-critical' : ''
                              : ''
                        }>
                          {formatCell(row, col.key)}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.newTransitions.length > 50 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Showing first 50 of {preview.newTransitions.length} rows
              </p>
            )}
          </div>
        </div>
      )}

      {/* Confirm button */}
      {preview && hasChanges && !committed && (
        <div className="flex justify-end">
          <button
            onClick={handleConfirm}
            disabled={committing}
            className="flex items-center gap-2 px-6 py-2.5 bg-accent text-accent-foreground font-medium text-sm rounded hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {committing ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Committing…</>
            ) : (
              <><Database className="h-4 w-4" /> Confirm Import ({preview.newTransitions.length} new, {preview.updatedTransitions.length} updated)</>
            )}
          </button>
        </div>
      )}

      {committed && (
        <div className="metric-card border-status-ahead/30 bg-status-ahead/5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-status-ahead" />
            <p className="text-sm font-medium text-foreground">Import committed successfully.</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!preview && !parsing && (
        <div className="metric-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Import Preview</h3>
          <div className="text-center py-8 text-muted-foreground text-sm">
            <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Upload a file to see preview
          </div>
        </div>
      )}
    </div>
  );
}
