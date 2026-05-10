/**
 * Canonical booking-type normalization helpers.
 *
 * Result-canon helpers used to live here but used `'PURCHASED'` — a value that
 * never appears in production data (real sale canons are PREMIER / PREMIER_OTBEAT
 * / ELITE / BASIC / SALE). The canonical "is this a sale" check now lives in
 * `@/lib/sales-detection` (`isSaleCanon` / `SALE_CANONS`). Import from there.
 */

export type BookingTypeCanon = 'STANDARD' | 'VIP' | 'COMP';

/**
 * Canonical booking type normalizer.
 * NULL defaults to STANDARD. COMP is its own explicit type, never a fallback.
 */
export function canonBookingType(raw: string | null | undefined): BookingTypeCanon {
  if (!raw) return 'STANDARD';
  const upper = raw.trim().toUpperCase();
  if (upper === 'VIP') return 'VIP';
  if (upper === 'COMP') return 'COMP';
  return 'STANDARD';
}

/**
 * Returns true if the booking type should be excluded from the standard funnel
 * (MyDay, pipeline tabs, questionnaires, follow-ups, scoreboard).
 */
export function isExcludedFromFunnel(bookingTypeCanon: string | null | undefined): boolean {
  const canon = canonBookingType(bookingTypeCanon);
  return canon === 'VIP' || canon === 'COMP';
}
