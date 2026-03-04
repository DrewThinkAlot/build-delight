import * as XLSX from 'xlsx';

// ─── Interfaces ────────────────────────────────────────────────

export interface ParsedTransition {
  physician_name: string;
  physician_id: string | null;
  opening_date: string | null;
  fiscal_month: string | null;
  guidance_number: number;
  opening_balance: number;
  pct_to_guidance: number;
  hit_guidance: boolean;
  pre_survey_patients: number | null;
  pre_survey_over_55: number | null;
  post_survey_patients: number | null;
  wtc_55_plus: number | null;
  segmentation: string | null;
  coc_type: string | null;
  state: string | null;
  city: string | null;
  msrp_at_open: number | null;
  total_weeks: number | null;
  expected_yield: number | null;
  actual_yield: number | null;
  paid_members_current: number | null;
  post_open_growth: number | null;
  source_file: string;
  data_vintage: string; // YYYY-MM-DD
}

export interface UpdatedTransition {
  physician_name: string;
  opening_date: string | null;
  old_paid_members: number | null;
  new_paid_members: number | null;
  old_post_open_growth: number | null;
  new_post_open_growth: number | null;
  full_record: ParsedTransition;
}

export interface SkippedTransition {
  physician_name: string;
  opening_date: string | null;
  reason: 'unchanged' | 'duplicate';
}

export interface ParseError {
  row: number;
  physician_name: string | null;
  error: string;
}

export interface ImportPreview {
  fileName: string;
  sheetFound: boolean;
  sheetName: string | null;
  totalRows: number;
  guidedTransitions: number;
  filteredRows: number;
  newTransitions: ParsedTransition[];
  updatedTransitions: UpdatedTransition[];
  skippedTransitions: SkippedTransition[];
  errors: ParseError[];
}

// Existing DB record shape (subset needed for dedup)
export interface ExistingRecord {
  physician_name: string;
  opening_date: string | null;
  paid_members_current: number | null;
  post_open_growth: number | null;
}

// ─── Column mapping ────────────────────────────────────────────

const COLUMN_MAP: Record<string, string> = {
  'account name': 'physician_name',
  'physicianid': 'physician_id',
  'physician id': 'physician_id',
  'opening date': 'opening_date',
  'fiscal month': 'fiscal_month',
  'guidance number': 'guidance_number',
  'opening balance': 'opening_balance',
  'pre survey patients': 'pre_survey_patients',
  'pre survey over 55': 'pre_survey_over_55',
  'post survey patients': 'post_survey_patients',
  'wtc 55+': 'wtc_55_plus',
  'wtc 55 plus': 'wtc_55_plus',
  'segmentation': 'segmentation',
  'state': 'state',
  'city': 'city',
  'msrp @ open': 'msrp_at_open',
  'msrp at open': 'msrp_at_open',
  'total weeks in transition': 'total_weeks',
  'total weeks': 'total_weeks',
  'expected yield': 'expected_yield',
  'total yield': 'actual_yield',
  'actual yield': 'actual_yield',
  '# of paid members': 'paid_members_current',
  'paid members': 'paid_members_current',
  'number of paid members': 'paid_members_current',
};

const STRING_FIELDS = new Set(['physician_name', 'physician_id', 'fiscal_month', 'segmentation', 'state', 'city']);
const DATE_FIELDS = new Set(['opening_date']);
const NUMBER_FIELDS = new Set([
  'guidance_number', 'opening_balance', 'pre_survey_patients', 'pre_survey_over_55',
  'post_survey_patients', 'wtc_55_plus', 'msrp_at_open', 'total_weeks',
  'expected_yield', 'actual_yield', 'paid_members_current',
]);

// ─── Helpers ───────────────────────────────────────────────────

function findSheet(workbook: XLSX.WorkBook): string | null {
  const match = workbook.SheetNames.find(n => n.toLowerCase().includes('fytd open transitions'));
  if (match) return match;
  const partial = workbook.SheetNames.find(n => n.toLowerCase().includes('open transitions'));
  return partial ?? null;
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

function deriveCocType(seg: string | null): string | null {
  if (!seg) return null;
  return seg.toLowerCase().includes('coc in') ? 'COC In' : 'COC Out';
}

function dedupKey(name: string, date: string | null): string {
  return `${name.trim().toLowerCase()}|${(date ?? '').trim()}`;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Main parser ───────────────────────────────────────────────

export function parseTransitionXlsx(
  buffer: ArrayBuffer,
  fileName: string,
  existingRecords: ExistingRecord[] = []
): ImportPreview {
  const errors: ParseError[] = [];
  const result: ImportPreview = {
    fileName,
    sheetFound: false,
    sheetName: null,
    totalRows: 0,
    guidedTransitions: 0,
    filteredRows: 0,
    newTransitions: [],
    updatedTransitions: [],
    skippedTransitions: [],
    errors,
  };

  try {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    let sheetName = findSheet(workbook);

    if (sheetName) {
      result.sheetFound = true;
    } else {
      sheetName = workbook.SheetNames[0] ?? null;
      if (!sheetName) {
        errors.push({ row: 0, physician_name: null, error: 'No sheets found in workbook' });
        return result;
      }
      errors.push({ row: 0, physician_name: null, error: `Sheet "FYTD Open Transitions" not found. Using "${sheetName}".` });
    }
    result.sheetName = sheetName;

    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' }) as unknown[][];

    // Find header row
    let headerRowIdx = 8;
    for (let i = 0; i < Math.min(20, jsonData.length); i++) {
      const row = jsonData[i];
      if (row && row.some(cell => String(cell ?? '').toLowerCase().includes('account name'))) {
        headerRowIdx = i;
        break;
      }
    }

    const rawHeaders = jsonData[headerRowIdx] ?? [];
    const headers = rawHeaders.map(h => String(h ?? '').trim().toLowerCase());

    // Build column index map
    const colIndexMap: Record<number, string> = {};
    headers.forEach((header, idx) => {
      const mapped = COLUMN_MAP[header];
      if (mapped) colIndexMap[idx] = mapped;
    });

    if (!Object.values(colIndexMap).includes('physician_name')) {
      errors.push({ row: headerRowIdx + 1, physician_name: null, error: 'Could not find "Account Name" column.' });
      return result;
    }

    const dataRows = jsonData.slice(headerRowIdx + 1);
    result.totalRows = dataRows.length;

    // Build existing lookup
    const existingMap = new Map<string, ExistingRecord>();
    for (const rec of existingRecords) {
      existingMap.set(dedupKey(rec.physician_name, rec.opening_date), rec);
    }

    const dataVintage = todayISO();

    for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
      const row = dataRows[rowIdx];
      const excelRow = headerRowIdx + 2 + rowIdx; // 1-indexed excel row

      if (!row || row.every(c => c === null || c === undefined || c === '')) {
        result.filteredRows++;
        continue;
      }

      // Extract raw values
      const raw: Record<string, unknown> = {};
      for (const [idxStr, field] of Object.entries(colIndexMap)) {
        raw[field] = row[Number(idxStr)];
      }

      const physicianName = toStr(raw.physician_name);

      // Filter: empty / summary rows
      if (!physicianName) { result.filteredRows++; continue; }
      const nameLower = physicianName.toLowerCase();
      if (nameLower === 'totals' || nameLower === 'averages') { result.filteredRows++; continue; }

      // Parse fields
      const record: Record<string, unknown> = { physician_name: physicianName };
      for (const [field, val] of Object.entries(raw)) {
        if (field === 'physician_name') continue;
        if (STRING_FIELDS.has(field)) record[field] = toStr(val);
        else if (DATE_FIELDS.has(field)) record[field] = parseDate(val);
        else if (NUMBER_FIELDS.has(field)) record[field] = toNumber(val);
      }

      // Filter: guidance_number must be > 0
      const guidanceNumber = toNumber(raw.guidance_number);
      if (guidanceNumber === null || guidanceNumber <= 0) {
        result.filteredRows++;
        continue;
      }

      // Filter: opening_balance must be numeric
      const openingBalance = toNumber(raw.opening_balance);
      if (openingBalance === null) {
        result.filteredRows++;
        continue;
      }

      result.guidedTransitions++;

      // Calculated fields
      const pctToGuidance = Math.round((openingBalance / guidanceNumber) * 10000) / 10000;
      const paidMembersCurrent = toNumber(raw.paid_members_current);
      const postOpenGrowth = paidMembersCurrent != null ? paidMembersCurrent - openingBalance : null;

      const parsed: ParsedTransition = {
        physician_name: physicianName,
        physician_id: (record.physician_id as string | null) ?? null,
        opening_date: (record.opening_date as string | null) ?? null,
        fiscal_month: (record.fiscal_month as string | null) ?? null,
        guidance_number: guidanceNumber,
        opening_balance: openingBalance,
        pct_to_guidance: pctToGuidance,
        hit_guidance: pctToGuidance >= 0.80,
        pre_survey_patients: (record.pre_survey_patients as number | null) ?? null,
        pre_survey_over_55: (record.pre_survey_over_55 as number | null) ?? null,
        post_survey_patients: (record.post_survey_patients as number | null) ?? null,
        wtc_55_plus: (record.wtc_55_plus as number | null) ?? null,
        segmentation: (record.segmentation as string | null) ?? null,
        coc_type: deriveCocType((record.segmentation as string | null) ?? null),
        state: (record.state as string | null) ?? null,
        city: (record.city as string | null) ?? null,
        msrp_at_open: (record.msrp_at_open as number | null) ?? null,
        total_weeks: (record.total_weeks as number | null) ?? null,
        expected_yield: (record.expected_yield as number | null) ?? null,
        actual_yield: (record.actual_yield as number | null) ?? null,
        paid_members_current: paidMembersCurrent,
        post_open_growth: postOpenGrowth,
        source_file: fileName,
        data_vintage: dataVintage,
      };

      // Deduplication
      const key = dedupKey(physicianName, parsed.opening_date);
      const existing = existingMap.get(key);

      if (existing) {
        const membersChanged = existing.paid_members_current !== paidMembersCurrent;
        const growthChanged = existing.post_open_growth !== postOpenGrowth;
        if (membersChanged || growthChanged) {
          result.updatedTransitions.push({
            physician_name: physicianName,
            opening_date: parsed.opening_date,
            old_paid_members: existing.paid_members_current,
            new_paid_members: paidMembersCurrent,
            old_post_open_growth: existing.post_open_growth,
            new_post_open_growth: postOpenGrowth,
            full_record: parsed,
          });
        } else {
          result.skippedTransitions.push({
            physician_name: physicianName,
            opening_date: parsed.opening_date,
            reason: 'unchanged',
          });
        }
      } else {
        result.newTransitions.push(parsed);
      }
    }

    return result;
  } catch (err) {
    errors.push({ row: 0, physician_name: null, error: `Parse error: ${err instanceof Error ? err.message : String(err)}` });
    return result;
  }
}
