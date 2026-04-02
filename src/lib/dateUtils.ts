/**
 * Shared date utilities to avoid timezone bugs across DataContext, metrics, etc.
 * All "today" calculations use Central Time (America/Chicago).
 */
import { format, startOfDay, endOfDay } from 'date-fns';

/**
 * Get the current date/time in Central Time as a Date object.
 * Uses Intl to resolve the current CT offset, then shifts the UTC date accordingly.
 */
export function getNowCentral(): Date {
  const now = new Date();
  // Get CT date parts using Intl
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => {
    const p = parts.find(p => p.type === type);
    return p ? parseInt(p.value, 10) : 0;
  };

  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
}

/** Returns today as YYYY-MM-DD in Central Time */
export function getTodayYMD(): string {
  return format(getNowCentral(), 'yyyy-MM-dd');
}

/** Returns [startISO, endISO] for today in Central Time */
export function getTodayRange(): { start: string; end: string } {
  const now = getNowCentral();
  return {
    start: startOfDay(now).toISOString(),
    end: endOfDay(now).toISOString(),
  };
}

/** Returns ISO string for start of today (midnight Central) */
export function getTodayStartISO(): string {
  return startOfDay(getNowCentral()).toISOString();
}

/** Returns ISO string for start of tomorrow (midnight Central) */
export function getTomorrowStartISO(): string {
  const d = getNowCentral();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

/**
 * Converts a YYYY-MM-DD date string to a proper ISO start-of-day string
 * in the user's local timezone.  Avoids the classic bug where
 * `'2026-03-02' + 'T00:00:00'` is interpreted as UTC midnight by PostgREST.
 */
export function localDateToStartISO(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

/** End-of-day counterpart: 23:59:59.999 local → ISO */
export function localDateToEndISO(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

/** Returns current month as YYYY-MM in Central Time */
export function getCurrentMonthYear(): string {
  return format(getNowCentral(), 'yyyy-MM');
}
