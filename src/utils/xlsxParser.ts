import * as XLSX from 'xlsx';

export interface HistoricalTransition {
  physician_name: string;
  physician_id: string | null;
  opening_date: string | null;
  fiscal_month: string | null;
  guidance_number: number | null;
  opening_balance: number | null;
  pct_to_guidance: number | null;
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
}

export type ImportAction = 'new' | 'updated' | 'skipped';

export interface ImportRow {
  record: HistoricalTransition;
  action: ImportAction;
}

export interface ParseResult {
  success: boolean;
  rows: ImportRow[];
  errors: string[];
  sheetName: string | null;
  totalRows: number;
  filteredRows: number;
  newCount: number;
  updatedCount: number;
  skippedCount: number;
}

function dedupKey(name: string, date: string | null): string {
  return `${name.trim().toLowerCase()}|${(date ?? '').trim()}`;
}

// Column name mapping — keys are lowercased/trimmed spreadsheet headers
const COLUMN_MAP: Record<string, keyof HistoricalTransition> = {
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

function findSheet(workbook: XLSX.WorkBook): string | null {
  const target = 'fytd open transitions';
  // Exact-ish match first
  const match = workbook.SheetNames.find(
    (name) => name.toLowerCase().includes(target)
  );
  if (match) return match;
  // Fallback: partial match on "open transitions"
  const partial = workbook.SheetNames.find(
    (name) => name.toLowerCase().includes('open transitions')
  );
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
  // SheetJS may return a JS Date or a serial number
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      const month = String(d.m).padStart(2, '0');
      const day = String(d.d).padStart(2, '0');
      return `${d.y}-${month}-${day}`;
    }
  }
  // Try string parse
  const d = new Date(String(val));
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return String(val).trim();
}

function deriveCocType(segmentation: string | null): string | null {
  if (!segmentation) return null;
  return segmentation.toLowerCase().includes('coc in') ? 'COC In' : 'COC Out';
}

export function parseTransitionXlsx(
  buffer: ArrayBuffer,
  existingRecords: HistoricalTransition[] = []
): ParseResult {
  const errors: string[] = [];
  let sheetName: string | null = null;

  try {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    sheetName = findSheet(workbook);

    if (!sheetName) {
      // Fallback: use first sheet
      sheetName = workbook.SheetNames[0] ?? null;
    if (!sheetName) {
      return { success: false, rows: [], errors: ['No sheets found in workbook'], sheetName: null, totalRows: 0, filteredRows: 0, newCount: 0, updatedCount: 0, skippedCount: 0 };
    }
      errors.push(`Sheet "FYTD Open Transitions" not found. Using "${sheetName}" instead.`);
    }

    const sheet = workbook.Sheets[sheetName];

    // Try header at row 9 (0-indexed 8), then row 1 as fallback
    const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' }) as unknown[][];

    // Find header row — look for a row containing "Account Name" (case-insensitive)
    let headerRowIdx = 8; // default row 9
    for (let i = 0; i < Math.min(20, jsonData.length); i++) {
      const row = jsonData[i] as unknown[];
      if (row && row.some((cell) => String(cell ?? '').toLowerCase().includes('account name'))) {
        headerRowIdx = i;
        break;
      }
    }

    const rawHeaders = (jsonData[headerRowIdx] as unknown[]) ?? [];
    const headers = rawHeaders.map((h) => String(h ?? '').trim().toLowerCase());

    // Build column index map
    const colIndexMap: Record<number, keyof HistoricalTransition> = {};
    headers.forEach((header, idx) => {
      const mapped = COLUMN_MAP[header];
      if (mapped) {
        colIndexMap[idx] = mapped;
      }
    });

    if (!Object.values(colIndexMap).includes('physician_name')) {
      errors.push('Could not find "Account Name" column. Check file format.');
      return { success: false, rows: [], errors, sheetName, totalRows: 0, filteredRows: 0, newCount: 0, updatedCount: 0, skippedCount: 0 };
    }

    // Build lookup of existing records for dedup
    const existingMap = new Map<string, HistoricalTransition>();
    for (const rec of existingRecords) {
      existingMap.set(dedupKey(rec.physician_name, rec.opening_date), rec);
    }

    const dataRows = jsonData.slice(headerRowIdx + 1) as unknown[][];
    const results: ImportRow[] = [];
    let filteredRows = 0;
    let newCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const row of dataRows) {
      if (!row || row.every((c) => c === null || c === undefined || c === '')) {
        filteredRows++;
        continue;
      }

      const record: Partial<HistoricalTransition> = {};

      for (const [idxStr, field] of Object.entries(colIndexMap)) {
        const idx = Number(idxStr);
        const val = row[idx];

        switch (field) {
          case 'physician_name':
          case 'physician_id':
          case 'fiscal_month':
          case 'segmentation':
          case 'state':
          case 'city':
            record[field] = toStr(val);
            break;
          case 'opening_date':
            record[field] = parseDate(val);
            break;
          case 'guidance_number':
          case 'opening_balance':
          case 'pre_survey_patients':
          case 'pre_survey_over_55':
          case 'post_survey_patients':
          case 'wtc_55_plus':
          case 'msrp_at_open':
          case 'total_weeks':
          case 'expected_yield':
          case 'actual_yield':
          case 'paid_members_current':
            record[field] = toNumber(val);
            break;
          default:
            break;
        }
      }

      // Filter rules
      const name = (record.physician_name ?? '').toLowerCase();
      if (!record.physician_name || name === 'totals' || name === 'averages') {
        filteredRows++;
        continue;
      }
      if (record.guidance_number == null || record.guidance_number <= 0) {
        filteredRows++;
        continue;
      }
      if (record.opening_balance == null) {
        filteredRows++;
        continue;
      }

      // Calculated fields
      const guidance = record.guidance_number ?? 0;
      const opening = record.opening_balance ?? 0;
      record.pct_to_guidance = guidance > 0 ? Math.round((opening / guidance) * 10000) / 10000 : null;
      record.hit_guidance = (record.pct_to_guidance ?? 0) >= 0.80;
      record.coc_type = deriveCocType(record.segmentation ?? null);
      record.post_open_growth =
        record.paid_members_current != null && record.opening_balance != null
          ? record.paid_members_current - record.opening_balance
          : null;

      const final = record as HistoricalTransition;

      // Deduplication
      const key = dedupKey(final.physician_name, final.opening_date);
      const existing = existingMap.get(key);

      if (existing) {
        const membersChanged = existing.paid_members_current !== final.paid_members_current;
        const growthChanged = existing.post_open_growth !== final.post_open_growth;
        if (membersChanged || growthChanged) {
          results.push({ record: final, action: 'updated' });
          updatedCount++;
        } else {
          results.push({ record: final, action: 'skipped' });
          skippedCount++;
        }
      } else {
        results.push({ record: final, action: 'new' });
        newCount++;
      }
    }

    return {
      success: true,
      rows: results,
      errors,
      sheetName,
      totalRows: dataRows.length,
      filteredRows,
      newCount,
      updatedCount,
      skippedCount,
    };
  } catch (err) {
    errors.push(`Parse error: ${err instanceof Error ? err.message : String(err)}`);
    return { success: false, data: [], errors, sheetName, totalRows: 0, skippedRows: 0 };
  }
}
