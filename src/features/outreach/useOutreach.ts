/**
 * Outreach Lists data hooks — one list feature reusable across any campaign.
 * Follows the app's existing realtime pattern (see useRealtimeMyDay,
 * BingoAdminPage) so any teammate sees live status updates on a list.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OutreachList {
  id: string;
  name: string;
  campaign_tag: string;
  active: boolean;
  created_by: string;
  created_at: string;
}

export interface OutreachRow {
  id: string;
  list_id: string;
  client_name: string;
  email: string | null;
  phone: string | null;
  item: string | null;
  amount: number | null;
  worked_out_30d: boolean | null;
  last_30d_count: number | null;
  latest_workout_date: string | null;
  is_churning: boolean;
  churn_date: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface OutreachAction {
  id: string;
  row_id: string;
  list_id: string;
  action_type: 'texted' | 'in_person' | 'save_attempt' | 'not_interested';
  done_by: string;
  done_at: string;
  notes: string | null;
}

export function useOutreachLists() {
  const [lists, setLists] = useState<OutreachList[]>([]);
  const [actionCounts, setActionCounts] = useState<Record<string, { touched: number; total: number }>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: ls } = await (supabase as any)
      .from('outreach_lists')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });
    const listsRows = (ls as OutreachList[]) || [];
    setLists(listsRows);

    if (listsRows.length > 0) {
      const ids = listsRows.map(l => l.id);
      const { data: rowsData } = await (supabase as any)
        .from('outreach_list_rows')
        .select('id, list_id')
        .in('list_id', ids);
      const { data: actData } = await (supabase as any)
        .from('outreach_row_actions')
        .select('row_id, list_id')
        .in('list_id', ids);
      const byList: Record<string, { total: number; touched: Set<string> }> = {};
      (rowsData as any[] || []).forEach(r => {
        if (!byList[r.list_id]) byList[r.list_id] = { total: 0, touched: new Set() };
        byList[r.list_id].total += 1;
      });
      (actData as any[] || []).forEach(a => {
        if (!byList[a.list_id]) byList[a.list_id] = { total: 0, touched: new Set() };
        byList[a.list_id].touched.add(a.row_id);
      });
      const counts: Record<string, { touched: number; total: number }> = {};
      Object.entries(byList).forEach(([k, v]) => counts[k] = { touched: v.touched.size, total: v.total });
      setActionCounts(counts);
    } else {
      setActionCounts({});
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel('outreach-lists-index')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outreach_lists' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outreach_row_actions' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  return { lists, actionCounts, loading, refetch: load };
}

export function useOutreachListDetail(listId: string | undefined) {
  const [list, setList] = useState<OutreachList | null>(null);
  const [rows, setRows] = useState<OutreachRow[]>([]);
  const [actions, setActions] = useState<OutreachAction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!listId) return;
    setLoading(true);
    const [{ data: l }, { data: r }, { data: a }] = await Promise.all([
      (supabase as any).from('outreach_lists').select('*').eq('id', listId).maybeSingle(),
      (supabase as any).from('outreach_list_rows').select('*').eq('list_id', listId).order('client_name'),
      (supabase as any).from('outreach_row_actions').select('*').eq('list_id', listId).order('done_at', { ascending: false }),
    ]);
    setList((l as OutreachList) || null);
    setRows((r as OutreachRow[]) || []);
    setActions((a as OutreachAction[]) || []);
    setLoading(false);
  }, [listId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!listId) return;
    const ch = supabase
      .channel(`outreach-list-${listId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outreach_list_rows', filter: `list_id=eq.${listId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outreach_row_actions', filter: `list_id=eq.${listId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [listId, load]);

  return { list, rows, actions, loading, refetch: load };
}
