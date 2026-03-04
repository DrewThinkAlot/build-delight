import { supabase } from '@/integrations/supabase/client';
import type { ImportPreview, ParsedTransition } from '@/utils/xlsxParser';

export interface ConfirmResult {
  success: boolean;
  inserted: number;
  updated: number;
  importLogId: string | null;
  errors: string[];
}

export async function confirmImport(preview: ImportPreview): Promise<ConfirmResult> {
  const errors: string[] = [];
  let inserted = 0;
  let updated = 0;
  let importLogId: string | null = null;

  try {
    // 1. INSERT new transitions
    if (preview.newTransitions.length > 0) {
      // Batch in chunks of 100
      const chunks = chunkArray(preview.newTransitions, 100);
      for (const chunk of chunks) {
        const rows = chunk.map(toDbRow);
        const { error } = await supabase
          .from('historical_transitions')
          .insert(rows);
        if (error) {
          errors.push(`Insert error: ${error.message}`);
        } else {
          inserted += chunk.length;
        }
      }
    }

    // 2. UPDATE changed transitions
    for (const upd of preview.updatedTransitions) {
      const { error } = await supabase
        .from('historical_transitions')
        .update({
          paid_members_current: upd.new_paid_members,
          post_open_growth: upd.new_post_open_growth,
          source_file: upd.full_record.source_file,
          data_vintage: upd.full_record.data_vintage,
          updated_at: new Date().toISOString(),
        })
        .eq('physician_name', upd.physician_name)
        .eq('opening_date', upd.opening_date ?? '');

      if (error) {
        errors.push(`Update error for ${upd.physician_name}: ${error.message}`);
      } else {
        updated++;
      }
    }

    // 3. Log the import
    const { data: logData, error: logError } = await supabase
      .from('data_imports')
      .insert({
        file_name: preview.fileName,
        sheet_name: preview.sheetName,
        total_rows: preview.totalRows,
        new_count: inserted,
        updated_count: updated,
        skipped_count: preview.skippedTransitions.length,
        error_count: preview.errors.length + errors.length,
      })
      .select('id')
      .single();

    if (logError) {
      errors.push(`Import log error: ${logError.message}`);
    } else {
      importLogId = logData?.id ?? null;
    }

    return { success: errors.length === 0, inserted, updated, importLogId, errors };
  } catch (err) {
    errors.push(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    return { success: false, inserted, updated, importLogId, errors };
  }
}

function toDbRow(t: ParsedTransition) {
  return {
    physician_name: t.physician_name,
    physician_id: t.physician_id,
    opening_date: t.opening_date,
    fiscal_month: t.fiscal_month,
    guidance_number: t.guidance_number,
    opening_balance: t.opening_balance,
    pct_to_guidance: t.pct_to_guidance,
    hit_guidance: t.hit_guidance,
    pre_survey_patients: t.pre_survey_patients,
    pre_survey_over_55: t.pre_survey_over_55,
    post_survey_patients: t.post_survey_patients,
    wtc_55_plus: t.wtc_55_plus,
    segmentation: t.segmentation,
    coc_type: t.coc_type,
    state: t.state,
    city: t.city,
    msrp_at_open: t.msrp_at_open,
    total_weeks: t.total_weeks,
    expected_yield: t.expected_yield,
    actual_yield: t.actual_yield,
    paid_members_current: t.paid_members_current,
    post_open_growth: t.post_open_growth,
    source_file: t.source_file,
    data_vintage: t.data_vintage,
  };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function fetchExistingRecords() {
  const all: { physician_name: string; opening_date: string | null; paid_members_current: number | null; post_open_growth: number | null }[] = [];
  let from = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('historical_transitions')
      .select('physician_name, opening_date, paid_members_current, post_open_growth')
      .range(from, from + pageSize - 1);
    
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  
  return all;
}
