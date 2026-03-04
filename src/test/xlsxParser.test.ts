import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseTransitionXlsx } from '@/utils/xlsxParser';

function makeWorkbook(headers: string[], rows: unknown[][], sheetName = 'FYTD Open Transitions'): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

describe('parseTransitionXlsx', () => {
  const HEADERS = ['Account Name', 'Opening Date', 'Guidance Number', 'Opening Balance', 'State', '# of Paid Members'];

  it('parses valid rows as new transitions', () => {
    const buffer = makeWorkbook(HEADERS, [
      ['Dr. Smith', '2026-01-15', 200, 180, 'TX', 190],
    ]);
    const result = parseTransitionXlsx(buffer, 'test.xlsx', []);
    expect(result.newTransitions).toHaveLength(1);
    expect(result.newTransitions[0].physician_name).toBe('Dr. Smith');
    expect(result.newTransitions[0].guidance_number).toBe(200);
    expect(result.newTransitions[0].pct_to_guidance).toBeCloseTo(0.9, 1);
    expect(result.newTransitions[0].hit_guidance).toBe(true);
  });

  it('filters rows with zero guidance', () => {
    const buffer = makeWorkbook(HEADERS, [
      ['Dr. Zero', '2026-01-15', 0, 0, 'TX', 0],
    ]);
    const result = parseTransitionXlsx(buffer, 'test.xlsx', []);
    expect(result.newTransitions).toHaveLength(0);
    expect(result.filteredRows).toBe(1);
  });

  it('filters summary rows (Totals, Averages)', () => {
    const buffer = makeWorkbook(HEADERS, [
      ['Totals', '', 500, 400, '', 450],
      ['Averages', '', 250, 200, '', 225],
    ]);
    const result = parseTransitionXlsx(buffer, 'test.xlsx', []);
    expect(result.newTransitions).toHaveLength(0);
    expect(result.filteredRows).toBe(2);
  });

  it('detects updated records via dedup', () => {
    const existing = [{ physician_name: 'Dr. Smith', opening_date: '2026-01-15', paid_members_current: 100, post_open_growth: null }];
    const buffer = makeWorkbook(HEADERS, [
      ['Dr. Smith', '2026-01-15', 200, 180, 'TX', 190],
    ]);
    const result = parseTransitionXlsx(buffer, 'test.xlsx', existing);
    expect(result.newTransitions).toHaveLength(0);
    expect(result.updatedTransitions).toHaveLength(1);
    expect(result.updatedTransitions[0].new_paid_members).toBe(190);
  });

  it('skips unchanged records', () => {
    const existing = [{ physician_name: 'Dr. Smith', opening_date: '2026-01-15', paid_members_current: 190, post_open_growth: 10 }];
    const buffer = makeWorkbook(HEADERS, [
      ['Dr. Smith', '2026-01-15', 200, 180, 'TX', 190],
    ]);
    const result = parseTransitionXlsx(buffer, 'test.xlsx', existing);
    expect(result.skippedTransitions).toHaveLength(1);
  });

  it('handles alternate header names', () => {
    const altHeaders = ['Physician Name', 'Open Date', 'Guidance', 'Opening #', 'St', 'Paid Members'];
    const buffer = makeWorkbook(altHeaders, [
      ['Dr. Alt', '2026-02-01', 150, 120, 'CA', 130],
    ]);
    const result = parseTransitionXlsx(buffer, 'test.xlsx', []);
    expect(result.newTransitions).toHaveLength(1);
    expect(result.newTransitions[0].physician_name).toBe('Dr. Alt');
  });

  it('falls back to first sheet when named sheet not found', () => {
    const buffer = makeWorkbook(HEADERS, [
      ['Dr. Fallback', '2026-01-15', 200, 180, 'TX', 190],
    ], 'RandomSheet');
    const result = parseTransitionXlsx(buffer, 'test.xlsx', []);
    expect(result.sheetFound).toBe(false);
    expect(result.newTransitions).toHaveLength(1);
    expect(result.errors.length).toBeGreaterThan(0); // warning about missing sheet
  });
});
