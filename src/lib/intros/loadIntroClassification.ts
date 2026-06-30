/**
 * Canonical loader for "is this booking a 2nd intro?".
 *
 * Every consumer that classifies 1st vs 2nd intros routes through this
 * helper. It fetches any parents that aren't already in the in-view list
 * (so cross-batch parents work the same as in-batch ones), fetches the
 * parents' runs (so a parent ACTIVE booking whose run was a NO_SHOW is
 * correctly disqualified), and exposes one `isSecondIntro(id)` function
 * backed by `isSecondIntroBooking`.
 *
 * Adding/changing the 2nd-intro rule lives in `secondIntroDetection.ts`.
 * Adding/changing the fetch shape lives here. Never reimplement either
 * inline in a component or page-level hook.
 */
import { supabase } from '@/integrations/supabase/client';
import {
  isSecondIntroBooking,
  type SecondIntroBookingLike,
  type SecondIntroRunLike,
} from './secondIntroDetection';

export interface IntroClassification {
  /** Parents we resolved (only ones not already present in the input). */
  parentBookings: SecondIntroBookingLike[];
  /** Runs linked to any candidate parent id. */
  parentRuns: SecondIntroRunLike[];
  /** True iff `bookingId` is a real 2nd intro per canonical rules. */
  isSecondIntro: (bookingId: string) => boolean;
  /** Parent booking row (if loaded) for a given child booking id. */
  getParent: (bookingId: string) => SecondIntroBookingLike | null;
  /** Parent's runs (if any) for a given child booking id. */
  getParentRuns: (bookingId: string) => SecondIntroRunLike[];
}

/**
 * Load classification data for a set of in-view bookings.
 *
 * `bookingsInView` may include the parents themselves (common with
 * pipeline-style fetches that already have the full chain). Any
 * `originating_booking_id` not present in the input is fetched.
 */
export async function loadIntroClassification(
  bookingsInView: SecondIntroBookingLike[],
): Promise<IntroClassification> {
  const inViewById = new Map<string, SecondIntroBookingLike>();
  for (const b of bookingsInView) inViewById.set(b.id, b);

  // Walk the originating_booking_id chain transitively. Reschedule chains
  // can pass through soft-deleted intermediates, so we need every ancestor
  // — not just the immediate parent — to correctly classify the leaf.
  const loadedById = new Map<string, SecondIntroBookingLike>(inViewById);
  const fetchedParents: SecondIntroBookingLike[] = [];
  let frontier = new Set<string>();
  for (const b of bookingsInView) {
    const pid = b.originating_booking_id;
    if (pid && !loadedById.has(pid)) frontier.add(pid);
  }
  const MAX_HOPS = 8;
  for (let hop = 0; hop < MAX_HOPS && frontier.size > 0; hop++) {
    const { data } = await supabase
      .from('intros_booked')
      .select('id, member_name, originating_booking_id, referred_by_member_name, booking_status_canon, is_vip, ignore_from_metrics, deleted_at')
      .in('id', Array.from(frontier));
    const rows = ((data || []) as any[]) as SecondIntroBookingLike[];
    const nextFrontier = new Set<string>();
    for (const r of rows) {
      if (!loadedById.has(r.id)) {
        loadedById.set(r.id, r);
        fetchedParents.push(r);
      }
      const pid = r.originating_booking_id;
      if (pid && !loadedById.has(pid)) nextFrontier.add(pid);
    }
    frontier = nextFrontier;
  }

  const allBookings: SecondIntroBookingLike[] = Array.from(loadedById.values());
  const allBookingsById = loadedById;

  // Fetch runs for every loaded ancestor (not just immediate parents) so
  // the recursive classifier can detect a ran ancestor up the chain.
  const candidateParentIds = new Set<string>();
  for (const b of allBookings) {
    // Any booking that is an ancestor of something else — i.e. anything
    // referenced as an originating_booking_id by a loaded row.
    const pid = b.originating_booking_id;
    if (pid) candidateParentIds.add(pid);
  }
  let parentRuns: SecondIntroRunLike[] = [];
  if (candidateParentIds.size > 0) {
    const { data } = await supabase
      .from('intros_run')
      .select('linked_intro_booked_id, result, result_canon')
      .in('linked_intro_booked_id', Array.from(candidateParentIds));
    parentRuns = ((data || []) as any[]) as SecondIntroRunLike[];
  }

  const runsByParent = new Map<string, SecondIntroRunLike[]>();
  for (const r of parentRuns) {
    const pid = r.linked_intro_booked_id;
    if (!pid) continue;
    const arr = runsByParent.get(pid) || [];
    arr.push(r);
    runsByParent.set(pid, arr);
  }

  const cache = new Map<string, boolean>();

  return {
    parentBookings: fetchedParents,
    parentRuns,
    isSecondIntro(bookingId: string): boolean {
      const cached = cache.get(bookingId);
      if (cached !== undefined) return cached;
      const child = allBookingsById.get(bookingId);
      if (!child) {
        cache.set(bookingId, false);
        return false;
      }
      const result = isSecondIntroBooking(child, allBookings, parentRuns);
      cache.set(bookingId, result);
      return result;
    },
    getParent(bookingId: string): SecondIntroBookingLike | null {
      const child = allBookingsById.get(bookingId);
      if (!child?.originating_booking_id) return null;
      return allBookingsById.get(child.originating_booking_id) || null;
    },
    getParentRuns(bookingId: string): SecondIntroRunLike[] {
      const child = allBookingsById.get(bookingId);
      if (!child?.originating_booking_id) return [];
      return runsByParent.get(child.originating_booking_id) || [];
    },
  };
}
