/**
 * Hook: self-sourced leads that are still waiting for a first text.
 *
 * Reads from `leads`, applies `isLeadAwaitingFirstText`, splits into
 *   - mine:   sourced_by_sa === currentSa
 *   - others: everyone else
 * Each list is sorted oldest-first so cold ones bubble up.
 *
 * Listens to:
 *   - Supabase realtime on `leads` (INSERT / UPDATE / DELETE)
 *   - DATA_CHANGED_EVENT for scopes ['leads', 'sa-leads']
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  isLeadAwaitingFirstText,
  type SourcedLeadRow,
} from '@/lib/sa/sourcedLeadsToText';
import {
  DATA_CHANGED_EVENT,
  type DataChangedDetail,
} from '@/lib/data/invalidation';

export interface UseSourcedLeadsToTextResult {
  mine: SourcedLeadRow[];
  others: SourcedLeadRow[];
  total: number;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useSourcedLeadsToText(currentSa: string | null | undefined): UseSourcedLeadsToTextResult {
  const [rows, setRows] = useState<SourcedLeadRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('id, first_name, last_name, phone, email, source, sourced_by_sa, booked_intro_id, text_archived_at, text_archived_reason, created_at')
      .not('sourced_by_sa', 'is', null)
      .is('booked_intro_id', null)
      .is('text_archived_at', null)
      .order('created_at', { ascending: true });
    if (!error && data) {
      setRows((data as SourcedLeadRow[]).filter(isLeadAwaitingFirstText));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('sourced-leads-to-text')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // Invalidation event bus
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<DataChangedDetail>).detail;
      const scopes = detail?.scopes;
      if (!scopes || scopes.some(s => ['leads', 'sa-leads'].includes(s))) {
        fetchData();
      }
    };
    window.addEventListener(DATA_CHANGED_EVENT, handler);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, handler);
  }, [fetchData]);

  const sa = (currentSa || '').trim().toLowerCase();
  const mine: SourcedLeadRow[] = [];
  const others: SourcedLeadRow[] = [];
  for (const r of rows) {
    const owner = (r.sourced_by_sa || '').trim().toLowerCase();
    if (sa && owner === sa) mine.push(r);
    else others.push(r);
  }

  return { mine, others, total: rows.length, loading, refetch: fetchData };
}
