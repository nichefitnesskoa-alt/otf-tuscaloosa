/**
 * CANONICAL constraint metrics — speed to lead, booking rate, show rate.
 *
 * One helper. Every surface (MyDay Shift Scoreboard, WIG constraint tile row,
 * Close-Out confirmation) reads from HERE and only here. Do NOT reimplement
 * any of these inline.
 *
 * NOTE FROM derivedBookedTarget: `useTrailingConversion` also exposes a
 * `showRate` but on a fixed 60-day trailing window, used for TARGET PLANNING
 * (deriving Booked Intros target from projected sales). It is intentionally
 * a different window than the constraint scoreboard's show rate. Do NOT
 * "unify" these later by accident — planning and scoreboarding are distinct.
 *
 * All times America/Chicago. Weeks start Monday. Local date parsing only —
 * never `new Date(YYYY-MM-DD-string)` (that shifts by TZ).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { didIntroActuallyRun } from '@/lib/canon/introRules';
import { getNowCentral } from '@/lib/dateUtils';

export type ConstraintRange = { start: Date; end: Date };

/**
 * Activity types that count as a real first contact for speed-to-lead.
 * Union of every path in the app that actually contacts a lead:
 *  - explicit action loggers (call/text/dm/email/script_sent)
 *  - the "contacted" quick action on the lead card
 *  - stage_change rows that MyDay writes when marking contacted
 *
 * If a new contact path is added, add it here — do not compute contact
 * membership inline anywhere else.
 */
export const CONTACT_ACTIVITY_TYPES = new Set([
  'contacted', 'call', 'text', 'dm', 'email', 'script_sent',
]);

export function isContactActivity(a: {
  activity_type?: string | null;
  notes?: string | null;
  new_stage?: string | null;
}): boolean {
  const t = (a.activity_type || '').toLowerCase();
  if (CONTACT_ACTIVITY_TYPES.has(t)) return true;
  if (t === 'stage_change') {
    if ((a.new_stage || '').toLowerCase() === 'contacted') return true;
    if ((a.notes || '').toLowerCase().startsWith('marked contacted')) return true;
  }
  return false;
}

/** Monday-anchored week start for a given Central-time reference date. */
export function weekStartCentral(ref: Date = getNowCentral()): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
  const dow = d.getDay(); // 0 = Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

/** End of the same week (Sunday 23:59:59.999) for the given week start. */
export function weekEndCentral(weekStart: Date): Date {
  const e = new Date(weekStart);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

/** Today [00:00, 23:59:59.999] in Central time. */
export function todayRangeCentral(): ConstraintRange {
  const now = getNowCentral();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
}

/** Current week Mon–Sun in Central time. */
export function thisWeekRangeCentral(): ConstraintRange {
  const start = weekStartCentral();
  return { start, end: weekEndCentral(start) };
}

// ─────────────────────────────────────────────────────────────
// Pure computations — testable, no I/O
// ─────────────────────────────────────────────────────────────

export type LeadRow = {
  id: string;
  created_at: string;
  sourced_by_sa?: string | null;
  booked_intro_id?: string | null;
  stage?: string | null;
};

export type ActivityRow = {
  lead_id: string;
  activity_type: string | null;
  new_stage?: string | null;
  notes?: string | null;
  created_at: string;
  performed_by?: string | null;
};

/**
 * Median minutes from lead created_at → first contact activity.
 * Leads without any contact are EXCLUDED (they'd bias toward infinity;
 * the "% booked" and per-lead running timer already show them).
 * Returns null if no contacted leads in the cohort.
 */
export function computeSpeedToLeadMedianMin(
  leads: LeadRow[],
  activities: ActivityRow[],
): number | null {
  const firstContact = new Map<string, number>();
  for (const a of activities) {
    if (!isContactActivity(a)) continue;
    const t = new Date(a.created_at).getTime();
    const prev = firstContact.get(a.lead_id);
    if (prev === undefined || t < prev) firstContact.set(a.lead_id, t);
  }
  const diffs: number[] = [];
  for (const l of leads) {
    const first = firstContact.get(l.id);
    if (first === undefined) continue;
    const created = new Date(l.created_at).getTime();
    const min = (first - created) / 60000;
    if (min < 0) continue;
    diffs.push(min);
  }
  if (!diffs.length) return null;
  diffs.sort((a, b) => a - b);
  const mid = Math.floor(diffs.length / 2);
  return diffs.length % 2 ? diffs[mid] : (diffs[mid - 1] + diffs[mid]) / 2;
}

/**
 * Booking rate: of leads with created_at in [range], percent whose
 * booked_intro_id is set NOW (ever-booked-as-of-now). A lead created
 * Monday but booked Friday counts toward Monday's cohort — the scoreboard
 * rewards working the cohort, not gaming the window.
 */
export function computeBookingRate(leads: LeadRow[]): { pct: number | null; booked: number; total: number } {
  const total = leads.length;
  if (!total) return { pct: null, booked: 0, total: 0 };
  const booked = leads.filter(l => !!l.booked_intro_id || l.stage === 'booked' || l.stage === 'won').length;
  return { pct: (booked / total) * 100, booked, total };
}

/**
 * Show rate: of intros_booked with class_date in [range], percent whose
 * linked intros_run passes `didIntroActuallyRun`. Uses the existing
 * canonical run predicate — do not invent a new one.
 */
export function computeShowRate(
  bookings: { id: string; class_date: string | null; booking_status_canon?: string | null; deleted_at?: string | null; booking_type_canon?: string | null }[],
  runs: any[],
  range: ConstraintRange,
): { pct: number | null; shown: number; total: number } {
  const runsByBookingId = new Map<string, any[]>();
  for (const r of runs) {
    const id = (r as any).linked_intro_booked_id;
    if (!id) continue;
    const arr = runsByBookingId.get(id) || [];
    arr.push(r);
    runsByBookingId.set(id, arr);
  }
  const inRange = bookings.filter(b => {
    if (b.deleted_at) return false;
    if ((b.booking_type_canon || 'STANDARD') !== 'STANDARD') return false;
    if (b.booking_status_canon === 'CANCELLED' || b.booking_status_canon === 'DELETED_SOFT' || b.booking_status_canon === 'PLANNING_RESCHEDULE') return false;
    if (!b.class_date) return false;
    const [y, m, d] = b.class_date.split('-').map(Number);
    if (!y || !m || !d) return false;
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    return dt >= range.start && dt <= range.end;
  });
  const total = inRange.length;
  if (!total) return { pct: null, shown: 0, total: 0 };
  let shown = 0;
  for (const b of inRange) {
    const rr = runsByBookingId.get(b.id) || [];
    if (rr.some(r => didIntroActuallyRun(r))) shown++;
  }
  return { pct: (shown / total) * 100, shown, total };
}

// ─────────────────────────────────────────────────────────────
// React Query hook — fetches raw rows and computes
// ─────────────────────────────────────────────────────────────

export type ConstraintMetrics = {
  speedMedianMin: number | null;
  booking: { pct: number | null; booked: number; total: number };
  show: { pct: number | null; shown: number; total: number };
};

/**
 * Query keys emitted:
 *   ['constraint', 'metrics', saName|'studio', startISO, endISO]
 * Invalidate with notifyDataChanged(['constraint']) after any contact/booking
 * write (see src/lib/data/invalidation.ts).
 */
export function useConstraintMetrics(range: ConstraintRange, saName?: string | null) {
  const startISO = range.start.toISOString();
  const endISO = range.end.toISOString();
  return useQuery<ConstraintMetrics>({
    queryKey: ['constraint', 'metrics', saName || 'studio', startISO, endISO],
    queryFn: async () => {
      let leadsQ: any = supabase
        .from('leads')
        .select('id, created_at, sourced_by_sa, booked_intro_id, stage')
        .gte('created_at', startISO).lte('created_at', endISO);
      if (saName) leadsQ = leadsQ.eq('sourced_by_sa', saName);
      const { data: leads } = (await leadsQ) as { data: LeadRow[] | null };
      const leadIds = (leads || []).map((l: LeadRow) => l.id);

      const activities = leadIds.length
        ? (await supabase.from('lead_activities')
            .select('lead_id, activity_type, notes, new_stage, created_at, performed_by')
            .in('lead_id', leadIds)).data || []
        : [];

      // Bookings for show rate — filter by class_date range
      const startDate = fmtYMD(range.start);
      const endDate = fmtYMD(range.end);
      const bookedQ = supabase
        .from('intros_booked')
        .select('id, class_date, booking_status_canon, deleted_at, booking_type_canon, sa_working_shift, booked_by')
        .gte('class_date', startDate).lte('class_date', endDate);
      const { data: bookings } = await bookedQ;
      let bookingsScoped = bookings || [];
      if (saName) {
        bookingsScoped = bookingsScoped.filter(b =>
          (b as any).sa_working_shift === saName || (b as any).booked_by === saName
        );
      }

      const bookingIds = bookingsScoped.map(b => b.id);
      const runs = bookingIds.length
        ? (await supabase.from('intros_run')
            .select('linked_intro_booked_id, result, result_canon')
            .in('linked_intro_booked_id', bookingIds)).data || []
        : [];

      return {
        speedMedianMin: computeSpeedToLeadMedianMin(leads || [], activities as any),
        booking: computeBookingRate((leads || []) as any),
        show: computeShowRate(bookingsScoped as any, runs as any, range),
      };
    },
    staleTime: 60_000,
  });
}

function fmtYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
