/**
 * Canonical pace-to-today helper for the WIG scoreboard.
 *
 * Pace-to-today scales a monthly target linearly by elapsed days in the
 * target's calendar month, anchored to America/Chicago. The hero, every
 * leaderboard row, the coach close-rate tile, and Own It all call this —
 * never reimplement the formula inline.
 *
 * Sibling: statusColor scores a current value against pace and returns a
 * shared R/Y/G token used by every WIG surface so colors agree.
 */
import { getNowCentral } from '@/lib/dateUtils';

export type WigStatus = 'green' | 'yellow' | 'red' | 'unset';

/**
 * Returns the prorated target value at "today" in CST for the calendar
 * month containing `on`. `null` monthly target → `null` (UI should render
 * "CONFIRM THIS VALUE" rather than guessing).
 *
 * Formula: monthly × (daysElapsed ÷ daysInMonth), where daysElapsed
 * includes today (day 1 on the 1st).
 */
export function paceToToday(
  monthlyTarget: number | null | undefined,
  on: Date = getNowCentral(),
): number | null {
  if (monthlyTarget == null || isNaN(monthlyTarget)) return null;
  const y = on.getFullYear();
  const m = on.getMonth();
  const day = on.getDate();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const elapsed = Math.max(1, Math.min(daysInMonth, day));
  return monthlyTarget * (elapsed / daysInMonth);
}

/**
 * Scores `current` against `pace`. Yellow band is "within ~20% behind pace".
 * Use the same helper everywhere so a row colored green on the leaderboard
 * is the same green Own It would show for that SA.
 */
export function statusColor(
  current: number,
  pace: number | null | undefined,
): WigStatus {
  if (pace == null || pace <= 0) return 'unset';
  if (current >= pace) return 'green';
  if (current >= pace * 0.8) return 'yellow';
  return 'red';
}

/** Convenience: text + bar Tailwind classes for a given status. */
export function statusClasses(status: WigStatus): {
  text: string;
  bar: string;
  ring: string;
} {
  switch (status) {
    case 'green':
      return { text: 'text-success', bar: 'bg-success', ring: 'ring-success/40' };
    case 'yellow':
      return { text: 'text-warning', bar: 'bg-warning', ring: 'ring-warning/40' };
    case 'red':
      return { text: 'text-destructive', bar: 'bg-destructive', ring: 'ring-destructive/40' };
    case 'unset':
    default:
      return { text: 'text-muted-foreground', bar: 'bg-muted', ring: 'ring-muted' };
  }
}

/** Tiny formatter so every pace string reads the same way. */
export function formatPace(pace: number | null): string {
  if (pace == null) return '—';
  return pace >= 10 ? String(Math.round(pace)) : pace.toFixed(1);
}
