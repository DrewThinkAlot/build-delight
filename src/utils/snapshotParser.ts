import * as XLSX from 'xlsx';

// ── Snapshot-specific types ──────────────────────────────────────────

export interface ParsedSnapshot {
  physician_name: string;
  physician_id: string | null;
  week_ending_date: string;
  paid_members: number;
  guidance_number: number;
  touches_mer_last_week: number;
  touches_pa_last_week: number | null;
  doctor_calls_last_week: number | null;
  weekly_needed_to_hit_guidance: number | null;
  strategic_activities: string | null;
  notes: string | null;
  strategy_changed: boolean;
  state: string | null;
  opening_date: string | null;
}

export interface SnapshotImportPreview {
  fileName: string;
  totalRows: number;
  matched: { snapshot: ParsedSnapshot; transitionId: string }[];
  unmatched: ParsedSnapshot[];
  errors: { row: number; error: string }[];
}

// Column aliases for snapshot fields
const SNAPSHOT_ALIASES: Record<string, string[]> = {
  physician_name: ['physician name', 'account name', 'doctor name', 'provider name'],
  physician_id: ['physician id', 'physicianid', 'provider id'],
  week_ending_date: ['week ending', 'week ending date', 'week end', 'week_ending_date'],
  paid_members: ['paid members', '# of paid members', 'paid', 'current paid', 'current paid members'],
  guidance_number: ['guidance', 'guidance number', 'gd', 'guidance #'],
  touches_mer_last_week: ['mer touches', 'touches', 'mer', 'touches_mer', 'outreach touches'],
  touches_pa_last_week: ['pa touches', 'touches_pa', 'pa outreach'],
  doctor_calls_last_week: ['doctor calls', 'dr calls', 'physician calls', 'personal calls'],
  weekly_needed_to_hit_guidance: ['weekly needed', 'needed per week', 'weekly target'],
  strategic_activities: ['strategic activities', 'activities', 'strategic'],
  notes: ['notes', 'comments', 'observations'],
  strategy_changed: ['strategy changed', 'strategy_changed', 'pivot'],
  state: ['state', 'st'],
  opening_date: ['opening date', 'open date'],
};

const SNAPSHOT_ALIAS_LOOKUP = new Map<string, string>();
for (const [field, aliases] of Object.entries(SNAPSHOT_ALIASES)) {
  for (const alias of aliases) {
    SNAPSHOT_ALIAS_LOOKUP.set(alias.toLowerCase().trim(), field);
  }
}

function matchSnapshotHeader(raw: string): string | null {
  const clean = raw.toLowerCase().trim().replace(/\s+/g, ' ');
  const exact = SNAPSHOT_ALIAS_LOOKUP.get(clean);
  if (exact) return exact;
  for (const [alias, field] of SNAPSHOT_ALIAS_LOOKUP.entries()) {
    if (clean.includes(alias) || alias.includes(clean)) return field;
  }
  return null;
}

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function toStr(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null;
  return String(val).trim();
}

function parseDate(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const d = new Date(String(val));
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return String(val).trim();
}

interface MatchableTransition {
  id: string;
  physician_name: string;
  physician_id?: string;
  state?: string;
  opening_date: string;
}

function matchTransition(
  row: ParsedSnapshot,
  transitions: MatchableTransition[],
): string | null {
  // First: physician_id match
  if (row.physician_id) {
    const match = transitions.find(t => t.physician_id === row.physician_id);
    if (match) return match.id;
  }
  // Fallback: name + state + opening_date
  const nameLower = row.physician_name.toLowerCase().trim();
  const match = transitions.find(t => {
    const tName = t.physician_name.toLowerCase().trim();
    const nameMatch = tName === nameLower || tName.includes(nameLower) || nameLower.includes(tName);
    const stateMatch = !row.state || !t.state || row.state.toLowerCase() === t.state.toLowerCase();
    const dateMatch = !row.opening_date || !t.opening_date || row.opening_date === t.opening_date;
    return nameMatch && stateMatch && dateMatch;
  });
  return match?.id ?? null;
}

/**
 * Parse XLSX or CSV buffer for weekly snapshots.
 */
export function parseSnapshotFile(
  buffer: ArrayBuffer,
  fileName: string,
  transitions: MatchableTransition[],
): SnapshotImportPreview {
  const errors: { row: number; error: string }[] = [];
  const result: SnapshotImportPreview = {
    fileName,
    totalRows: 0,
    matched: [],
    unmatched: [],
    errors,
  };

  try {
    const isCSV = fileName.toLowerCase().endsWith('.csv');
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, ...(isCSV ? { raw: true } : {}) });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      errors.push({ row: 0, error: 'No sheets found' });
      return result;
    }

    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' }) as unknown[][];

    // Find header row
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(10, jsonData.length); i++) {
      const row = jsonData[i];
      if (row?.some(cell => {
        const s = String(cell ?? '').toLowerCase().trim();
        return s.includes('physician') || s.includes('account') || s.includes('week ending');
      })) {
        headerRowIdx = i;
        break;
      }
    }

    const rawHeaders = jsonData[headerRowIdx] ?? [];
    const headers = rawHeaders.map(h => String(h ?? '').trim());
    const colIndexMap: Record<number, string> = {};
    headers.forEach((header, idx) => {
      const mapped = matchSnapshotHeader(header);
      if (mapped) colIndexMap[idx] = mapped;
    });

    if (!Object.values(colIndexMap).includes('physician_name')) {
      errors.push({ row: headerRowIdx + 1, error: 'Could not find physician name column' });
      return result;
    }
    if (!Object.values(colIndexMap).includes('week_ending_date')) {
      errors.push({ row: headerRowIdx + 1, error: 'Could not find week ending date column' });
      return result;
    }

    const dataRows = jsonData.slice(headerRowIdx + 1);
    result.totalRows = dataRows.length;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const excelRow = headerRowIdx + 2 + i;
      if (!row || row.every(c => c === null || c === undefined || c === '')) continue;

      const raw: Record<string, unknown> = {};
      for (const [idxStr, field] of Object.entries(colIndexMap)) {
        raw[field] = row[Number(idxStr)];
      }

      const name = toStr(raw.physician_name);
      if (!name) continue;

      const weekDate = parseDate(raw.week_ending_date);
      if (!weekDate) {
        errors.push({ row: excelRow, error: `Invalid week ending date for ${name}` });
        continue;
      }

      const paidMembers = toNumber(raw.paid_members);
      if (paidMembers === null) {
        errors.push({ row: excelRow, error: `Missing paid members for ${name}` });
        continue;
      }

      const guidanceNum = toNumber(raw.guidance_number);

      const snapshot: ParsedSnapshot = {
        physician_name: name,
        physician_id: toStr(raw.physician_id),
        week_ending_date: weekDate,
        paid_members: paidMembers,
        guidance_number: guidanceNum ?? 0,
        touches_mer_last_week: toNumber(raw.touches_mer_last_week) ?? 0,
        touches_pa_last_week: toNumber(raw.touches_pa_last_week),
        doctor_calls_last_week: toNumber(raw.doctor_calls_last_week),
        weekly_needed_to_hit_guidance: toNumber(raw.weekly_needed_to_hit_guidance),
        strategic_activities: toStr(raw.strategic_activities),
        notes: toStr(raw.notes),
        strategy_changed: String(raw.strategy_changed ?? '').toLowerCase() === 'true' || String(raw.strategy_changed ?? '') === '1',
        state: toStr(raw.state),
        opening_date: parseDate(raw.opening_date),
      };

      const transitionId = matchTransition(snapshot, transitions);
      if (transitionId) {
        result.matched.push({ snapshot, transitionId });
      } else {
        result.unmatched.push(snapshot);
      }
    }

    return result;
  } catch (err) {
    errors.push({ row: 0, error: `Parse error: ${err instanceof Error ? err.message : String(err)}` });
    return result;
  }
}
