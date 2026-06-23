/**
 * Hook: self-sourced leads in a date range (Central Time).
 *
 * Canonical definition: a row in `leads` where `sourced_by_sa` is set to a
 * real SA (not a PHANTOM_BOOKED_BY value). created_at falls within the
 * provided [start, end] window (CST day boundaries supplied by caller).
 *
 * Reused by SourcedLeadsDialog. Same predicate as the SA Leaderboard's
 * "Sourced" column → counts always agree.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PHANTOM_BOOKED_BY } from '@/lib/sa/leadsBooked';
import type { SourcedLeadCsvRow } from '@/lib/sa/sourcedLeadsCsv';

export interface UseSourcedLeadsInRangeResult {
  rows: SourcedLeadCsvRow[];
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useSourcedLeadsInRange(
  startIso: string | null,
  endIso: string | null,
): UseSourcedLeadsInRangeResult {
  const [rows, setRows] = useState<SourcedLeadCsvRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('leads')
      .select('id, first_name, last_name, phone, email, source, sourced_by_sa, booked_intro_id, text_archived_at, text_archived_reason, stage, created_at')
      .not('sourced_by_sa', 'is', null)
      .order('created_at', { ascending: false });
    if (startIso) q = q.gte('created_at', startIso);
    if (endIso) q = q.lte('created_at', endIso);
    const { data, error } = await q;
    if (!error && data) {
      const filtered = (data as SourcedLeadCsvRow[]).filter(
        r => r.sourced_by_sa && !PHANTOM_BOOKED_BY.has(r.sourced_by_sa),
      );
      setRows(filtered);
    } else {
      setRows([]);
    }
    setLoading(false);
  }, [startIso, endIso]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { rows, loading, refetch: fetchData };
}
