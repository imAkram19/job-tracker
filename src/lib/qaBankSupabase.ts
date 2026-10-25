import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface QaBankRecord {
  id?: string;
  question_key: string;
  label?: string;
  field_type?: string;
  selected_value: string;
  metadata?: Record<string, any>;
  updated_at?: string;
}

/**
 * Normalizes question string into a stable unique key
 */
export function normalizeQuestionKey(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 100);
}

/**
 * Saves or updates a Q&A record in Supabase application_qa_bank table.
 * If the table does not exist or network fails, logs a gentle warning without breaking automation.
 */
export async function saveQaBankRecord(
  question: string,
  selectedValue: string,
  fieldType?: string,
  metadata?: Record<string, any>
): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) {
    return false;
  }

  const questionKey = normalizeQuestionKey(question);

  try {
    const { error } = await supabase
      .from('application_qa_bank')
      .upsert(
        {
          question_key: questionKey,
          label: question.trim(),
          field_type: fieldType || 'text',
          selected_value: selectedValue.trim(),
          metadata: metadata || {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'question_key' }
      );

    if (error) {
      // PGRST205 indicates table does not exist yet; safe to ignore
      if (error.code !== 'PGRST205') {
        console.warn('Supabase QA bank sync notice:', error.message);
      }
      return false;
    }

    return true;
  } catch (err) {
    // Non-blocking catch
    return false;
  }
}

/**
 * Fetches all QA bank records from Supabase
 */
export async function loadQaBankRecords(): Promise<Record<string, string>> {
  if (!supabase || !isSupabaseConfigured) {
    return {};
  }

  try {
    const { data, error } = await supabase
      .from('application_qa_bank')
      .select('question_key, selected_value')
      .limit(500);

    if (error || !data) {
      return {};
    }

    const map: Record<string, string> = {};
    for (const row of data) {
      if (row.question_key && row.selected_value) {
        map[row.question_key] = row.selected_value;
      }
    }
    return map;
  } catch {
    return {};
  }
}
