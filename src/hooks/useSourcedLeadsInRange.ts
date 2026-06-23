/**
 * Hook: SA-generated records in a date range.
 *
 * UNION of two sources (Plan B — "every record an SA was responsible for"):
 *   1. `leads` rows where `sourced_by_sa` is a real SA (not phantom).
 *   2. `intros_booked` rows where `booked_by` is a real SA, not deleted,
 *      and lead_source qualifies as self-sourced (see EXCLUDED_LEAD_SOURCES).
 *
 * Dedup: last-10 phone digits. If a leads row exists for that phone, it
 * wins (and the auto-link trigger means it already carries the booked state
 * via booked_intro_id). The booking-derived synthetic row is dropped.
 *
 * Synthetic rows from bookings get id="booking:<bookingId>" and
 * source_type='booking' so the UI can render them as "already in Mindbody".
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PHANTOM_BOOKED_BY, EXCLUDED_LEAD_SOURCES } from '@/lib/sa/leadsBooked';
import type { SourcedLeadCsvRow } from '@/lib/sa/sourcedLeadsCsv';

export interface UseSourcedLeadsInRangeResult {
  rows: SourcedLeadCsvRow[];
  loading: boolean;
  refetch: () => Promise<void>;
  /**
   * Optimistic local update — used by the import checkbox so the UI flips
   * without waiting for a refetch.
   */
  patchRow: (id: string, patch: Partial<SourcedLeadCsvRow>) => void;
}

function last10(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

function splitName(full: string | null | undefined): { first: string; last: string } {
  const s = (full || '').trim();
  if (!s) return { first: '', last: '' };
  const i = s.indexOf(' ');
  if (i < 0) return { first: s, last: '' };
  return { first: s.slice(0, i), last: s.slice(i + 1).trim() };
}

export function useSourcedLeadsInRange(
  startIso: string | null,
  endIso: string | null,
): UseSourcedLeadsInRangeResult {
  const [rows, setRows] = useState<SourcedLeadCsvRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);

    // --- 1. leads ---
    let leadsQ = supabase
      .from('leads')
      .select('id, first_name, last_name, phone, email, source, sourced_by_sa, booked_intro_id, text_archived_at, text_archived_reason, stage, created_at, mindbody_imported_at, mindbody_imported_by')
      .not('sourced_by_sa', 'is', null)
      .order('created_at', { ascending: false });
    if (startIso) leadsQ = leadsQ.gte('created_at', startIso);
    if (endIso) leadsQ = leadsQ.lte('created_at', endIso);

    // --- 2. intros_booked (SA-booked, alive, not OIO/Lead-Management) ---
    let bookingsQ = supabase
      .from('intros_booked')
      .select('id, member_name, phone, email, booked_by, lead_source, created_at')
      .not('booked_by', 'is', null)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (startIso) bookingsQ = bookingsQ.gte('created_at', startIso);
    if (endIso) bookingsQ = bookingsQ.lte('created_at', endIso);

    const [leadsRes, bookingsRes] = await Promise.all([leadsQ, bookingsQ]);

    const leadRows: SourcedLeadCsvRow[] = (leadsRes.data || [])
      .filter((r: any) => r.sourced_by_sa && !PHANTOM_BOOKED_BY.has(r.sourced_by_sa))
      .map((r: any) => ({
        id: r.id,
        first_name: r.first_name,
        last_name: r.last_name,
        phone: r.phone,
        email: r.email,
        source: r.source,
        sourced_by_sa: r.sourced_by_sa,
        booked_intro_id: r.booked_intro_id,
        text_archived_at: r.text_archived_at,
        text_archived_reason: r.text_archived_reason,
        stage: r.stage,
        created_at: r.created_at,
        mindbody_imported_at: r.mindbody_imported_at,
        mindbody_imported_by: r.mindbody_imported_by,
        source_type: 'lead',
      }));

    // Phones already represented by a lead — skip any booking with same last-10.
    const seen = new Set<string>();
    for (const l of leadRows) {
      const k = last10(l.phone);
      if (k) seen.add(k);
    }

    const bookingRows: SourcedLeadCsvRow[] = (bookingsRes.data || [])
      .filter((b: any) => {
        const sa = (b.booked_by || '').trim();
        if (!sa || PHANTOM_BOOKED_BY.has(sa)) return false;
        // Mirror EXCLUDED_LEAD_SOURCES from leadsBooked.ts (self-sourced predicate).
        if (!b.lead_source || EXCLUDED_LEAD_SOURCES.has(b.lead_source)) return false;
        const k = last10(b.phone);
        if (k && seen.has(k)) return false;
        if (k) seen.add(k);
        return true;
      })
      .map((b: any) => {
        const { first, last } = splitName(b.member_name);
        return {
          id: `booking:${b.id}`,
          first_name: first,
          last_name: last,
          phone: b.phone || '',
          email: b.email,
          source: b.lead_source,
          sourced_by_sa: (b.booked_by || '').trim(),
          booked_intro_id: b.id, // booking IS the booking
          text_archived_at: null,
          text_archived_reason: null,
          stage: 'booked',
          created_at: b.created_at,
          mindbody_imported_at: null,
          mindbody_imported_by: null,
          source_type: 'booking' as const,
        };
      });

    const merged = [...leadRows, ...bookingRows]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    setRows(merged);
    setLoading(false);
  }, [startIso, endIso]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const patchRow = useCallback((id: string, patch: Partial<SourcedLeadCsvRow>) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  return { rows, loading, refetch: fetchData, patchRow };
}
