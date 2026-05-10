/**
 * Canonical SA performance helpers — single source of truth for SA leaderboard,
 * SA detail page, and any drill-down. Pure functions, no I/O.
 *
 * A "shift" = a unique (sa_name, shift_date, shift_type) tuple in
 * shift_task_completions. A milestone-eligible threshold is one of:
 * 25, 50, 75, 100, 150, 200, 250, ... (every +50 after 25). Confirmed with Koa.
 *
 * Coverage % is intentionally omitted: we do not yet have a class-roster source
 * to know which members were eligible per shift. Build 4D will revisit when
 * roster data is available.
 */

import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TZ = 'America/Chicago';

export interface ShiftRow {
  sa_name: string;
  shift_date: string; // YYYY-MM-DD
  shift_type: string;
}

export interface MilestoneRow {
  id: string;
  member_name: string | null;
  milestone_type: string | null;
  created_by: string | null;
  created_at: string; // ISO
  friend_name?: string | null;
  five_class_pack_gifted?: boolean;
}

export interface ReferralAskRow {
  id: string;
  member_name: string | null;
  class_date: string | null;
  booked_by: string | null; // SA who logged
}

export interface SaLeaderboardRow {
  name: string;
  shifts: number;
  milestones: number;
  referralAsks: number;
  referralAskRate: number; // per shift
  streak: number; // consecutive shifts (worked) with ≥1 milestone marked
}

/** Eligible thresholds: 25, 50, 100, and every +50 after (150, 200, ..., 1150, ...). */
export function isEligibleThreshold(milestoneType: string | number | null | undefined): boolean {
  if (milestoneType == null) return false;
  const n = typeof milestoneType === 'number' ? milestoneType : parseInt(String(milestoneType), 10);
  if (!Number.isFinite(n) || n < 25) return false;
  if (n === 25 || n === 50 || n === 100) return true;
  // every +50 after 100: 150, 200, 250, ..., 1150, ...
  return n > 100 && n % 50 === 0;
}

/** Convert ISO timestamp to YYYY-MM-DD in America/Chicago. */
export function isoToCentralDate(iso: string): string {
  return format(toZonedTime(iso, TZ), 'yyyy-MM-dd');
}

/** Count distinct (sa, date, type) shifts for an SA. */
export function countShifts(shifts: ShiftRow[], saName: string): number {
  const set = new Set<string>();
  for (const s of shifts) {
    if (s.sa_name !== saName) continue;
    set.add(`${s.shift_date}|${s.shift_type}`);
  }
  return set.size;
}

/** Sorted descending list of unique shift dates worked by an SA (YYYY-MM-DD). */
export function shiftDatesForSa(shifts: ShiftRow[], saName: string): string[] {
  const set = new Set<string>();
  for (const s of shifts) if (s.sa_name === saName) set.add(s.shift_date);
  return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
}

/**
 * Daily milestone streak: consecutive shift-days (most recent backwards)
 * where the SA marked at least 1 milestone. Resets at the first worked shift
 * with zero milestones marked. Only ELIGIBLE milestone thresholds count.
 */
export function computeMilestoneStreak(
  shifts: ShiftRow[],
  milestones: MilestoneRow[],
  saName: string
): number {
  const dates = shiftDatesForSa(shifts, saName);
  if (dates.length === 0) return 0;

  // Build set of central-time shift-dates with ≥1 eligible milestone by this SA
  const milestoneDays = new Set<string>();
  for (const m of milestones) {
    if ((m.created_by || '').trim() !== saName) continue;
    if (!isEligibleThreshold(m.milestone_type)) continue;
    milestoneDays.add(isoToCentralDate(m.created_at));
  }

  let streak = 0;
  for (const d of dates) {
    if (milestoneDays.has(d)) streak++;
    else break;
  }
  return streak;
}

/** Build leaderboard rows for all SAs that worked or marked anything in range. */
export function buildSaLeaderboard(
  shifts: ShiftRow[],
  milestones: MilestoneRow[],
  referrals: ReferralAskRow[]
): SaLeaderboardRow[] {
  const names = new Set<string>();
  for (const s of shifts) names.add(s.sa_name);
  for (const m of milestones) {
    if (m.created_by && isEligibleThreshold(m.milestone_type)) names.add(m.created_by);
  }
  for (const r of referrals) if (r.booked_by) names.add(r.booked_by);

  const rows: SaLeaderboardRow[] = [];
  for (const name of names) {
    const shiftCount = countShifts(shifts, name);
    const milestoneCount = milestones.filter(
      m => (m.created_by || '') === name && isEligibleThreshold(m.milestone_type)
    ).length;
    const referralCount = referrals.filter(r => (r.booked_by || '') === name).length;
    rows.push({
      name,
      shifts: shiftCount,
      milestones: milestoneCount,
      referralAsks: referralCount,
      referralAskRate: shiftCount > 0 ? referralCount / shiftCount : 0,
      streak: computeMilestoneStreak(shifts, milestones, name),
    });
  }
  return rows.sort(
    (a, b) =>
      b.referralAskRate - a.referralAskRate ||
      b.referralAsks - a.referralAsks ||
      b.milestones - a.milestones
  );
}
