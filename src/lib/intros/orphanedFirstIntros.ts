/**
 * Orphaned 2nd-intro promotion.
 *
 * Background: when a member's original 1st-intro booking is excluded from
 * metrics (soft-deleted, marked DUPLICATE/DEAD, etc.), any chained
 * 2nd-intro bookings become "orphans". The member's real journey did
 * happen — we just lost the original row. We promote ONE child per
 * excluded original so the chain still gets credit, without double-
 * counting if multiple children exist (e.g. a follow-up child + a sale
 * child both pointing back to the same deleted original).
 *
 * Selection priority (within a single excluded-origin group):
 *   1. Child whose own runs include a SALE (membership purchase).
 *   2. Child whose own runs include a non-no-show "ran" outcome.
 *   3. Latest class_date.
 *
 * Children that are themselves excluded (soft-deleted, VIP, etc.) are
 * never eligible.
 */
import { isBookingExcludedFromMetrics } from './excludedBookings';
import { isCloseResult } from './resultLabels';

interface BookingLike {
  id: string;
  originating_booking_id?: string | null;
  class_date?: string | null;
  is_vip?: boolean | null;
  ignore_from_metrics?: boolean | null;
  deleted_at?: string | null;
  booking_status_canon?: string | null;
}

interface RunLike {
  linked_intro_booked_id?: string | null;
  result?: string | null;
  result_canon?: string | null;
}

/**
 * Returns the set of booking IDs that should be promoted to "first intro"
 * because their originating booking is missing or excluded from metrics.
 *
 * `allBookings` should contain every booking under consideration — both
 * potential children and their originating rows when available. Missing
 * originating rows count as "excluded" (orphan).
 */
export function resolvePromotedOrphanBookingIds(
  allBookings: BookingLike[],
  allRuns: RunLike[],
): Set<string> {
  const bookingById = new Map<string, BookingLike>();
  for (const b of allBookings) bookingById.set(b.id, b);

  // Group candidate children by originating_booking_id where the original
  // is either missing or itself excluded.
  const groups = new Map<string, BookingLike[]>();
  for (const b of allBookings) {
    const origId = b.originating_booking_id;
    if (!origId) continue;
    if (isBookingExcludedFromMetrics(b)) continue; // child must itself be eligible
    const orig = bookingById.get(origId);
    const origExcluded = !orig || isBookingExcludedFromMetrics(orig);
    if (!origExcluded) continue;
    const arr = groups.get(origId) || [];
    arr.push(b);
    groups.set(origId, arr);
  }

  // Index runs by booking id for fast lookup.
  const runsByBooking = new Map<string, RunLike[]>();
  for (const r of allRuns) {
    const bid = r.linked_intro_booked_id;
    if (!bid) continue;
    const arr = runsByBooking.get(bid) || [];
    arr.push(r);
    runsByBooking.set(bid, arr);
  }

  const isRanRun = (r: RunLike) => {
    const rc = (r.result_canon || '').toUpperCase();
    if (rc === 'NO_SHOW' || rc === 'UNRESOLVED' || rc === 'VIP_CLASS_INTRO') return false;
    const res = (r.result || '').toLowerCase();
    if (res === 'no-show' || res === 'no show') return false;
    return true;
  };

  const promoted = new Set<string>();
  for (const [, candidates] of groups) {
    if (candidates.length === 0) continue;
    if (candidates.length === 1) { promoted.add(candidates[0].id); continue; }

    const score = (b: BookingLike) => {
      const runs = runsByBooking.get(b.id) || [];
      const hasSale = runs.some(r => isCloseResult(r));
      const hasRan = runs.some(isRanRun);
      const dateScore = b.class_date ? Date.parse(b.class_date) || 0 : 0;
      // Tiered: sale > ran > none; tie-break by class_date desc.
      return (hasSale ? 1e15 : 0) + (hasRan ? 1e12 : 0) + dateScore;
    };

    const winner = [...candidates].sort((a, b) => score(b) - score(a))[0];
    promoted.add(winner.id);
  }

  return promoted;
}

/**
 * Convenience predicate: is this booking a "first intro" for metrics?
 * Either no originating_booking_id, or it's a friend-referral pointing
 * to an unrelated member, or it was promoted as the chosen orphan.
 */
export function isFirstIntroForMetrics(
  b: BookingLike & { referred_by_member_name?: string | null },
  promotedIds: Set<string>,
): boolean {
  if (!b.originating_booking_id) return true;
  if (b.referred_by_member_name) return true;
  return promotedIds.has(b.id);
}
