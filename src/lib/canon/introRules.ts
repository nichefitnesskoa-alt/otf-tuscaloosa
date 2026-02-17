/**
 * Canonical intro/booking classification rules.
 * Single source of truth for VIP detection, day bucketing, and outcome resolution.
 */
import { format, addDays, endOfWeek } from 'date-fns';

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
  return format(new Date(), 'yyyy-MM-dd');
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
