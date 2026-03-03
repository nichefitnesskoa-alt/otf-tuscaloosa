/**
 * Shared date utilities to avoid timezone bugs across DataContext, metrics, etc.
 */
import { format, startOfDay, endOfDay } from 'date-fns';

/** Returns today as YYYY-MM-DD in local timezone */
export function getTodayYMD(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/** Returns [startISO, endISO] for today in local timezone */
export function getTodayRange(): { start: string; end: string } {
  const now = new Date();
  return {
    start: startOfDay(now).toISOString(),
    end: endOfDay(now).toISOString(),
  };
}

/** Returns ISO string for start of today (midnight local) */
export function getTodayStartISO(): string {
  return startOfDay(new Date()).toISOString();
}

/** Returns ISO string for start of tomorrow (midnight local) */
export function getTomorrowStartISO(): string {
  const d = new Date();
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
