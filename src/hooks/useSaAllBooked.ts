/**
 * Hook: per-SA ALL booked intros (inbound + self-sourced) for a date range.
 * Backs the "Booked" column on the SA Leaderboard.
 *
 * Mirrors `useSaLeadsBooked` exactly except it uses `aggregateAllBookedBySa`
 * (no source-exclusion), so inbound bookings (Lead Management, Online Intro
 * Offer self-booked) are included.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  aggregateAllBookedBySa,
  type LeadBookedBookingInput,
  type VipSessionLite,
} from '@/lib/sa/leadsBooked';
import { DATA_CHANGED_EVENT, type DataChangedDetail } from '@/lib/data/invalidation';

export interface SaAllBookedRow {
  sa: string;
  count: number;
  bookings: LeadBookedBookingInput[];
}

export interface UseSaAllBookedResult {
  rows: SaAllBookedRow[];
  total: number;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useSaAllBooked(rangeStart: string, rangeEnd: string): UseSaAllBookedResult {
  const [rows, setRows] = useState<SaAllBookedRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const startIso = new Date(`${rangeStart}T00:00:00-06:00`).toISOString();
    const endIso = new Date(`${rangeEnd}T23:59:59-05:00`).toISOString();

    const { data: bookings } = await supabase
      .from('intros_booked')
      .select('id, lead_source, booked_by, vip_session_id, created_at, deleted_at, ignore_from_metrics, member_name')
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .is('deleted_at', null);

    const bookingList = (bookings as LeadBookedBookingInput[] | null) || [];
    const sessionIds = Array.from(
      new Set(bookingList.map(b => b.vip_session_id).filter((x): x is string => !!x)),
    );

    let sessions: VipSessionLite[] = [];
    if (sessionIds.length) {
      const { data: sess } = await supabase
        .from('vip_sessions')
        .select('id, sa_setup_name')
        .in('id', sessionIds);
      sessions = ((sess as any[]) || []).map(s => ({ id: s.id, sa_setup_name: s.sa_setup_name ?? null }));
    }

    const agg = aggregateAllBookedBySa(bookingList, sessions);
    const rowsOut: SaAllBookedRow[] = Array.from(agg.entries())
      .map(([sa, v]) => ({ sa, count: v.count, bookings: v.bookings }))
      .sort((a, b) => b.count - a.count || a.sa.localeCompare(b.sa));
    setRows(rowsOut);
    setLoading(false);
  }, [rangeStart, rangeEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<DataChangedDetail>).detail;
      const scopes = detail?.scopes;
      if (!scopes || scopes.some(s =>
        ['intros_booked', 'vip_sessions', 'sa-leads-booked', 'sa-all-booked'].includes(s),
      )) {
        fetchData();
      }
    };
    window.addEventListener(DATA_CHANGED_EVENT, handler);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, handler);
  }, [fetchData]);

  const total = rows.reduce((s, r) => s + r.count, 0);
  return { rows, total, loading, refetch: fetchData };
}
