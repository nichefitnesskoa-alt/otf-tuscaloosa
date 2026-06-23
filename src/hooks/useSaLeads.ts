/**
 * Hook: per-SA SELF-SOURCED leads count for a date range (CST, Monday-start
 * window passed in). Counts every person an SA personally sourced,
 * whether they've booked yet or not.
 *
 * Sources counted:
 *   1. `leads` rows where `sourced_by_sa` is set AND `source` passes
 *      `isSelfSourcedLeadSource`.
 *   2. `intros_booked` rows where the source passes the same predicate but
 *      no `leads` row is linked to that booking via `booked_intro_id`.
 *   3. `vip_registrations` rows (is_group_contact=false) attributed to the
 *      `vip_sessions.sa_setup_name` of the linked session. Credits the SA
 *      who set up the VIP class for every attendee they sourced, even
 *      before any of them book a 1:1 intro. Dedup: if registration.booking_id
 *      is set, the booking path already counts that person — skip.
 *
 * A person who appears in multiple sources counts ONCE.
 *
 * Date field: `leads.created_at`, `intros_booked.created_at`,
 * `vip_registrations.created_at`.
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
  /** Stable key for drill-down lists. Prefix indicates source:
   *   lead-{id} — leads row
   *   bk-{id}   — intros_booked row (no separate leads row)
   *   vip-{id}  — vip_registrations row (unbooked) */
  id: string;
  name: string;
  source: string | null;
  created_at: string;
  /** True if this person has converted to a booked intro. */
  booked: boolean;
  /** Linked booking id when `booked` is true, for journey navigation. */
  booking_id: string | null;
  /** Contact phone (when available) — surfaced for the sourced-leads explorer. */
  phone: string | null;
  /** Contact email (when available) — surfaced for the sourced-leads explorer. */
  email: string | null;
  /** Manual "imported to Mindbody" mark. Booked rows are implicitly imported
   *  regardless of these fields. Lives on leads.* or vip_registrations.*. */
  mindbody_imported_at: string | null;
  mindbody_imported_by: string | null;
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
      .select('id, first_name, last_name, phone, source, sourced_by_sa, created_at, booked_intro_id, mindbody_imported_at, mindbody_imported_by')
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
      .select('id, lead_source, booked_by, vip_session_id, created_at, deleted_at, ignore_from_metrics, member_name, originating_booking_id, phone')
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
        phone: l.phone ?? null,
        mindbody_imported_at: (l as any).mindbody_imported_at ?? null,
        mindbody_imported_by: (l as any).mindbody_imported_by ?? null,
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
        phone: (b as any).phone ?? null,
        mindbody_imported_at: null,
        mindbody_imported_by: null,
      });
    }

    // ── 3) VIP registrants → credit SA who set up the VIP class ───────────
    const { data: regRows } = await supabase
      .from('vip_registrations')
      .select('id, first_name, last_name, phone, vip_session_id, booking_id, is_group_contact, created_at, mindbody_imported_at, mindbody_imported_by')
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .eq('is_group_contact', false)
      .is('booking_id', null) // booked attendees counted via candidateBookings
      .not('vip_session_id', 'is', null);

    const regSessionIds = Array.from(new Set(
      ((regRows as any[]) || []).map(r => r.vip_session_id).filter((x): x is string => !!x),
    ));
    const regSessionMap = new Map<string, VipSessionLite>();
    if (regSessionIds.length) {
      // Reuse already-fetched sessions when overlap; fetch any missing.
      const missing = regSessionIds.filter(id => !sessionMap.has(id));
      if (missing.length) {
        const { data: more } = await supabase
          .from('vip_sessions')
          .select('id, sa_setup_name')
          .in('id', missing);
        ((more as any[]) || []).forEach(s =>
          regSessionMap.set(s.id, { id: s.id, sa_setup_name: s.sa_setup_name ?? null }),
        );
      }
      sessionMap.forEach((v, k) => { if (regSessionIds.includes(k)) regSessionMap.set(k, v); });
    }

    for (const r of (regRows as any[]) || []) {
      const sess = regSessionMap.get(r.vip_session_id);
      const sa = sess?.sa_setup_name?.trim() || null;
      if (!sa || PHANTOM_BOOKED_BY.has(sa)) continue;
      const name = `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'VIP guest';
      push(sa, {
        id: `vip-${r.id}`,
        name,
        source: 'VIP Class (Registrant)',
        created_at: r.created_at,
        booked: false,
        booking_id: null,
        phone: r.phone ?? null,
        mindbody_imported_at: r.mindbody_imported_at ?? null,
        mindbody_imported_by: r.mindbody_imported_by ?? null,
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
        ['leads', 'intros_booked', 'vip_sessions', 'vip_registrations', 'sa-leads', 'sa-leads-booked'].includes(s),
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

import { notifyDataChanged } from '@/lib/data/invalidation';

/**
 * Admin remove: drops a row from the SA's self-sourced count without
 * deleting the underlying record.
 *
 * Row id format from useSaLeads:
 *   - "lead-{uuid}"  → unattribute from SA (leads.sourced_by_sa = NULL)
 *   - "bk-{uuid}"    → exclude booking from metrics (ignore_from_metrics = true)
 *   - "vip-{uuid}"   → unlink VIP registration from its session (vip_session_id = NULL)
 */
export async function removeSelfSourcedRow(rowId: string): Promise<void> {
  if (rowId.startsWith('lead-')) {
    const id = rowId.slice('lead-'.length);
    const { error } = await supabase
      .from('leads')
      .update({ sourced_by_sa: null })
      .eq('id', id);
    if (error) throw error;
  } else if (rowId.startsWith('bk-')) {
    const id = rowId.slice('bk-'.length);
    const { error } = await supabase
      .from('intros_booked')
      .update({ ignore_from_metrics: true })
      .eq('id', id);
    if (error) throw error;
  } else if (rowId.startsWith('vip-')) {
    const id = rowId.slice('vip-'.length);
    const { error } = await (supabase as any)
      .from('vip_registrations')
      .update({ vip_session_id: null })
      .eq('id', id);
    if (error) throw error;
  } else {
    throw new Error(`Unknown self-sourced row id: ${rowId}`);
  }
  notifyDataChanged(
    ['leads', 'intros_booked', 'vip_registrations', 'sa-leads', 'sa-leads-booked'],
    'remove-self-sourced-row',
  );
}

