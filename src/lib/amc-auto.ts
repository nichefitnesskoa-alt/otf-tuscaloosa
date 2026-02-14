import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

/**
 * Auto-increment AMC by 1 for each sale.
 * Creates a new amc_log entry with value = latest + 1.
 */
export async function incrementAmcOnSale(
  personName: string,
  membershipType: string,
  createdBy: string,
): Promise<void> {
  try {
    const currentValue = await getLatestAmcValue();
    if (currentValue === null) return; // No AMC history yet, skip

    const today = format(new Date(), 'yyyy-MM-dd');
    await supabase.from('amc_log').insert({
      logged_date: today,
      amc_value: currentValue + 1,
      note: `Auto: ${personName} purchased ${membershipType}`,
      created_by: createdBy,
    });
  } catch (err) {
    console.error('AMC auto-increment failed:', err);
  }
}

/**
 * Auto-decrement AMC when churn takes effect (effective_date = today).
 * Called from churn form and on page load to catch past-due churn.
 */
export async function decrementAmcOnChurn(
  churnCount: number,
  note: string,
  createdBy: string,
  logDate?: string,
): Promise<void> {
  try {
    const currentValue = await getLatestAmcValue();
    if (currentValue === null) return;

    const today = logDate || format(new Date(), 'yyyy-MM-dd');
    await supabase.from('amc_log').insert({
      logged_date: today,
      amc_value: currentValue - churnCount,
      note: note || `Auto: Churn logged (${churnCount} members)`,
      created_by: createdBy,
    });
  } catch (err) {
    console.error('AMC auto-decrement failed:', err);
  }
}

/**
 * On page load, check for churn_log entries with effective_date <= today
 * that haven't been reflected in amc_log yet (no matching auto-churn note for that date).
 */
export async function processEffectiveChurn(): Promise<void> {
  try {
    const today = format(new Date(), 'yyyy-MM-dd');

    // Get churn entries effective today or earlier that might not be processed
    const { data: churnEntries } = await supabase
      .from('churn_log')
      .select('id, churn_count, effective_date, created_by')
      .lte('effective_date', today)
      .order('effective_date', { ascending: true });

    if (!churnEntries || churnEntries.length === 0) return;

    // Check which churn entries already have a corresponding amc_log auto-decrement
    const { data: amcEntries } = await supabase
      .from('amc_log')
      .select('note')
      .like('note', 'Auto: Churn%');

    const processedNotes = new Set((amcEntries || []).map(e => e.note));

    for (const churn of churnEntries) {
      const expectedNote = `Auto: Churn logged (${churn.churn_count} members) [${churn.id.substring(0, 8)}]`;
      if (!processedNotes.has(expectedNote)) {
        await decrementAmcOnChurn(
          churn.churn_count,
          expectedNote,
          churn.created_by || 'System',
          churn.effective_date,
        );
      }
    }
  } catch (err) {
    console.error('processEffectiveChurn error:', err);
  }
}

async function getLatestAmcValue(): Promise<number | null> {
  const { data } = await supabase
    .from('amc_log')
    .select('amc_value')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.amc_value ?? null;
}
