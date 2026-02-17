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
