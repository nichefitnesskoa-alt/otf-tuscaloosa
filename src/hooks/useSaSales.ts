/**
 * Hook: per-SA sales count for a date range (close-week bucketed, CST).
 * Reads from canonical helpers in @/lib/sa/salesBooked.
 *
 * Date field: getRunSaleDate(run) = buy_date > run_date > created_at.
 * Week buckets: Monday-start America/Chicago — bucketing done by helper.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  aggregateSalesBySa,
  type SaSaleRunInput,
  type SaSaleBookingLite,
} from '@/lib/sa/salesBooked';
import { SALE_CANONS } from '@/lib/sales-detection';
import { DATA_CHANGED_EVENT, type DataChangedDetail } from '@/lib/data/invalidation';

export interface SaSalesRow {
  sa: string;
  count: number;
  runs: Array<{ run: SaSaleRunInput; member: string | null; closeYMD: string }>;
}

export interface UseSaSalesResult {
  rows: SaSalesRow[];
  total: number;
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * @param rangeStart YYYY-MM-DD (inclusive, CST) — close-date lower bound
 * @param rangeEnd   YYYY-MM-DD (inclusive, CST) — close-date upper bound
 */
export function useSaSales(rangeStart: string, rangeEnd: string): UseSaSalesResult {
  const [rows, setRows] = useState<SaSalesRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const saleCanonArr = Array.from(SALE_CANONS);

    // Pad ±1 day on the SQL window then strict-filter by close-day in CST via helper.
    // We fetch by buy_date OR run_date OR created_at being inside the padded window,
    // which means we just pull a generous superset and let the helper bucket.
    // Simpler: filter on result_canon IN sale-set, fetch all sale rows in a reasonable
    // window (1 year), then bucket strictly in the aggregator. To keep payload small
    // we use an OR over the three date fields against a padded window.
    const padStart = shiftYMD(rangeStart, -2);
    const padEnd = shiftYMD(rangeEnd, 2);
    const startIso = `${padStart}T00:00:00-06:00`;
    const endIso = `${padEnd}T23:59:59-05:00`;

    const { data: runs } = await supabase
      .from('intros_run')
      .select('id, result_canon, result, buy_date, run_date, created_at, linked_intro_booked_id, ignore_from_metrics')
      .in('result_canon', saleCanonArr)
      .or([
        `buy_date.gte.${padStart},buy_date.lte.${padEnd}`,
        // fallback: if no buy_date, run_date in window
        `and(buy_date.is.null,run_date.gte.${padStart},run_date.lte.${padEnd})`,
        // fallback: if neither, created_at in window
        `and(buy_date.is.null,run_date.is.null,created_at.gte.${startIso},created_at.lte.${endIso})`,
      ].join(','));

    const runList = (runs as SaSaleRunInput[] | null) || [];
    const bookingIds = Array.from(
      new Set(runList.map(r => r.linked_intro_booked_id).filter((x): x is string => !!x)),
    );

    let bookings: SaSaleBookingLite[] = [];
    if (bookingIds.length) {
      const { data: bks } = await supabase
        .from('intros_booked')
        .select('id, intro_owner, member_name')
        .in('id', bookingIds);
      bookings = ((bks as any[]) || []).map(b => ({
        id: b.id,
        intro_owner: b.intro_owner ?? null,
        member_name: b.member_name ?? null,
      }));
    }

    const agg = aggregateSalesBySa(runList, bookings, rangeStart, rangeEnd);
    const rowsOut: SaSalesRow[] = Array.from(agg.entries())
      .map(([sa, v]) => ({ sa, count: v.count, runs: v.runs }))
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
        ['intros_run', 'intros_booked', 'sa-sales'].includes(s),
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

function shiftYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
