import { describe, it, expect } from 'vitest';
import { getISOWeek } from 'date-fns';
import {
  getCadenceForDate,
  hasMetCadenceForWeek,
  cadenceStreakWeeks,
  cadenceDotStatus,
  isSelfEvalEveryWeekThisMonth,
} from '@/lib/scorecard/trends';
import type { FvScorecard } from '@/hooks/useScorecards';

function card(over: Partial<FvScorecard>): FvScorecard {
  return {
    id: Math.random().toString(36).slice(2),
    evaluatee_name: 'Coach A',
    evaluator_name: 'Coach A',
    eval_type: 'self_eval',
    class_date: '2026-01-05',
    submitted_at: '2026-01-05T15:00:00.000Z',
    total_score: 24,
    level: 2,
    first_timer_id: null,
    practice_name: null,
    tread_score: 5, rower_score: 5, floor_score: 5, otbeat_score: 5, handback_score: 5,
    interactions_notes: null, otbeat_notes: null, handback_notes: null,
    created_by: null, created_at: '2026-01-05T15:00:00.000Z',
    ...over,
  } as unknown as FvScorecard;
}

describe('getCadenceForDate — ISO week boundaries', () => {
  it('alternates self/formal across week 52 → week 1 boundary', () => {
    // Dec 28, 2026 → ISO week 53 (2026 is a long year)
    const dec28 = new Date(2026, 11, 28); // Mon
    const jan04 = new Date(2027, 0, 4);   // Mon, ISO week 1 of 2027
    const c1 = getCadenceForDate(dec28);
    const c2 = getCadenceForDate(jan04);
    expect(c1.type).not.toBe(c2.type);
  });

  it('handles ISO week 53 in long years (2026)', () => {
    const d = new Date(2026, 11, 30); // Wed in week 53
    const c = getCadenceForDate(d);
    expect(c.isoWeek).toBe(53);
    expect(c.type).toBe(c.isoWeek % 2 === 1 ? 'self' : 'formal');
  });

  it('produces consistent week start/end across DST spring-forward (Mar 8, 2026)', () => {
    const dst = new Date(2026, 2, 8); // 2nd Sunday of March 2026
    const c = getCadenceForDate(dst);
    expect(c.weekStart.getDay()).toBe(1); // Monday
    expect(c.weekEnd.getDay()).toBe(0);   // Sunday
  });

  it('produces consistent week start/end across DST fall-back (Nov 1, 2026)', () => {
    const fb = new Date(2026, 10, 1); // 1st Sunday of November 2026
    const c = getCadenceForDate(fb);
    expect(c.weekStart.getDay()).toBe(1);
    expect(c.weekEnd.getDay()).toBe(0);
  });

  it('assigns the correct ISO week at midnight on Monday', () => {
    const d = new Date(2026, 0, 5, 0, 0, 0); // Mon Jan 5 2026 midnight
    const c = getCadenceForDate(d);
    expect(c.isoWeek).toBe(getISOWeek(d));
  });

  it('alternates strictly across a full year (no two adjacent weeks share a type)', () => {
    let prev = getCadenceForDate(new Date(2026, 0, 5));
    for (let w = 1; w < 52; w++) {
      const d = new Date(2026, 0, 5 + w * 7);
      const cur = getCadenceForDate(d);
      expect(cur.type).not.toBe(prev.type);
      prev = cur;
    }
  });
});

describe('hasMetCadenceForWeek', () => {
  const weekStart = new Date(2026, 0, 5, 0, 0, 0); // Mon
  const weekEnd = new Date(2026, 0, 11, 23, 59, 59); // Sun

  it('returns true for matching self_eval in self week', () => {
    const cards = [card({ eval_type: 'self_eval', submitted_at: '2026-01-07T15:00:00Z' })];
    expect(hasMetCadenceForWeek('Coach A', cards, weekStart, weekEnd, 'self')).toBe(true);
  });

  it('returns false when type does not match', () => {
    const cards = [card({ eval_type: 'formal_eval', submitted_at: '2026-01-07T15:00:00Z' })];
    expect(hasMetCadenceForWeek('Coach A', cards, weekStart, weekEnd, 'self')).toBe(false);
  });

  it('returns false when submitted one second before weekStart', () => {
    const sub = new Date(weekStart.getTime() - 1000).toISOString();
    const cards = [card({ submitted_at: sub })];
    expect(hasMetCadenceForWeek('Coach A', cards, weekStart, weekEnd, 'self')).toBe(false);
  });

  it('returns false when submitted one second after weekEnd', () => {
    const sub = new Date(weekEnd.getTime() + 1000).toISOString();
    const cards = [card({ submitted_at: sub })];
    expect(hasMetCadenceForWeek('Coach A', cards, weekStart, weekEnd, 'self')).toBe(false);
  });

  it('returns false when coach has no submissions', () => {
    expect(hasMetCadenceForWeek('Coach A', [], weekStart, weekEnd, 'self')).toBe(false);
  });
});

describe('cadenceStreakWeeks', () => {
  function makeWeeklyCards(coach: string, weeks: number, today: Date): FvScorecard[] {
    const out: FvScorecard[] = [];
    for (let i = 1; i <= weeks; i++) {
      const wkMon = new Date(today);
      wkMon.setDate(wkMon.getDate() - 7 * i + (1 - today.getDay() === -6 ? 0 : 0));
      // anchor to a midweek date in week i prior
      const anchor = new Date(today.getTime() - i * 7 * 86400000);
      const iso = getISOWeek(anchor);
      out.push(card({
        evaluatee_name: coach,
        eval_type: iso % 2 === 1 ? 'self_eval' : 'formal_eval',
        submitted_at: anchor.toISOString(),
      }));
    }
    return out;
  }

  it('returns 8 when met every week for 8 prior weeks', () => {
    const today = new Date(2026, 5, 15); // mid-June
    const cards = makeWeeklyCards('Coach A', 8, today);
    expect(cadenceStreakWeeks('Coach A', cards, today)).toBe(8);
  });

  it('returns 0 when most recent prior week was missed', () => {
    const today = new Date(2026, 5, 15);
    const cards = makeWeeklyCards('Coach A', 5, today).slice(1); // missing week -1
    expect(cadenceStreakWeeks('Coach A', cards, today)).toBe(0);
  });

  it('does not count current week (only prior weeks)', () => {
    const today = new Date(2026, 5, 15);
    // only current week submission
    const cards = [card({ evaluatee_name: 'Coach A', submitted_at: today.toISOString() })];
    expect(cadenceStreakWeeks('Coach A', cards, today)).toBe(0);
  });

  it('returns 0 with no scorecards', () => {
    expect(cadenceStreakWeeks('Coach A', [], new Date())).toBe(0);
  });

  it('safety cap prevents unbounded loops', () => {
    // Even with infinite matches, function must terminate at 104.
    const today = new Date();
    const cards = Array.from({ length: 200 }, (_, i) => {
      const d = new Date(today.getTime() - (i + 1) * 7 * 86400000);
      const iso = getISOWeek(d);
      return card({
        evaluatee_name: 'Coach A',
        eval_type: iso % 2 === 1 ? 'self_eval' : 'formal_eval',
        submitted_at: d.toISOString(),
      });
    });
    const streak = cadenceStreakWeeks('Coach A', cards, today);
    expect(streak).toBeLessThanOrEqual(105);
  });
});

describe('cadenceDotStatus', () => {
  it('returns met when current week obligation satisfied', () => {
    const today = new Date(2026, 0, 7); // ISO week 2 → formal
    const c = getCadenceForDate(today);
    const sub = new Date(c.weekStart.getTime() + 86400_000);
    const cards = [card({
      evaluatee_name: 'Coach A',
      eval_type: c.type === 'self' ? 'self_eval' : 'formal_eval',
      submitted_at: sub.toISOString(),
    })];
    expect(cadenceDotStatus('Coach A', cards, today)).toBe('met');
  });

  it('returns pending when current week unmet but last week met', () => {
    const today = new Date(2026, 0, 14); // Wed in week 3
    const cur = getCadenceForDate(today);
    const lastWk = new Date(today.getTime() - 7 * 86400_000);
    const lastCadence = getCadenceForDate(lastWk);
    const cards = [card({
      evaluatee_name: 'Coach A',
      eval_type: lastCadence.type === 'self' ? 'self_eval' : 'formal_eval',
      submitted_at: new Date(lastCadence.weekStart.getTime() + 86400_000).toISOString(),
    })];
    expect(cadenceDotStatus('Coach A', cards, today)).toBe('pending');
    // sanity — current week obligation type wasn't met
    expect(cur.type).toBeDefined();
  });

  it('returns missed when both current and last week unmet', () => {
    expect(cadenceDotStatus('Coach A', [], new Date(2026, 5, 15))).toBe('missed');
  });
});

describe('isSelfEvalEveryWeekThisMonth', () => {
  it('returns true when self-evaluated every Monday of month', () => {
    const today = new Date(2026, 0, 26); // Mon Jan 26 2026
    const cards: FvScorecard[] = [];
    // Weeks containing Jan 1, Jan 5, Jan 12, Jan 19, Jan 26
    [1, 5, 12, 19, 26].forEach(day => {
      cards.push(card({
        evaluatee_name: 'Coach A',
        eval_type: 'self_eval',
        submitted_at: new Date(2026, 0, day, 15).toISOString(),
      }));
    });
    expect(isSelfEvalEveryWeekThisMonth('Coach A', cards, today)).toBe(true);
  });

  it('returns false when one week is missed', () => {
    const today = new Date(2026, 0, 26);
    const cards = [5, 12, 26].map(day => card({
      evaluatee_name: 'Coach A',
      eval_type: 'self_eval',
      submitted_at: new Date(2026, 0, day, 15).toISOString(),
    }));
    expect(isSelfEvalEveryWeekThisMonth('Coach A', cards, today)).toBe(false);
  });

  it('formal evals do not disqualify when self also present every week', () => {
    const today = new Date(2026, 0, 26);
    const cards: FvScorecard[] = [];
    [1, 5, 12, 19, 26].forEach(day => {
      cards.push(card({ evaluatee_name: 'Coach A', eval_type: 'self_eval',   submitted_at: new Date(2026, 0, day, 15).toISOString() }));
      cards.push(card({ evaluatee_name: 'Coach A', eval_type: 'formal_eval', submitted_at: new Date(2026, 0, day, 16).toISOString() }));
    });
    expect(isSelfEvalEveryWeekThisMonth('Coach A', cards, today)).toBe(true);
  });

  it('handles month boundary on day 1', () => {
    const today = new Date(2026, 1, 1); // Sun Feb 1 — only one (partial) week so far
    const cards = [card({
      evaluatee_name: 'Coach A',
      eval_type: 'self_eval',
      submitted_at: new Date(2026, 1, 1, 10).toISOString(),
    })];
    expect(isSelfEvalEveryWeekThisMonth('Coach A', cards, today)).toBe(true);
  });
});
