/**
 * Canonical Total Journey traversal.
 *
 * A "journey chain" is a root (1st-intro) booking plus every downstream
 * 2nd-intro booking linked via originating_booking_id. The chain owns
 * every run on every booking in the chain, so closes attributed to the
 * 2nd intro still belong to the original 1st intro for Total Journey
 * metrics (Studio Scoreboard, Per-SA, Per-Coach, WIG).
 *
 * Source of truth. Do not reimplement chain traversal anywhere else.
 * If you need chain logic, import walkJourneyChain or
 * resolveJourneyChainsForBookings.
 *
 * Excluded bookings (soft-deleted, VIP, ignore_from_metrics, etc.)
 * are filtered out via isBookingExcludedFromMetrics. A chain whose root
 * is excluded but has an eligible 2nd-intro child can still be reached
 * via resolvePromotedOrphanBookingIds — pass the promoted child as the
 * root.
 */
import { supabase } from '@/integrations/supabase/client';
import { isCloseRun } from './close-detection';
import { isBookingExcludedFromMetrics } from './excludedBookings';

export interface JourneyBookingLike {
  id: string;
  originating_booking_id?: string | null;
  class_date?: string | null;
  is_vip?: boolean | null;
  ignore_from_metrics?: boolean | null;
  deleted_at?: string | null;
  booking_status_canon?: string | null;
}

export interface JourneyRunLike {
  id?: string;
  linked_intro_booked_id?: string | null;
  result?: string | null;
  result_canon?: string | null;
  buy_date?: string | null;
  run_date?: string | null;
  created_at?: string;
}

export interface JourneyChain<
  B extends JourneyBookingLike = JourneyBookingLike,
  R extends JourneyRunLike = JourneyRunLike,
> {
  rootBookingId: string;
  rootBooking: B | null;
  /** Root + downstream 2nd-intro children, excluding metrics-excluded rows. */
  allBookings: B[];
  /** 2nd-intro children only (excludes the root). */
  secondIntros: B[];
  /** Bookings whose runs include at least one ran outcome (any in chain). */
  ranBookings: B[];
  /** Bookings whose runs include a close (uses isCloseRun). */
  soldBookings: B[];
  /** All runs linked to any booking in the chain (excluded bookings filtered). */
  runs: R[];
  /** True if any run in the chain is a close. */
  isClosed: boolean;
  /** True if direct close on the root (not via a 2nd-intro child). */
  isDirectClose: boolean;
  /** True if close came from a 2nd-intro child only. */
  isJourneyClose: boolean;
}

const isRanRun = (r: JourneyRunLike): boolean => {
  const rc = (r.result_canon || '').toUpperCase();
  if (rc === 'NO_SHOW' || rc === 'UNRESOLVED' || rc === 'VIP_CLASS_INTRO' || rc === 'DELETED') return false;
  const res = (r.result || '').toLowerCase();
  if (res === 'no-show' || res === 'no show') return false;
  return true;
};

/**
 * Walk the journey chain rooted at `rootBookingId` against in-memory
 * bookings + runs. Pure, synchronous.
 */
export function walkJourneyChain<
  B extends JourneyBookingLike,
  R extends JourneyRunLike,
>(
  rootBookingId: string,
  allBookings: B[],
  allRuns: R[],
): JourneyChain<B, R> {
  const root = allBookings.find(b => b.id === rootBookingId) || null;

  // 2nd-intro children pointing back to the root, eligible only.
  const secondIntros = allBookings.filter(b =>
    b.originating_booking_id === rootBookingId && !isBookingExcludedFromMetrics(b),
  );

  const chainBookings: B[] = [];
  if (root && !isBookingExcludedFromMetrics(root)) chainBookings.push(root);
  chainBookings.push(...secondIntros);

  const chainIds = new Set(chainBookings.map(b => b.id));
  const runs = allRuns.filter(r =>
    r.linked_intro_booked_id != null && chainIds.has(r.linked_intro_booked_id),
  );

  const ranBookingIds = new Set<string>();
  const soldBookingIds = new Set<string>();
  let isClosed = false;
  let isDirectClose = false;
  let isJourneyClose = false;

  for (const r of runs) {
    if (isRanRun(r)) ranBookingIds.add(r.linked_intro_booked_id!);
    if (isCloseRun(r)) {
      soldBookingIds.add(r.linked_intro_booked_id!);
      isClosed = true;
      if (r.linked_intro_booked_id === rootBookingId) isDirectClose = true;
      else isJourneyClose = true;
    }
  }

  return {
    rootBookingId,
    rootBooking: root,
    allBookings: chainBookings,
    secondIntros,
    ranBookings: chainBookings.filter(b => ranBookingIds.has(b.id)),
    soldBookings: chainBookings.filter(b => soldBookingIds.has(b.id)),
    runs,
    isClosed,
    isDirectClose,
    isJourneyClose,
  };
}

/**
 * Async variant: fetches the necessary bookings + runs from Supabase
 * for the given root booking IDs and returns a Map<rootId, JourneyChain>.
 *
 * Batched in groups of 500 to respect Postgres IN-list limits.
 */
export async function resolveJourneyChainsForBookings(
  rootBookingIds: string[],
): Promise<Map<string, JourneyChain>> {
  const result = new Map<string, JourneyChain>();
  if (!rootBookingIds.length) return result;

  // Fetch root bookings.
  const rootBookings: JourneyBookingLike[] = [];
  for (let i = 0; i < rootBookingIds.length; i += 500) {
    const batch = rootBookingIds.slice(i, i + 500);
    const { data } = await supabase
      .from('intros_booked')
      .select('id, originating_booking_id, class_date, is_vip, ignore_from_metrics, deleted_at, booking_status_canon')
      .in('id', batch);
    if (data) rootBookings.push(...(data as any[]));
  }

  // Fetch 2nd-intro children.
  const childBookings: JourneyBookingLike[] = [];
  for (let i = 0; i < rootBookingIds.length; i += 500) {
    const batch = rootBookingIds.slice(i, i + 500);
    const { data } = await supabase
      .from('intros_booked')
      .select('id, originating_booking_id, class_date, is_vip, ignore_from_metrics, deleted_at, booking_status_canon')
      .in('originating_booking_id', batch);
    if (data) childBookings.push(...(data as any[]));
  }

  const allBookings = [...rootBookings, ...childBookings];
  const allBookingIds = Array.from(new Set(allBookings.map(b => b.id)));

  // Fetch runs against any booking in the union.
  const allRuns: JourneyRunLike[] = [];
  for (let i = 0; i < allBookingIds.length; i += 500) {
    const batch = allBookingIds.slice(i, i + 500);
    if (!batch.length) continue;
    const { data } = await supabase
      .from('intros_run')
      .select('id, linked_intro_booked_id, result, result_canon, buy_date, run_date, created_at')
      .in('linked_intro_booked_id', batch);
    if (data) allRuns.push(...(data as any[]));
  }

  for (const rootId of rootBookingIds) {
    result.set(rootId, walkJourneyChain(rootId, allBookings, allRuns));
  }
  return result;
}
