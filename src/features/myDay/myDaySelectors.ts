/**
 * Pure selectors for My Day: risk scoring, sorting, grouping, filtering.
 */
import { format, parseISO } from 'date-fns';
import type { UpcomingIntroItem, RiskFlags, DayGroup, RiskCategory } from './myDayTypes';

// ── Risk Weights (kept for internal "needs attention" pill logic) ──

const RISK_WEIGHTS: Record<keyof RiskFlags, number> = {
  noQ: 100,
  qIncomplete: 70,
  unconfirmed: 50,
  coachTbd: 20,
  missingOwner: 15,
};

// ── Risk Computation ──

export function computeRiskFlags(item: UpcomingIntroItem, nowISO: string): RiskFlags {
  const isWithin24h = item.timeStartISO <= new Date(new Date(nowISO).getTime() + 24 * 60 * 60 * 1000).toISOString();
  return {
    noQ: item.questionnaireStatus === 'NO_Q',
    qIncomplete: item.questionnaireStatus === 'Q_SENT',
    unconfirmed: item.confirmedAt === null && isWithin24h,
    coachTbd: !item.coachName || item.coachName === 'TBD',
    missingOwner: !item.introOwner || item.introOwner.trim() === '',
  };
}

export function computeRiskScore(flags: RiskFlags): number {
  let score = 0;
  for (const key of Object.keys(flags) as (keyof RiskFlags)[]) {
    if (flags[key]) score += RISK_WEIGHTS[key];
  }
  return score;
}

export function enrichWithRisk(items: UpcomingIntroItem[], nowISO: string): UpcomingIntroItem[] {
  return items.map(item => {
    const riskFlags = computeRiskFlags(item, nowISO);
    const riskScore = computeRiskScore(riskFlags);
    return { ...item, riskFlags, riskScore };
  });
}

// ── Sorting: by date then time then name (calm, chronological) ──

export function sortByTime(items: UpcomingIntroItem[]): UpcomingIntroItem[] {
  return [...items].sort((a, b) => {
    if (a.classDate !== b.classDate) return a.classDate.localeCompare(b.classDate);
    if (a.introTime !== b.introTime) {
      if (!a.introTime) return 1;
      if (!b.introTime) return -1;
      return a.introTime.localeCompare(b.introTime);
    }
    return a.memberName.localeCompare(b.memberName);
  });
}

/** @deprecated Use sortByTime instead */
export function sortRiskFirst(items: UpcomingIntroItem[]): UpcomingIntroItem[] {
  return sortByTime(items);
}

// ── Grouping by day ──

export function groupByDay(items: UpcomingIntroItem[]): DayGroup[] {
  const groups = new Map<string, UpcomingIntroItem[]>();

  for (const item of items) {
    const existing = groups.get(item.classDate) || [];
    existing.push(item);
    groups.set(item.classDate, existing);
  }

  const result: DayGroup[] = [];
  const sortedDates = [...groups.keys()].sort();
  for (const date of sortedDates) {
    const dayItems = groups.get(date)!;
    // Q ratio uses only 1st intros — 2nd intros and VIP Class intros don't need questionnaires
    const firstIntros = dayItems.filter(i => !i.isSecondIntro && !i.isVipClassIntro);
    const qSentOrDone = firstIntros.filter(i => i.questionnaireStatus !== 'NO_Q').length;
    result.push({
      date,
      label: formatDayLabel(date),
      items: dayItems,
      qSentRatio: firstIntros.length > 0 ? qSentOrDone / firstIntros.length : 1,
    });
  }

  return result;
}

function formatDayLabel(dateStr: string): string {
  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');
  if (dateStr === today) return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';
  return format(parseISO(dateStr), 'EEEE, MMM d');
}

// ── Bulk filtering helpers ──

export function filterNoQ(items: UpcomingIntroItem[]): UpcomingIntroItem[] {
  return items.filter(i => i.questionnaireStatus === 'NO_Q' && !i.isSecondIntro && !i.isVipClassIntro);
}

export function filterUnconfirmed24h(items: UpcomingIntroItem[], nowISO: string): UpcomingIntroItem[] {
  const cutoff = new Date(new Date(nowISO).getTime() + 24 * 60 * 60 * 1000).toISOString();
  return items.filter(i => i.confirmedAt === null && i.timeStartISO <= cutoff);
}

export function filterMissingOwner(items: UpcomingIntroItem[]): UpcomingIntroItem[] {
  return items.filter(i => !i.introOwner || i.introOwner.trim() === '');
}

// ── Suggested focus (calm language) ──

export function getSuggestedFocus(items: UpcomingIntroItem[]): string {
  const counts: Record<RiskCategory, number> = {
    noQ: 0, qIncomplete: 0, unconfirmed: 0, coachTbd: 0, missingOwner: 0,
  };
  for (const item of items) {
    for (const key of Object.keys(counts) as RiskCategory[]) {
      if (item.riskFlags[key]) counts[key]++;
    }
  }
  
  const sorted = (Object.entries(counts) as [RiskCategory, number][])
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  if (sorted.length === 0) return 'All prepped! 🎉';

  const [topKey, topCount] = sorted[0];
  const labels: Record<RiskCategory, string> = {
    noQ: `Send ${topCount} questionnaire${topCount > 1 ? 's' : ''}`,
    qIncomplete: `${topCount} not answered yet`,
    unconfirmed: `Confirm ${topCount} intro${topCount > 1 ? 's' : ''}`,
    coachTbd: `Assign coaches (${topCount})`,
    missingOwner: `Assign owners (${topCount})`,
  };
  return labels[topKey];
}

// ── At-Risk counts (kept for internal use) ──

export function getAtRiskCounts(items: UpcomingIntroItem[]): Record<RiskCategory, number> {
  const counts: Record<RiskCategory, number> = {
    noQ: 0, qIncomplete: 0, unconfirmed: 0, coachTbd: 0, missingOwner: 0,
  };
  for (const item of items) {
    for (const key of Object.keys(counts) as RiskCategory[]) {
      if (item.riskFlags[key]) counts[key]++;
    }
  }
  return counts;
}
