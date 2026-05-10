/**
 * Canonical coach-attribution helpers.
 * Single source of truth for "who is the coach for this booking/run."
 *
 * Use:
 *   - isMissingCoach(name)          — null/empty/'TBD' detection
 *   - resolveCloseCoach(b, fb, vipCoachMap) — VIP-class override + fallback
 *   - resolveCoachForBooking(b, run, vipCoachMap) — full resolution chain:
 *       booking.coach_name → run.coach_name → null,
 *       then VIP-class override applied on top.
 *
 * The previous inline implementations in Wig.tsx, useFvTrendData.ts, and
 * PerCoachTable.tsx all drifted apart — this module unifies them.
 */

interface CoachBookingLike {
  lead_source?: string | null;
  vip_session_id?: string | null;
  coach_name?: string | null;
}

/** True when a coach name is null/blank/literal "TBD" (case-insensitive). */
export function isMissingCoach(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v !== 'string') return true;
  const trimmed = v.trim();
  if (trimmed === '') return true;
  return /^tbd$/i.test(trimmed);
}

/**
 * For VIP Class bookings, the actual coach is the one who ran the VIP class
 * (looked up via vip_sessions.coach_name). Otherwise, returns the fallback.
 */
export function resolveCloseCoach(
  booking: CoachBookingLike | null | undefined,
  fallback: string | null | undefined,
  vipCoachByVipSessionId: Map<string, string>,
): string | null {
  if (
    booking &&
    (booking.lead_source || '').startsWith('VIP Class') &&
    booking.vip_session_id
  ) {
    const vc = vipCoachByVipSessionId.get(booking.vip_session_id);
    if (vc) return vc;
  }
  return fallback || null;
}

/**
 * Full resolution:
 *   1. booking.coach_name (if not missing)
 *   2. run.coach_name (if not missing)
 *   3. VIP-class override (if applicable)
 * Returns null if nothing resolves.
 */
export function resolveCoachForBooking(
  booking: CoachBookingLike | null | undefined,
  run: { coach_name?: string | null } | null | undefined,
  vipCoachByVipSessionId: Map<string, string> = new Map(),
): string | null {
  const bookingName = booking?.coach_name;
  const runName = run?.coach_name;
  const baseRaw = !isMissingCoach(bookingName)
    ? (bookingName as string)
    : (!isMissingCoach(runName) ? (runName as string) : '');
  const base = baseRaw.trim() || null;
  return resolveCloseCoach(booking, base, vipCoachByVipSessionId);
}
