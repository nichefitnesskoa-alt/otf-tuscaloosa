/**
 * OTF Tuscaloosa class schedule (America/Chicago).
 * Single source of truth for class start times by day of week.
 * Times are 24h "HH:mm" in CST.
 */

// Day of week index: 0 = Sunday … 6 = Saturday (matches Date#getDay)
export const CLASS_SCHEDULE: Record<number, string[]> = {
  0: ['10:00', '11:10'], // Sun
  1: ['05:00', '06:15', '07:30', '08:45', '10:00', '12:30', '16:15', '17:30'], // Mon
  2: ['05:00', '06:15', '07:30', '08:45', '11:15', '12:30', '16:15', '17:30'], // Tue
  3: ['05:00', '06:15', '07:30', '08:45', '10:00', '12:30', '16:15', '17:30'], // Wed
  4: ['05:00', '06:15', '07:30', '08:45', '11:15', '16:15', '17:30'], // Thu
  5: ['05:00', '06:15', '07:30', '08:45', '10:00', '12:30', '16:15'], // Fri
  6: ['08:00', '09:15', '10:30'], // Sat
};

/** Returns today's class times (HH:mm) in America/Chicago. */
export function getTodayClassTimes(now: Date = new Date()): string[] {
  // Get day-of-week in Chicago time
  const chicagoStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
  }).format(now);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = map[chicagoStr] ?? new Date().getDay();
  return CLASS_SCHEDULE[dow] ?? [];
}

/** Today's date in Chicago as YYYY-MM-DD. */
export function getChicagoTodayYMD(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const d = parts.find(p => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
}

/** Current time-of-day in Chicago as minutes since midnight. */
export function getChicagoMinutesNow(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const h = parseInt(parts.find(p => p.type === 'hour')!.value, 10);
  const m = parseInt(parts.find(p => p.type === 'minute')!.value, 10);
  return h * 60 + m;
}

/** "HH:mm" -> minutes since midnight. */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(n => parseInt(n, 10));
  return h * 60 + m;
}

/** "HH:mm" -> "h:mm AM/PM" display. */
export function formatClassTimeDisplay(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(n => parseInt(n, 10));
  const period = h >= 12 ? 'PM' : 'AM';
  const dh = h % 12 === 0 ? 12 : h % 12;
  return `${dh}:${m.toString().padStart(2, '0')} ${period}`;
}
