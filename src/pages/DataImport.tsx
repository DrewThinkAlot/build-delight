import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, RefreshCw, MinusCircle, Database, XCircle, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { parseTransitionXlsx, ImportPreview, ParsedTransition } from '@/utils/xlsxParser';
import { parseSnapshotFile, SnapshotImportPreview } from '@/utils/snapshotParser';
import { confirmImport, fetchExistingRecords } from '@/utils/importService';
import { upsertSnapshot } from '@/hooks/useWeeklySnapshots';
import { useTransitionsList } from '@/hooks/useTransitionData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ImportLog {
  id: string;
  file_name: string;
  sheet_name: string | null;
  total_rows: number;
  new_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  import_date: string;
}

type ImportTab = 'historical' | 'snapshots';

export default function DataImport() {
  const [activeTab, setActiveTab] = useState<ImportTab>('historical');

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
      <h1 className="text-xl font-bold text-foreground">Data Import</h1>
      <p className="text-sm text-muted-foreground">
        Import historical transition data or weekly snapshots.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab('historical')}
          className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
            activeTab === 'historical' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Historical Transitions
        </button>
        <button
          onClick={() => setActiveTab('snapshots')}
          className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
            activeTab === 'snapshots' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Weekly Snapshots
        </button>
      </div>

      {activeTab === 'historical' && <HistoricalImportSection />}
      {activeTab === 'snapshots' && <SnapshotImportSection />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// HISTORICAL TRANSITIONS IMPORT (existing logic, extracted)
// ═══════════════════════════════════════════════════════════════════════

function HistoricalImportSection() {
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [committed, setCommitted] = useState(false);
  const [errorsExpanded, setErrorsExpanded] = useState(false);
  const [importHistory, setImportHistory] = useState<ImportLog[]>([]);
  const [existingRecords, setExistingRecords] = useState<{ physician_name: string; opening_date: string | null; paid_members_current: number | null; post_open_growth: number | null }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchExistingRecords()
      .then(setExistingRecords)
      .catch(err => console.error('Failed to fetch existing records:', err));
    loadImportHistory();
  }, []);

  const loadImportHistory = async () => {
    const { data, error } = await supabase
      .from('data_imports')
      .select('*')
      .order('import_date', { ascending: false })
      .limit(20);
    if (!error && data) setImportHistory(data as ImportLog[]);
  };

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
      toast.success(`Parsed ${total} guided transitions`);
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
        setPreview(null);
        const updated = await fetchExistingRecords();
        setExistingRecords(updated);
        loadImportHistory();
      } else {
        toast.error(`Import had errors: ${result.errors.join('; ')}`);
      }
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCommitting(false);
    }
  }, [preview]);

  const handleCancel = useCallback(() => {
    setPreview(null);
    setCommitted(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

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
    { key: 'state', label: 'State' },
    { key: 'coc_type', label: 'COC' },
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
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`metric-card flex flex-col items-center justify-center py-10 sm:py-16 border-2 border-dashed transition-colors cursor-pointer ${
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
            <p className="text-xs text-muted-foreground mt-1">or click to browse · .xlsx only</p>
          </>
        )}
      </div>

      {/* Success banner */}
      {committed && (
        <div className="metric-card border-status-ahead/30 bg-status-ahead/5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-status-ahead" />
            <p className="text-sm font-medium text-foreground">Import committed successfully.</p>
          </div>
        </div>
      )}

      {/* Preview Section */}
      {preview && (
        <div className="space-y-4">
          <div className="metric-card">
            <div className="flex items-center gap-4 text-sm">
              <FileSpreadsheet className="h-5 w-5 text-accent shrink-0" />
              <div className="space-y-0.5">
                <p className="text-foreground font-medium">{preview.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  Sheet: <span className={preview.sheetFound ? 'text-status-ahead' : 'text-status-critical'}>
                    {preview.sheetName ?? 'N/A'} {preview.sheetFound ? '✓' : '✗'}
                  </span>
                  {' · '}{preview.totalRows} rows scanned
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="metric-card text-center py-3 border-status-ahead/20">
              <p className="text-2xl font-bold text-status-ahead">{preview.newTransitions.length}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><CheckCircle2 className="h-3 w-3 text-status-ahead" /> New</p>
            </div>
            <div className="metric-card text-center py-3 border-accent/20">
              <p className="text-2xl font-bold text-accent">{preview.updatedTransitions.length}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><RefreshCw className="h-3 w-3 text-accent" /> Updated</p>
            </div>
            <div className="metric-card text-center py-3">
              <p className="text-2xl font-bold text-muted-foreground">{preview.skippedTransitions.length}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><MinusCircle className="h-3 w-3" /> Unchanged</p>
            </div>
            <div className="metric-card text-center py-3 border-status-critical/20">
              <p className="text-2xl font-bold text-status-critical">{preview.errors.length}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><XCircle className="h-3 w-3 text-status-critical" /> Errors</p>
            </div>
          </div>

          {/* New transitions table */}
          {preview.newTransitions.length > 0 && (
            <div className="metric-card">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-status-ahead" /> New Transitions ({preview.newTransitions.length})
              </h3>
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {PREVIEW_COLS.map((col) => (
                        <th key={String(col.key)} className="text-left py-2 pr-3 text-muted-foreground font-medium whitespace-nowrap">{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.newTransitions.slice(0, 50).map((row, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                        {PREVIEW_COLS.map((col) => (
                          <td key={String(col.key)} className="py-1.5 pr-3 text-foreground whitespace-nowrap">
                            <span className={col.key === 'hit_guidance' ? (row.hit_guidance ? 'text-status-ahead' : 'text-status-critical') : ''}>
                              {formatCell(row, col.key)}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.newTransitions.length > 50 && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">Showing first 50 of {preview.newTransitions.length}</p>
                )}
              </div>
            </div>
          )}

          {/* Updated transitions table */}
          {preview.updatedTransitions.length > 0 && (
            <div className="metric-card">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-accent" /> Updated Transitions ({preview.updatedTransitions.length})
              </h3>
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Physician</th>
                      <th className="text-left py-2 pr-3 text-muted-foreground font-medium hidden sm:table-cell">Open Date</th>
                      <th className="text-right py-2 pr-3 text-muted-foreground font-medium">Old Paid</th>
                      <th className="text-right py-2 pr-3 text-muted-foreground font-medium">New Paid</th>
                      <th className="text-right py-2 pr-3 text-muted-foreground font-medium hidden sm:table-cell">Old Growth</th>
                      <th className="text-right py-2 pr-3 text-muted-foreground font-medium hidden sm:table-cell">New Growth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.updatedTransitions.map((upd, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-1.5 pr-3 text-foreground truncate max-w-[120px]">{upd.physician_name}</td>
                        <td className="py-1.5 pr-3 text-foreground hidden sm:table-cell">{upd.opening_date ?? '—'}</td>
                        <td className="py-1.5 pr-3 text-right text-muted-foreground">{upd.old_paid_members ?? '—'}</td>
                        <td className="py-1.5 pr-3 text-right text-accent font-medium">{upd.new_paid_members ?? '—'}</td>
                        <td className="py-1.5 pr-3 text-right text-muted-foreground hidden sm:table-cell">{upd.old_post_open_growth ?? '—'}</td>
                        <td className="py-1.5 pr-3 text-right text-accent font-medium hidden sm:table-cell">{upd.new_post_open_growth ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Errors */}
          {preview.errors.length > 0 && (
            <div className="metric-card border-status-critical/20">
              <button onClick={() => setErrorsExpanded(!errorsExpanded)} className="flex items-center justify-between w-full text-left">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-status-critical" /> Parse Errors ({preview.errors.length})
                </h3>
                {errorsExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {errorsExpanded && (
                <div className="mt-3 overflow-x-auto -mx-4 px-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 pr-3 text-muted-foreground font-medium w-16">Row</th>
                        <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Physician</th>
                        <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.errors.map((err, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-1.5 pr-3 text-muted-foreground">{err.row}</td>
                          <td className="py-1.5 pr-3 text-foreground">{err.physician_name ?? '—'}</td>
                          <td className="py-1.5 pr-3 text-status-critical">{err.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          {!committed && (
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button onClick={handleCancel} disabled={committing} className="px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded transition-colors disabled:opacity-50 w-full sm:w-auto text-center">Cancel</button>
              {hasChanges && (
                <button onClick={handleConfirm} disabled={committing} className="flex items-center justify-center gap-2 px-6 py-2.5 bg-accent text-accent-foreground font-medium text-sm rounded hover:bg-accent/90 transition-colors disabled:opacity-50 w-full sm:w-auto">
                  {committing ? <><Loader2 className="h-4 w-4 animate-spin" /> Committing…</> : <><Database className="h-4 w-4 shrink-0" /> Confirm ({preview.newTransitions.length} new, {preview.updatedTransitions.length} updated)</>}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!preview && !parsing && !committed && (
        <div className="metric-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Import Preview</h3>
          <div className="text-center py-8 text-muted-foreground text-sm">
            <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Upload a file to see preview
          </div>
        </div>
      )}

      {/* Import History */}
      <div className="metric-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">Import History</h3>
        {importHistory.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No imports yet</p>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Date</th>
                  <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Source File</th>
                  <th className="text-right py-2 pr-3 text-muted-foreground font-medium">New</th>
                  <th className="text-right py-2 pr-3 text-muted-foreground font-medium">Updated</th>
                  <th className="text-right py-2 pr-3 text-muted-foreground font-medium">Skipped</th>
                  <th className="text-right py-2 pr-3 text-muted-foreground font-medium">Errors</th>
                </tr>
              </thead>
              <tbody>
                {importHistory.map((log) => (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">{format(new Date(log.import_date), 'MMM d, yyyy h:mm a')}</td>
                    <td className="py-1.5 pr-3 text-foreground">{log.file_name}</td>
                    <td className="py-1.5 pr-3 text-right text-status-ahead font-medium">{log.new_count}</td>
                    <td className="py-1.5 pr-3 text-right text-accent font-medium">{log.updated_count}</td>
                    <td className="py-1.5 pr-3 text-right text-muted-foreground">{log.skipped_count}</td>
                    <td className="py-1.5 pr-3 text-right text-status-critical">{log.error_count > 0 ? log.error_count : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// WEEKLY SNAPSHOTS IMPORT (new)
// ═══════════════════════════════════════════════════════════════════════

function SnapshotImportSection() {
  const { transitions } = useTransitions();
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState<SnapshotImportPreview | null>(null);
  const [committed, setCommitted] = useState(false);
  const [errorsExpanded, setErrorsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      toast.error('Please upload an XLSX or CSV file.');
      return;
    }
    setParsing(true);
    setPreview(null);
    setCommitted(false);
    try {
      const buffer = await file.arrayBuffer();
      const matchable = transitions.map(t => ({
        id: t.id,
        physician_name: t.physician_name,
        physician_id: t.physician_id,
        state: t.state,
        opening_date: t.opening_date,
      }));
      const parsed = parseSnapshotFile(buffer, file.name, matchable);
      setPreview(parsed);
      toast.success(`Parsed ${parsed.matched.length + parsed.unmatched.length} snapshot rows`);
    } catch {
      toast.error('Failed to read file.');
    } finally {
      setParsing(false);
    }
  }, [transitions]);

  const handleConfirm = useCallback(async () => {
    if (!preview) return;
    setCommitting(true);
    let upserted = 0;
    const errors: string[] = [];

    try {
      for (const { snapshot, transitionId } of preview.matched) {
        const result = await upsertSnapshot({
          transition_id: transitionId,
          week_ending_date: snapshot.week_ending_date,
          paid_members: snapshot.paid_members,
          guidance_number: snapshot.guidance_number,
          touches_mer_last_week: snapshot.touches_mer_last_week,
          touches_pa_last_week: snapshot.touches_pa_last_week,
          doctor_calls_last_week: snapshot.doctor_calls_last_week,
          weekly_needed_to_hit_guidance: snapshot.weekly_needed_to_hit_guidance,
          strategic_activities: snapshot.strategic_activities,
          notes: snapshot.notes,
          strategy_changed: snapshot.strategy_changed,
        });
        if (result.success) {
          upserted++;
        } else {
          errors.push(`${snapshot.physician_name} (${snapshot.week_ending_date}): ${result.error}`);
        }
      }

      if (errors.length === 0) {
        toast.success(`Imported ${upserted} snapshots successfully`);
        setCommitted(true);
        setPreview(null);
      } else {
        toast.error(`Imported ${upserted} snapshots with ${errors.length} errors`);
      }
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCommitting(false);
    }
  }, [preview]);

  const handleCancel = useCallback(() => {
    setPreview(null);
    setCommitted(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

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

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`metric-card flex flex-col items-center justify-center py-10 sm:py-16 border-2 border-dashed transition-colors cursor-pointer ${
          dragOver ? 'border-accent bg-accent/5' : 'border-border'
        }`}
      >
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileSelect} />
        {parsing ? (
          <>
            <Loader2 className="h-10 w-10 text-accent animate-spin mb-4" />
            <p className="text-sm text-foreground font-medium">Parsing…</p>
          </>
        ) : (
          <>
            <Calendar className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-sm text-foreground font-medium">Drop weekly snapshot file here</p>
            <p className="text-xs text-muted-foreground mt-1">or click to browse · .xlsx or .csv</p>
          </>
        )}
      </div>

      {/* Template hint */}
      <div className="metric-card text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Expected columns:</p>
        <p>Physician Name, Week Ending Date, Paid Members, Guidance Number, MER Touches, PA Touches, Doctor Calls, Weekly Needed, Notes, Strategic Activities, Strategy Changed</p>
        <p>Matching: physician_id (preferred) → physician name + state + opening date (fallback)</p>
      </div>

      {/* Success */}
      {committed && (
        <div className="metric-card border-status-ahead/30 bg-status-ahead/5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-status-ahead" />
            <p className="text-sm font-medium text-foreground">Snapshots imported successfully.</p>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-4">
          {/* File info */}
          <div className="metric-card">
            <div className="flex items-center gap-4 text-sm">
              <FileSpreadsheet className="h-5 w-5 text-accent shrink-0" />
              <div>
                <p className="text-foreground font-medium">{preview.fileName}</p>
                <p className="text-xs text-muted-foreground">{preview.totalRows} rows scanned</p>
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="metric-card text-center py-3 border-status-ahead/20">
              <p className="text-2xl font-bold text-status-ahead">{preview.matched.length}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-status-ahead" /> Matched
              </p>
            </div>
            <div className="metric-card text-center py-3 border-status-behind/20">
              <p className="text-2xl font-bold text-status-behind">{preview.unmatched.length}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <AlertTriangle className="h-3 w-3 text-status-behind" /> Unmatched
              </p>
            </div>
            <div className="metric-card text-center py-3 border-status-critical/20">
              <p className="text-2xl font-bold text-status-critical">{preview.errors.length}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <XCircle className="h-3 w-3 text-status-critical" /> Errors
              </p>
            </div>
          </div>

          {/* Matched snapshots table */}
          {preview.matched.length > 0 && (
            <div className="metric-card">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-status-ahead" /> Matched Snapshots ({preview.matched.length})
              </h3>
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Physician</th>
                      <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Week Ending</th>
                      <th className="text-right py-2 pr-3 text-muted-foreground font-medium">Paid</th>
                      <th className="text-right py-2 pr-3 text-muted-foreground font-medium">Guidance</th>
                      <th className="text-right py-2 pr-3 text-muted-foreground font-medium hidden sm:table-cell">MER</th>
                      <th className="text-left py-2 pr-3 text-muted-foreground font-medium hidden sm:table-cell">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.matched.slice(0, 25).map((m, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-1.5 pr-3 text-foreground truncate max-w-[120px]">{m.snapshot.physician_name}</td>
                        <td className="py-1.5 pr-3 text-foreground whitespace-nowrap">{m.snapshot.week_ending_date}</td>
                        <td className="py-1.5 pr-3 text-right text-foreground font-mono">{m.snapshot.paid_members}</td>
                        <td className="py-1.5 pr-3 text-right text-muted-foreground font-mono">{m.snapshot.guidance_number}</td>
                        <td className="py-1.5 pr-3 text-right text-muted-foreground font-mono hidden sm:table-cell">{m.snapshot.touches_mer_last_week}</td>
                        <td className="py-1.5 pr-3 text-muted-foreground truncate max-w-[150px] hidden sm:table-cell">{m.snapshot.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.matched.length > 25 && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">Showing first 25 of {preview.matched.length}</p>
                )}
              </div>
            </div>
          )}

          {/* Unmatched */}
          {preview.unmatched.length > 0 && (
            <div className="metric-card border-status-behind/20">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-status-behind" /> Unmatched Rows ({preview.unmatched.length})
              </h3>
              <p className="text-xs text-muted-foreground mb-3">These rows could not be matched to an active transition. They will be skipped.</p>
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Physician</th>
                      <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Week Ending</th>
                      <th className="text-left py-2 pr-3 text-muted-foreground font-medium hidden sm:table-cell">State</th>
                      <th className="text-left py-2 pr-3 text-muted-foreground font-medium hidden sm:table-cell">Opening Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.unmatched.slice(0, 10).map((s, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-1.5 pr-3 text-foreground">{s.physician_name}</td>
                        <td className="py-1.5 pr-3 text-foreground">{s.week_ending_date}</td>
                        <td className="py-1.5 pr-3 text-muted-foreground hidden sm:table-cell">{s.state ?? '—'}</td>
                        <td className="py-1.5 pr-3 text-muted-foreground hidden sm:table-cell">{s.opening_date ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Errors */}
          {preview.errors.length > 0 && (
            <div className="metric-card border-status-critical/20">
              <button onClick={() => setErrorsExpanded(!errorsExpanded)} className="flex items-center justify-between w-full text-left">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-status-critical" /> Parse Errors ({preview.errors.length})
                </h3>
                {errorsExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {errorsExpanded && (
                <div className="mt-3 space-y-1">
                  {preview.errors.map((err, i) => (
                    <p key={i} className="text-xs text-status-critical">Row {err.row}: {err.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          {!committed && (
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button onClick={handleCancel} disabled={committing} className="px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded transition-colors disabled:opacity-50 w-full sm:w-auto text-center">Cancel</button>
              {preview.matched.length > 0 && (
                <button onClick={handleConfirm} disabled={committing} className="flex items-center justify-center gap-2 px-6 py-2.5 bg-accent text-accent-foreground font-medium text-sm rounded hover:bg-accent/90 transition-colors disabled:opacity-50 w-full sm:w-auto">
                  {committing ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</> : <><Database className="h-4 w-4 shrink-0" /> Import {preview.matched.length} Snapshots</>}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!preview && !parsing && !committed && (
        <div className="metric-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Import Preview</h3>
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Upload an XLSX or CSV file with weekly snapshot data
          </div>
        </div>
      )}
    </div>
  );
}
