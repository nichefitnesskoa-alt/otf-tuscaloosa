/**
 * Date/time formatting utilities.
 * Handles both full ISO strings and bare HH:mm strings safely.
 */
import { format, isToday, startOfDay, endOfWeek, addDays, parseISO, isValid } from 'date-fns';

/**
 * Parse a value that could be:
 * - ISO string: "2026-02-18T09:15:00"
 * - Date-only: "2026-02-18"
 * - Time-only: "09:15" or "9:15"
 * Returns a Date or null.
 */
function parseFlexible(value: string | null | undefined): Date | null {
  if (!value) return null;
  const v = value.trim();

  // Full ISO or date-only string
  if (v.includes('-') || v.includes('T')) {
    // If it's a date-only string (yyyy-MM-dd), append noon to avoid TZ issues
    const d = v.length === 10 ? parseISO(v + 'T12:00:00') : parseISO(v);
    return isValid(d) ? d : null;
  }

  // Bare HH:mm or HH:mm:ss — attach to today's date for time display
  const timeMatch = v.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return isValid(d) ? d : null;
  }

  return null;
}

/**
 * Format a time to 12h display: "9:15 AM"
 * Accepts ISO timestamps or bare HH:mm strings.
 * Returns "—" if null/undefined/invalid.
 */
export function formatTime12h(value: string | null | undefined): string {
  const d = parseFlexible(value);
  if (!d) return '—';
  return format(d, 'h:mm aa').replace('am', 'AM').replace('pm', 'PM');
}

/**
 * Format a date to short display: "Feb 17"
 * Accepts ISO timestamps or date-only strings.
 * Returns "—" if null/undefined/invalid.
 */
export function formatDateShort(value: string | null | undefined): string {
  const d = parseFlexible(value);
  if (!d) return '—';
  return format(d, 'MMM d');
}

/**
 * Returns true if the date portion of the value is today.
 */
export function isTodayStartAt(value: string | null | undefined): boolean {
  const d = parseFlexible(value);
  if (!d) return false;
  return isToday(d);
}

/**
 * Returns true if the date is tomorrow through end of this week (not today, not past).
 */
export function isThisWeekStartAt(value: string | null | undefined): boolean {
  const d = parseFlexible(value);
  if (!d) return false;
  const tomorrow = startOfDay(addDays(new Date(), 1));
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  return d >= tomorrow && d <= weekEnd;
}
