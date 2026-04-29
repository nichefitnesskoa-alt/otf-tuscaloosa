/**
 * Canonical intro/booking classification rules.
 * Single source of truth for VIP detection, day bucketing, and outcome resolution.
 */
import { format, addDays, endOfWeek } from 'date-fns';
import { getNowCentral } from '@/lib/dateUtils';

/**
 * Returns true if the booking is a VIP event booking (not a normal intro).
 */
export function isVipBooking(booking: any): boolean {
  if (booking.is_vip === true) return true;
  if (booking.booking_type_canon === 'VIP') return true;
  if (booking.vip_session_id) return true;
  if (
    typeof booking.lead_source === 'string' &&
    booking.lead_source.toLowerCase().includes('vip')
  )
    return true;
  return false;
}

function getLocalTodayYMD(): string {
  return format(getNowCentral(), 'yyyy-MM-dd');
}

/**
 * Classify a class_date into a day bucket relative to today (local time).
 */
export function getBookingDayBucket(
  classDateYmd: string | null,
): 'today' | 'week' | 'past' | 'future' | 'unknown' {
  if (!classDateYmd) return 'unknown';
  const todayStr = getLocalTodayYMD();
  if (classDateYmd === todayStr) return 'today';
  if (classDateYmd < todayStr) return 'past';

  // "week" = after today and within next 7 days
  const weekEnd = format(addDays(new Date(), 7), 'yyyy-MM-dd');
  if (classDateYmd <= weekEnd) return 'week';
  return 'future';
}

/**
 * Result canon values that mean "the intro never actually happened" —
 * the member did not show up to a class. Use this to filter the
 * "Intro Runs" list, count runs for stats, and decide whether a
 * subsequent booking is the real 1st intro.
 *
 * NO_SHOW              — class happened, member didn't come
 * PLANNING_RESCHEDULE  — member cancelled before class, will rebook
 * UNRESOLVED           — no outcome captured yet (run row is an artifact)
 * VIP_CLASS_INTRO      — VIP event marker, not a real intro run
 *
 * NOTE: PLANNING_2ND_INTRO IS a ran intro — the member showed up,
 * had the class, and decided they want to book a 2nd intro before
 * deciding. Do NOT include it here.
 */
export const NON_RAN_RESULT_CANONS = new Set([
  'NO_SHOW',
  'PLANNING_RESCHEDULE',
  'UNRESOLVED',
  'VIP_CLASS_INTRO',
]);

const NON_RAN_RESULT_DISPLAY = new Set([
  'no-show',
  'no show',
  'planning to reschedule',
  'unresolved',
  'pending',
  '',
  'vip class intro',
]);

/**
 * Returns true ONLY when a member actually showed up to the class.
 * Use this everywhere you need to know "did this intro actually run?"
 * — the Pipeline "Intro Runs" list, run counts, 1st-vs-2nd-intro
 * detection, performance metrics, etc.
 */
export function didIntroActuallyRun(r: {
  result_canon?: string | null;
  result?: string | null;
} | null | undefined): boolean {
  if (!r) return false;
  const canon = (r.result_canon || '').toUpperCase().trim();
  if (canon) return !NON_RAN_RESULT_CANONS.has(canon);
  const legacy = (r.result || '').toLowerCase().trim();
  if (!legacy) return false;
  return !NON_RAN_RESULT_DISPLAY.has(legacy);
}

/**
 * Booking statuses that mean the booking never produced a real intro
 * (member cancelled, was rescheduled, soft-deleted). When a downstream
 * booking points at one of these as its `originating_booking_id`, the
 * downstream booking is itself the 1st intro — not a 2nd intro.
 */
export const NON_RAN_BOOKING_STATUSES = new Set([
  'PLANNING_RESCHEDULE',
  'CANCELLED',
  'DELETED_SOFT',
  'NO_SHOW',
]);

/**
 * Returns true if the booking+run combination represents a resolved outcome.
 */
export function isResolvedOutcome(booking: any, run: any | null): boolean {
  // Check booking status canon
  const bCanon = (booking.booking_status_canon || '').toUpperCase();
  if (['CLOSED', 'CLOSED_PURCHASED', 'CANCELED', 'DORMANT', 'NOT_INTERESTED', 'SECOND_INTRO_SCHEDULED'].includes(bCanon))
    return true;

  // Check booking status legacy
  const bLegacy = (booking.booking_status || '').trim();
  if (['Closed', 'Canceled', 'Dormant'].includes(bLegacy)) return true;

  if (!run) return false;

  // Check run result canon
  const rCanon = (run.result_canon || '').toUpperCase();
  if (['SOLD', 'NO_SALE', 'NO_SHOW'].includes(rCanon)) return true;

  // Check run result legacy
  const rLegacy = (run.result || '').trim();
  if (["Sold", "Didn't Buy", "No-show"].includes(rLegacy)) return true;

  return false;
}

/**
 * Returns true if a booking is an unresolved past intro that needs an outcome.
 * Never returns true for today or future dates. Never returns true for VIP.
 */
export function isUnresolvedPastIntro(booking: any, run: any | null): boolean {
  if (isVipBooking(booking)) return false;
  if (booking.deleted_at) return false;
  if (getBookingDayBucket(booking.class_date) !== 'past') return false;
  if (isResolvedOutcome(booking, run)) return false;
  return true;
}
