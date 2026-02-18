/**
 * Canonical fallback utilities for result and status normalization.
 * Used as a final safety net when primary normalization cannot determine the value.
 */

export type ResultCanon =
  | 'PURCHASED'
  | 'DIDNT_BUY'
  | 'NO_SHOW'
  | 'NOT_INTERESTED'
  | 'FOLLOW_UP_NEEDED'
  | 'SECOND_INTRO_SCHEDULED'
  | 'UNRESOLVED';

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

const RESULT_CANON_MAP: Record<string, ResultCanon> = {
  // Sale variants
  'premier + otbeat': 'PURCHASED',
  'premier': 'PURCHASED',
  'elite + otbeat': 'PURCHASED',
  'elite': 'PURCHASED',
  'basic + otbeat': 'PURCHASED',
  'basic': 'PURCHASED',
  'sold - unlimited': 'PURCHASED',
  'sold - premier': 'PURCHASED',
  'sold - basic': 'PURCHASED',
  'sold - elite': 'PURCHASED',
  'purchased': 'PURCHASED',

  // Non-sale
  "didn't buy": 'DIDNT_BUY',
  'didnt buy': 'DIDNT_BUY',
  'no-show': 'NO_SHOW',
  'no show': 'NO_SHOW',
  'not interested': 'NOT_INTERESTED',
  'follow-up needed': 'FOLLOW_UP_NEEDED',
  'follow up needed': 'FOLLOW_UP_NEEDED',
  'booked 2nd intro': 'SECOND_INTRO_SCHEDULED',
  'second intro scheduled': 'SECOND_INTRO_SCHEDULED',
};

/**
 * Maps a raw result string to a canonical result value.
 * Returns 'UNRESOLVED' if the value cannot be mapped.
 */
export function canonicalizeResult(raw: string | null | undefined): ResultCanon {
  if (!raw) return 'UNRESOLVED';
  const key = raw.trim().toLowerCase();
  return RESULT_CANON_MAP[key] ?? 'UNRESOLVED';
}

/**
 * Returns true if the canonical result represents a membership sale.
 */
export function isCanonSale(canon: ResultCanon): boolean {
  return canon === 'PURCHASED';
}

/**
 * Returns true if the canonical result is a terminal state (no more follow-ups needed).
 */
export function isTerminalResult(canon: ResultCanon): boolean {
  return canon === 'PURCHASED' || canon === 'NOT_INTERESTED';
}
