/**
 * Canonical "ran first intros in date range" helper.
 *
 * Single source of truth for the count that powers:
 *   - Studio Scoreboard → "Intros Run"
 *   - Conversion Funnel → "1st Intro · Showed"
 *   - Per-SA / Per-Coach "Ran" totals (via the same primitives)
 *
 * If two surfaces ever disagree on this number, they're both wrong unless
 * they're routed through here. Do not reimplement.
 */
import { didIntroActuallyRun } from '@/lib/canon/introRules';
import { isRunInRange } from '@/lib/sales-detection';
import { hasClassTimePassed } from '@/lib/dateUtils';
import {
  isFirstIntroForMetrics,
  resolvePromotedOrphanBookingIds,
} from '@/lib/intros/orphanedFirstIntros';
import { isBookingExcludedFromMetrics } from '@/lib/intros/excludedBookings';
import type { DateRange } from '@/lib/pay-period';

interface BookingLike {
  id: string;
  class_date?: string | null;
  intro_time?: string | null;
  originating_booking_id?: string | null;
  referred_by_member_name?: string | null;
  is_vip?: boolean | null;
  ignore_from_metrics?: boolean | null;
  deleted_at?: string | null;
  booking_status_canon?: string | null;
  booking_status?: string | null;
}

interface RunLike {
  linked_intro_booked_id?: string | null;
  result?: string | null;
  result_canon?: string | null;
  run_date?: string | null;
  buy_date?: string | null;
}

/**
 * Returns the set of booking rows that count as "1st intros that actually
 * ran" within the given date range. Excludes deleted/VIP/duplicate bookings,
 * gates by class-time-passed, and confirms at least one linked run satisfies
 * `didIntroActuallyRun` AND falls inside the range.
 */
export function getRanFirstIntroBookings<T extends BookingLike>(
  introsBooked: T[],
  introsRun: RunLike[],
  dateRange: DateRange | null | undefined,
  now: Date = new Date(),
): T[] {
  const activeBookings = introsBooked.filter(b => !isBookingExcludedFromMetrics(b as any));
  const promotedOrphanIds = resolvePromotedOrphanBookingIds(
    activeBookings as any,
    introsRun as any,
  );

  // booking id -> linked runs
  const runsByBooking = new Map<string, RunLike[]>();
  for (const r of introsRun) {
    const bid = r.linked_intro_booked_id;
    if (!bid) continue;
    const arr = runsByBooking.get(bid) || [];
    arr.push(r);
    runsByBooking.set(bid, arr);
  }

  const inRange = (ymd?: string | null): boolean => {
    if (!ymd || !dateRange) return !dateRange;
    const [y, m, d] = ymd.split('-').map(Number);
    if (!y) return false;
    const dt = new Date(y, m - 1, d, 12);
    return dt >= dateRange.start && dt <= dateRange.end;
  };

  return activeBookings.filter(b => {
    if (!isFirstIntroForMetrics(b as any, promotedOrphanIds)) return false;
    if (!inRange(b.class_date)) return false;
    if (!hasClassTimePassed(b, now)) return false;
    const runs = runsByBooking.get(b.id) || [];
    return runs.some(r => didIntroActuallyRun(r) && isRunInRange(r as any, dateRange || null));
  });
}
