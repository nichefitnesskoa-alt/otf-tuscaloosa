/**
 * Canonical "is this booking a 2nd intro?" detection.
 *
 * Single source of truth. Every consumer that classifies 1st vs 2nd intros
 * MUST route through this helper — never check `originating_booking_id`
 * directly.
 *
 * The rule: a booking is only a 2nd intro if a parent intro actually
 * happened. If the parent was a no-show, cancelled, rescheduled, soft-
 * deleted, VIP, or otherwise excluded — the child is itself a 1st intro
 * (the person never had a real 1st before).
 */
import { isBookingExcludedFromMetrics } from './excludedBookings';
import { didIntroActuallyRun, NON_RAN_BOOKING_STATUSES } from '@/lib/canon/introRules';

export interface SecondIntroBookingLike {
  id: string;
  member_name?: string | null;
  originating_booking_id?: string | null;
  referred_by_member_name?: string | null;
  booking_status_canon?: string | null;
  is_vip?: boolean | null;
  ignore_from_metrics?: boolean | null;
  deleted_at?: string | null;
}

export interface SecondIntroRunLike {
  linked_intro_booked_id?: string | null;
  result?: string | null;
  result_canon?: string | null;
}

function nameKey(n: string | null | undefined): string {
  return (n || '').toLowerCase().replace(/\s+/g, '');
}

/**
 * Returns true if `child` is a real 2nd intro (or 3rd+, etc.) — i.e. the
 * person has at least one prior intro that actually happened.
 *
 * `allBookings` MUST contain the parent if it exists in the system.
 * `allRuns` MUST contain runs linked to any candidate parent (filter to
 * `linked_intro_booked_id IN (parent ids)` is enough).
 *
 * Returns false when:
 *   - no originating_booking_id (root booking)
 *   - referred_by_member_name set (friend booking — always a 1st intro)
 *   - parent missing from allBookings (treat as orphan → child is 1st)
 *   - parent belongs to a different member (friend chain)
 *   - parent is excluded from metrics (deleted/VIP/etc.)
 *   - parent's booking_status_canon is in NON_RAN_BOOKING_STATUSES
 *   - parent has no run where didIntroActuallyRun() is true
 */
export function isSecondIntroBooking(
  child: SecondIntroBookingLike,
  allBookings: SecondIntroBookingLike[],
  allRuns: SecondIntroRunLike[],
): boolean {
  if (!child.originating_booking_id) return false;
  if (child.referred_by_member_name) return false;

  const parent = allBookings.find(b => b.id === child.originating_booking_id);
  if (!parent) return false;

  if (nameKey(parent.member_name) !== nameKey(child.member_name)) return false;
  if (isBookingExcludedFromMetrics(parent)) return false;

  const parentStatus = (parent.booking_status_canon || '').toUpperCase();
  if (NON_RAN_BOOKING_STATUSES.has(parentStatus)) return false;

  // The booking might be ACTIVE/SHOWED-canon but the actual run was a
  // no-show. Look at runs.
  const parentRuns = allRuns.filter(r => r.linked_intro_booked_id === parent.id);
  if (parentRuns.length === 0) {
    // No run yet. If the booking is still ACTIVE and the parent's intro
    // hasn't happened, the child can't be a 2nd intro yet either. Caller
    // contexts (MyDay upcoming, etc.) generally want this as "not 2nd".
    return false;
  }
  const anyRan = parentRuns.some(r => didIntroActuallyRun(r));
  return anyRan;
}

/**
 * Walk up the originating_booking_id chain, skipping parents that didn't
 * actually run (so chain index and root resolution stay correct after the
 * 2nd-intro rule). Returns the effective root booking id for the child.
 */
export function getEffectiveRootBookingId(
  booking: SecondIntroBookingLike,
  allBookings: SecondIntroBookingLike[],
  allRuns: SecondIntroRunLike[],
): string {
  let current = booking;
  const visited = new Set<string>([current.id]);
  while (isSecondIntroBooking(current, allBookings, allRuns)) {
    const parent = allBookings.find(b => b.id === current.originating_booking_id);
    if (!parent || visited.has(parent.id)) break;
    visited.add(parent.id);
    current = parent;
  }
  return current.id;
}
