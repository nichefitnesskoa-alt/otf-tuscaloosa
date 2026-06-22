/**
 * Canonical end-time helper for a giveaway studio.
 * Every consumer must route through this — never inline `liveAt + days*86400*1000`.
 *
 * Modes:
 *  - 'fixed_days'    → liveAt + countdown_duration_days
 *  - 'end_of_month'  → 23:59:59 on the last day of the month in America/Chicago
 *                       of the month the giveaway went live
 */
export type CountdownMode = 'fixed_days' | 'end_of_month';

interface StudioLike {
  goes_live_at: string | null;
  countdown_duration_days: number;
  countdown_mode?: CountdownMode | null;
}

/** Returns the end-of-current-month timestamp in America/Chicago, anchored to `anchor`. */
export function getCentralEndOfMonth(anchor: Date): Date {
  // Use Intl to extract Y/M in America/Chicago, then build a UTC instant for
  // local midnight of the first of next month CST, minus 1 second.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(anchor);
  const y = Number(parts.find(p => p.type === 'year')?.value);
  const m = Number(parts.find(p => p.type === 'month')?.value); // 1-12

  // Build a Date for "first of next month, 00:00:00 America/Chicago"
  // then subtract 1 second to get "last second of this month CST".
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;

  // Compute UTC offset for that wall-clock time in Chicago by formatting back.
  const targetWallUtc = Date.UTC(nextY, nextM - 1, 1, 0, 0, 0);
  const offsetMs = wallClockOffsetMs(new Date(targetWallUtc), 'America/Chicago');
  return new Date(targetWallUtc + offsetMs - 1000);
}

/** Returns the ms offset to apply to a UTC instant whose Y/M/D/H/M/S equal a desired wall-clock in `tz`. */
function wallClockOffsetMs(wallUtc: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = dtf.formatToParts(wallUtc);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wallUtc.getTime() - asUtc;
}

export function getGiveawayEndAt(studio: StudioLike): number | null {
  if (!studio.goes_live_at) return null;
  const liveAt = new Date(studio.goes_live_at).getTime();
  const mode = studio.countdown_mode ?? 'fixed_days';
  if (mode === 'end_of_month') {
    return getCentralEndOfMonth(new Date(liveAt)).getTime();
  }
  return liveAt + studio.countdown_duration_days * 86400 * 1000;
}
