/**
 * Hook: per-SA SELF-SOURCED leads count for a date range (CST, Monday-start
 * window passed in). Counts every person an SA personally sourced,
 * whether they've booked yet or not.
 *
 * Sources counted:
 *   1. `leads` rows where `sourced_by_sa` is set AND `source` passes
 *      `isSelfSourcedLeadSource` (matches the canonical predicate used by
 *      the booked-SGL path so the two stay coherent).
 *   2. `intros_booked` rows where the source passes the same predicate but
 *      no `leads` row is linked to that booking via `booked_intro_id` — this
 *      covers historical/auto-imported SGL bookings that never got a leads
 *      row tagged with sourced_by_sa. Without this, the Leads count would
 *      understate the true number of self-sourced people.
 *
 * A person who appears in both (lead row → booked) counts ONCE; the lead
 * row wins because it carries the sourced_by_sa attribution.
 *
 * Date field: `leads.created_at` for lead rows, `intros_booked.created_at`
 * for unlinked SGL bookings.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  isSelfSourcedLeadSource,
  getLeadBookedCreditSa,
  PHANTOM_BOOKED_BY,
  type LeadBookedBookingInput,
  type VipSessionLite,
} from '@/lib/sa/leadsBooked';
import { DATA_CHANGED_EVENT, type DataChangedDetail } from '@/lib/data/invalidation';

export interface SaLeadPersonRow {
  /** Stable key for drill-down lists. */
  id: string;
  name: string;
  source: string | null;
  created_at: string;
  /** True if this person has converted to a booked intro. */
  booked: boolean;
  /** Linked booking id when `booked` is true, for journey navigation. */
  booking_id: string | null;
}

export interface SaLeadsRow {
  sa: string;
  count: number;
  people: SaLeadPersonRow[];
}

export interface UseSaLeadsResult {
  rows: SaLeadsRow[];
  total: number;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useSaLeads(rangeStart: string, rangeEnd: string): UseSaLeadsResult {
  const [rows, setRows] = useState<SaLeadsRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const startIso = new Date(`${rangeStart}T00:00:00-06:00`).toISOString();
    const endIso = new Date(`${rangeEnd}T23:59:59-05:00`).toISOString();

    // ── 1) Sourced lead rows ────────────────────────────────────────────────
    const { data: leadRows } = await supabase
      .from('leads')
      .select('id, first_name, last_name, source, sourced_by_sa, created_at, booked_intro_id')
      .not('sourced_by_sa', 'is', null)
      .gte('created_at', startIso)
      .lte('created_at', endIso);

    const leads = (leadRows || []).filter(l => isSelfSourcedLeadSource(l.source));
    const linkedBookingIds = new Set(
      leads.map(l => l.booked_intro_id).filter((x): x is string => !!x),
    );

    // ── 2) SGL bookings whose booking_id is NOT already represented by a lead row
    const { data: sglBookings } = await supabase
      .from('intros_booked')
      .select('id, lead_source, booked_by, vip_session_id, created_at, deleted_at, ignore_from_metrics, member_name, originating_booking_id')
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .is('deleted_at', null);

    const candidateBookings = (sglBookings as (LeadBookedBookingInput & { originating_booking_id: string | null })[] | null || [])
      .filter(b => !b.ignore_from_metrics)
      // Child bookings (rebook / 2nd intro for an already-sourced person)
      // never add a NEW self-sourced lead — the originating booking already
      // represents that person.
      .filter(b => !b.originating_booking_id)
      .filter(b => isSelfSourcedLeadSource(b.lead_source))
      .filter(b => !linkedBookingIds.has(b.id));

    const sessionIds = Array.from(new Set(
      candidateBookings.map(b => b.vip_session_id).filter((x): x is string => !!x),
    ));
    let sessions: VipSessionLite[] = [];
    if (sessionIds.length) {
      const { data: sess } = await supabase
        .from('vip_sessions')
        .select('id, sa_setup_name')
        .in('id', sessionIds);
      sessions = ((sess as any[]) || []).map(s => ({ id: s.id, sa_setup_name: s.sa_setup_name ?? null }));
    }
    const sessionMap = new Map(sessions.map(s => [s.id, s]));

    // ── Aggregate ─────────────────────────────────────────────────────────
    const out = new Map<string, SaLeadsRow>();
    const push = (sa: string, person: SaLeadPersonRow) => {
      const cur = out.get(sa) || { sa, count: 0, people: [] };
      cur.count += 1;
      cur.people.push(person);
      out.set(sa, cur);
    };

    for (const l of leads) {
      const sa = (l.sourced_by_sa || '').trim();
      if (!sa || PHANTOM_BOOKED_BY.has(sa)) continue;
      push(sa, {
        id: `lead-${l.id}`,
        name: `${l.first_name || ''} ${l.last_name || ''}`.trim() || 'Unknown',
        source: l.source,
        created_at: l.created_at,
        booked: !!l.booked_intro_id,
        booking_id: l.booked_intro_id,
      });
    }

    for (const b of candidateBookings) {
      const sa = getLeadBookedCreditSa(b, sessionMap);
      if (!sa) continue;
      push(sa, {
        id: `bk-${b.id}`,
        name: b.member_name || 'Unknown',
        source: b.lead_source,
        created_at: b.created_at,
        booked: true,
        booking_id: b.id,
      });
    }

    const rowsOut = Array.from(out.values())
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
        ['leads', 'intros_booked', 'vip_sessions', 'sa-leads', 'sa-leads-booked'].includes(s),
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
