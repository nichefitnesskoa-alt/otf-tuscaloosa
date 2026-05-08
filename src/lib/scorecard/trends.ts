/**
 * First Visit Experience trend + cadence helpers.
 *
 * Pure functions only. Keep all date math anchored to America/Chicago via the
 * shared dateUtils helpers so weekly cadence resets predictably for every
 * coach across the studio.
 */
import { differenceInDays, format, getISOWeek, startOfWeek, endOfWeek, addDays } from 'date-fns';
import type { FvScorecard } from '@/hooks/useScorecards';
import { getNowCentral } from '@/lib/dateUtils';

export type EvalPrimary = 'formal' | 'self';
export type CadenceType = 'self' | 'formal';

export interface TrendPoint {
  bucket: string;          // display label
  bucketStart: Date;       // for sort + drill-down
  selfAvg: number | null;
  formalAvg: number | null;
  selfCount: number;
  formalCount: number;
  scorecards: FvScorecard[];
}

export interface DateRangeLike { start: Date; end: Date }

/** Pick one scorecard per first_timer_id, preferring the requested mode. */
export function pickPrimaryScorecards(cards: FvScorecard[], mode: EvalPrimary): FvScorecard[] {
  const byTimer = new Map<string, FvScorecard>();
  const orphan: FvScorecard[] = [];
  for (const c of cards) {
    if (!c.submitted_at) continue;
    if (!c.first_timer_id) { orphan.push(c); continue; }
    const existing = byTimer.get(c.first_timer_id);
    if (!existing) { byTimer.set(c.first_timer_id, c); continue; }
    const wantType = mode === 'formal' ? 'formal_eval' : 'self_eval';
    const otherType = mode === 'formal' ? 'self_eval' : 'formal_eval';
    if (existing.eval_type === wantType && c.eval_type === otherType) continue;
    if (existing.eval_type === otherType && c.eval_type === wantType) {
      byTimer.set(c.first_timer_id, c); continue;
    }
    // Same type — prefer most recently submitted.
    if ((c.submitted_at || '') > (existing.submitted_at || '')) byTimer.set(c.first_timer_id, c);
  }
  return [...byTimer.values(), ...orphan];
}

/** Auto pick a sensible bucket size for the chart. */
export type BucketSize = 'day' | 'week' | 'month';
export function pickBucketSize(range: DateRangeLike): BucketSize {
  const days = Math.max(1, differenceInDays(range.end, range.start));
  if (days <= 14) return 'day';
  if (days <= 90) return 'week';
  return 'month';
}

function bucketKey(d: Date, size: BucketSize): { key: string; label: string; start: Date } {
  if (size === 'day') {
    const k = format(d, 'yyyy-MM-dd');
    return { key: k, label: format(d, 'MMM d'), start: new Date(d.getFullYear(), d.getMonth(), d.getDate()) };
  }
  if (size === 'week') {
    const start = startOfWeek(d, { weekStartsOn: 1 });
    return { key: format(start, 'yyyy-MM-dd'), label: format(start, 'MMM d'), start };
  }
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  return { key: format(start, 'yyyy-MM'), label: format(start, 'MMM yy'), start };
}

/** Build trend points (one per bucket) from already-deduped scorecards. */
export function buildTrendPoints(
  cards: FvScorecard[],
  range: DateRangeLike,
  size: BucketSize = pickBucketSize(range),
): TrendPoint[] {
  const map = new Map<string, TrendPoint>();
  for (const c of cards) {
    if (!c.submitted_at) continue;
    const d = new Date(c.class_date + 'T12:00:00');
    if (d < range.start || d > range.end) continue;
    const { key, label, start } = bucketKey(d, size);
    let pt = map.get(key);
    if (!pt) {
      pt = { bucket: label, bucketStart: start, selfAvg: null, formalAvg: null, selfCount: 0, formalCount: 0, scorecards: [] };
      map.set(key, pt);
    }
    pt.scorecards.push(c);
    if (c.eval_type === 'self_eval') {
      pt.selfAvg = ((pt.selfAvg ?? 0) * pt.selfCount + c.total_score) / (pt.selfCount + 1);
      pt.selfCount++;
    } else {
      pt.formalAvg = ((pt.formalAvg ?? 0) * pt.formalCount + c.total_score) / (pt.formalCount + 1);
      pt.formalCount++;
    }
  }
  return [...map.values()].sort((a, b) => a.bucketStart.getTime() - b.bucketStart.getTime());
}

/** 4-period moving average. Falls back to raw value when window not yet full. */
export function applyMovingAverage(points: TrendPoint[], window = 4): TrendPoint[] {
  return points.map((p, i, arr) => {
    const start = Math.max(0, i - window + 1);
    const slice = arr.slice(start, i + 1);
    const avg = (key: 'selfAvg' | 'formalAvg') => {
      const vals = slice.map(s => s[key]).filter((v): v is number => v !== null);
      return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    };
    return { ...p, selfAvg: avg('selfAvg'), formalAvg: avg('formalAvg') };
  });
}

/* ───────────────────── Cadence (studio-wide odd/even ISO week) ───────────────────── */

/**
 * Studio-wide cadence: odd ISO weeks = self-eval, even ISO weeks = formal eval.
 * Same obligation for every coach in the same week.
 */
export function getCadenceForDate(d: Date = getNowCentral()): { type: CadenceType; weekStart: Date; weekEnd: Date; isoWeek: number } {
  const isoWeek = getISOWeek(d);
  return {
    type: isoWeek % 2 === 1 ? 'self' : 'formal',
    weekStart: startOfWeek(d, { weekStartsOn: 1 }),
    weekEnd: endOfWeek(d, { weekStartsOn: 1 }),
    isoWeek,
  };
}

/** Did this coach satisfy the cadence obligation for the given week? */
export function hasMetCadenceForWeek(
  coachName: string,
  cards: FvScorecard[],
  weekStart: Date,
  weekEnd: Date,
  type: CadenceType,
): boolean {
  const wantType = type === 'self' ? 'self_eval' : 'formal_eval';
  return cards.some(c => {
    if (!c.submitted_at) return false;
    if (c.evaluatee_name !== coachName) return false;
    if (c.eval_type !== wantType) return false;
    const sub = new Date(c.submitted_at);
    return sub >= weekStart && sub <= weekEnd;
  });
}

/** Coach also exceeds the standard if they self-evaluate every week of the month. */
export function isSelfEvalEveryWeekThisMonth(coachName: string, cards: FvScorecard[], today: Date = getNowCentral()): boolean {
  // Build list of week starts from start of month → today (Mon weeks)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  let cursor = startOfWeek(monthStart, { weekStartsOn: 1 });
  const weeks: { start: Date; end: Date }[] = [];
  while (cursor <= today) {
    weeks.push({ start: cursor, end: endOfWeek(cursor, { weekStartsOn: 1 }) });
    cursor = addDays(cursor, 7);
  }
  if (weeks.length === 0) return false;
  return weeks.every(w =>
    cards.some(c =>
      c.submitted_at &&
      c.evaluatee_name === coachName &&
      c.eval_type === 'self_eval' &&
      new Date(c.submitted_at) >= w.start &&
      new Date(c.submitted_at) <= w.end,
    ),
  );
}

/** Streak of consecutive prior weeks (ending last full week) where cadence was met. */
export function cadenceStreakWeeks(coachName: string, cards: FvScorecard[], today: Date = getNowCentral()): number {
  let streak = 0;
  let cursor = addDays(startOfWeek(today, { weekStartsOn: 1 }), -7); // last full week
  while (true) {
    const isoWeek = getISOWeek(cursor);
    const type: CadenceType = isoWeek % 2 === 1 ? 'self' : 'formal';
    const wkStart = cursor;
    const wkEnd = endOfWeek(cursor, { weekStartsOn: 1 });
    if (!hasMetCadenceForWeek(coachName, cards, wkStart, wkEnd, type)) break;
    streak++;
    cursor = addDays(cursor, -7);
    if (streak > 104) break; // safety
  }
  return streak;
}

/** Status for the leaderboard cadence dot. */
export type CadenceDotStatus = 'met' | 'pending' | 'missed';
export function cadenceDotStatus(coachName: string, cards: FvScorecard[], today: Date = getNowCentral()): CadenceDotStatus {
  const cur = getCadenceForDate(today);
  if (hasMetCadenceForWeek(coachName, cards, cur.weekStart, cur.weekEnd, cur.type)) return 'met';
  // Look at last week; if missed, red.
  const lastStart = addDays(cur.weekStart, -7);
  const lastEnd = addDays(cur.weekEnd, -7);
  const lastIso = getISOWeek(lastStart);
  const lastType: CadenceType = lastIso % 2 === 1 ? 'self' : 'formal';
  if (!hasMetCadenceForWeek(coachName, cards, lastStart, lastEnd, lastType)) return 'missed';
  return 'pending';
}
