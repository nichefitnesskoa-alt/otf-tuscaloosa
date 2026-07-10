/**
 * Hook: per-SA self-generated leads booked count for a date range.
 * Reads from canonical helper in @/lib/sa/leadsBooked.
 *
 * Date field: intros_booked.created_at (treated as the moment the lead was booked).
 * Week buckets: Monday-start America/Chicago — bucketing is done by consumers
 *               from the returned bookings list when needed.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  aggregateLeadsBookedBySa,
  type LeadBookedBookingInput,
  type VipSessionLite,
} from '@/lib/sa/leadsBooked';
import { DATA_CHANGED_EVENT, type DataChangedDetail } from '@/lib/data/invalidation';

export interface SaLeadsBookedRow {
  sa: string;
  count: number;
  bookings: LeadBookedBookingInput[];
}

export interface UseSaLeadsBookedResult {
  rows: SaLeadsBookedRow[];
  total: number;
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * @param rangeStart YYYY-MM-DD (inclusive) — bookings with created_at >= this date 00:00 CT
 * @param rangeEnd   YYYY-MM-DD (inclusive) — bookings with created_at <= this date 23:59 CT
 */
export function useSaLeadsBooked(rangeStart: string, rangeEnd: string): UseSaLeadsBookedResult {
  const [rows, setRows] = useState<SaLeadsBookedRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    // Convert YYYY-MM-DD CT to ISO bounds with a safety pad. We pad ±1 day to
    // avoid CT/UTC edge slip; aggregation is strict-by-CT-day via the helper.
    const startIso = new Date(`${rangeStart}T00:00:00-06:00`).toISOString();
    const endIso = new Date(`${rangeEnd}T23:59:59-05:00`).toISOString();

    const { data: bookings } = await supabase
      .from('intros_booked')
      .select('id, lead_source, booked_by, vip_session_id, created_at, deleted_at, ignore_from_metrics, member_name, originating_booking_id')
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .is('deleted_at', null);

    const rawBookings = ((bookings as any[]) || []) as (LeadBookedBookingInput & { originating_booking_id: string | null })[];

    // Inherit booked_by from a soft-deleted parent when a rebook lost the
    // attribution — keeps the sourcing SA credited across delete+rebook.
    const parentIds = Array.from(new Set(
      rawBookings.map(b => b.originating_booking_id).filter((x): x is string => !!x),
    ));
    const parentMap = new Map<string, { deleted_at: string | null; booked_by: string | null }>();
    if (parentIds.length) {
      const { data: parents } = await supabase
        .from('intros_booked')
        .select('id, deleted_at, booked_by')
        .in('id', parentIds);
      ((parents as any[]) || []).forEach(p =>
        parentMap.set(p.id, { deleted_at: p.deleted_at ?? null, booked_by: p.booked_by ?? null }),
      );
    }

    const bookingList: LeadBookedBookingInput[] = rawBookings.map(b => {
      if (b.booked_by && b.booked_by.trim()) return b;
      const parent = b.originating_booking_id ? parentMap.get(b.originating_booking_id) : null;
      if (parent?.deleted_at && parent.booked_by) {
        return { ...b, booked_by: parent.booked_by };
      }
      return b;
    });

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

    const agg = aggregateLeadsBookedBySa(bookingList, sessions);
    const rowsOut: SaLeadsBookedRow[] = Array.from(agg.entries())
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
        ['intros_booked', 'vip_sessions', 'sa-leads-booked'].includes(s),
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
