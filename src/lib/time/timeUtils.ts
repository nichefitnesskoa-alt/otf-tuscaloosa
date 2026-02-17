/**
 * Canonical time utilities.
 *
 * DB stores time as HH:mm (24-hour). UI always displays h:mm a (12-hour).
 * These helpers ensure we never leak display format into persistence.
 */

/**
 * Normalizes any time string into canonical HH:mm (24-hour).
 * Accepts: "16:15", "4:15 PM", "04:15 pm", "4:15PM", HH:mm:ss, null, "TBD", "Time TBD"
 * Returns: "16:15" or null if invalid/TBD.
 */
export function normalizeDbTime(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed || /^(tbd|time\s*tbd)$/i.test(trimmed)) return null;

  // Already canonical HH:mm
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;

  // HH:mm:ss — strip seconds
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed.substring(0, 5);

  // AM/PM format: "4:15 PM", "04:15PM", "4:15pm", "12:00 AM"
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3].toUpperCase();

    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;

    if (period === 'AM') {
      if (hours === 12) hours = 0;
    } else {
      if (hours !== 12) hours += 12;
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  return null;
}

/**
 * Formats a DB time (HH:mm or legacy) into display format "h:mm a".
 * Returns "Time TBD" if null/invalid.
 */
export function formatDisplayTime(dbTime: string | null | undefined): string {
  const normalized = normalizeDbTime(dbTime);
  if (!normalized) return 'Time TBD';

  const [hStr, mStr] = normalized.split(':');
  let hours = parseInt(hStr, 10);
  const minutes = mStr;
  const period = hours >= 12 ? 'PM' : 'AM';
  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;
  return `${hours}:${minutes} ${period}`;
}

/**
 * Builds a Date from YYYY-MM-DD + DB time string (or legacy AM/PM).
 * Returns null if either is invalid.
 */
export function buildClassStartDateTime(
  classDateYmd: string,
  dbTimeOrLegacy: string | null | undefined,
): Date | null {
  if (!classDateYmd) return null;
  const normalized = normalizeDbTime(dbTimeOrLegacy);
  if (!normalized) return null;

  // Build as local time
  const [y, m, d] = classDateYmd.split('-').map(Number);
  const [h, min] = normalized.split(':').map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d) || isNaN(h) || isNaN(min)) return null;

  const date = new Date(y, m - 1, d, h, min, 0);
  // Sanity check: Date constructor can shift invalid inputs
  if (isNaN(date.getTime())) return null;
  return date;
}

/**
 * Returns a badge label like "Class ended 2h ago" or null.
 * Never returns NaN. If anything is invalid, returns null.
 */
export function formatClassEndedBadge(
  classDateYmd: string,
  dbTimeOrLegacy: string | null | undefined,
  durationMinutes = 60,
): string | null {
  const start = buildClassStartDateTime(classDateYmd, dbTimeOrLegacy);
  if (!start) return null;

  const endTime = new Date(start.getTime() + durationMinutes * 60_000);
  const now = new Date();
  if (endTime > now) return null; // still in future

  const diffMs = now.getTime() - endTime.getTime();
  if (isNaN(diffMs) || diffMs < 0) return null;

  const diffMinutes = Math.round(diffMs / 60_000);
  if (diffMinutes < 60) return `Class ended ${diffMinutes}m ago`;
  const diffHours = Math.round(diffMs / 3_600_000);
  return `Class ended ${diffHours}h ago`;
}

/**
 * Returns the latest run for a given booking from a runs array.
 */
export function getLatestRunForBooking(
  bookingId: string,
  runs: Array<{ linked_intro_booked_id?: string | null; created_at: string; [key: string]: any }>,
) {
  let latest: (typeof runs)[number] | null = null;
  for (const r of runs) {
    if (r.linked_intro_booked_id !== bookingId) continue;
    if (!latest || r.created_at > latest.created_at) latest = r;
  }
  return latest;
}

/**
 * Determines if a booking is truly unresolved.
 * Unresolved = class date is today or earlier, AND no resolved run outcome.
 */
export function isBookingUnresolved(
  booking: {
    class_date: string;
    booking_status_canon?: string;
    deleted_at?: string | null;
  },
  latestRun: { result_canon?: string; result?: string } | null,
): boolean {
  // Exclude soft-deleted
  if (booking.deleted_at) return false;

  // Exclude already-closed statuses
  const canon = booking.booking_status_canon?.toUpperCase();
  if (canon === 'PURCHASED' || canon === 'CLOSED_PURCHASED' || canon === 'NOT_INTERESTED') return false;

  // Must be today or earlier
  const today = new Date();
  const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (booking.class_date > todayYmd) return false;

  // No run at all → unresolved
  if (!latestRun) return true;

  // Check if run has a resolved outcome
  const resultCanon = (latestRun.result_canon || '').toUpperCase();
  if (resultCanon && resultCanon !== 'UNRESOLVED') return false;

  // Legacy fallback
  const legacyResult = (latestRun.result || '').trim().toLowerCase();
  if (legacyResult && legacyResult !== 'unresolved' && legacyResult !== '') return false;

  return true;
}
