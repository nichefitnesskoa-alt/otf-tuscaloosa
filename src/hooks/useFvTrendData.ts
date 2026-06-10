/**
 * Single React Query hook that powers the WIG First Visit Experience section.
 *
 * Fetches scorecards + the matching ran first-intro bookings (with their
 * intros_run rows + sales) for the active date range and returns ready-to-use
 * studio + per-coach trend data, closing-score tiles, and unscored counts.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { FvScorecard } from '@/hooks/useScorecards';
import {
  pickPrimaryScorecards,
  buildTrendPoints,
  pickBucketSize,
  applyMovingAverage,
  type EvalPrimary,
  type TrendPoint,
} from '@/lib/scorecard/trends';
import type { DateRange } from '@/lib/pay-period';
import { resolveClosedFirstIntroIds } from '@/lib/intros/close-detection';
import { NON_RAN_RESULT_CANONS } from '@/lib/canon/introRules';

interface RanFirstIntro {
  bookingId: string;
  coach: string;
  closed: boolean;
  memberName: string;
  classDate: string;
  introTime: string | null;
}

export interface UnscoredIntro {
  bookingId: string;
  coach: string;
  memberName: string;
  classDate: string;
  introTime: string | null;
}

export interface ClosingTile {
  avgClosed: number | null;
  closedCount: number;
  avgNotClosed: number | null;
  notClosedCount: number;
  coverage: {
    formal: { closed: number; total: number };
    selfOnly: { closed: number; total: number };
    unscored: { closed: number; total: number };
  };
}

export interface FvTrendData {
  studioPoints: TrendPoint[];
  perCoachPoints: Map<string, TrendPoint[]>;
  closedPoints: TrendPoint[];
  notClosedPoints: TrendPoint[];
  closingTiles: ClosingTile;
  unscoredCount: number;
  unscoredByCoach: Map<string, number>;
  unscoredIntros: UnscoredIntro[];
  scorecards: FvScorecard[];
  ranByCoach: Map<string, number>;
  formalByCoach: Map<string, { avg: number | null; count: number }>;
  selfByCoach: Map<string, { avg: number | null; count: number }>;
  closedCards: FvScorecard[];
  notClosedCards: FvScorecard[];
  coverageCards: {
    formal: FvScorecard[];
    selfOnly: FvScorecard[];
  };
}

export function useFvTrendData(range: DateRange, primary: EvalPrimary, smoothed: boolean) {
  const from = format(range.start, 'yyyy-MM-dd');
  const to = format(range.end, 'yyyy-MM-dd');

  // Scorecards in the range.
  const scorecardsQuery = useQuery({
    queryKey: ['fv_trend_scorecards', from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fv_scorecards' as any)
        .select('*')
        .gte('class_date', from)
        .lte('class_date', to)
        .order('class_date', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as FvScorecard[];
    },
  });

  // Ran first-intro bookings in the range with close detection.
  const ranQuery = useQuery({
    queryKey: ['fv_trend_ran_first_intros', from, to],
    queryFn: async () => {
      const { data: bookings } = await supabase
        .from('intros_booked')
        .select('id, coach_name, originating_booking_id, is_vip, ignore_from_metrics, booking_status_canon, referred_by_member_name, member_name, class_date, intro_time, paired_booking_id, converted_to_booking_id')
        .gte('class_date', from)
        .lte('class_date', to)
        .is('deleted_at', null);

      const valid = (bookings || []).filter((b: any) => {
        if (b.is_vip || b.ignore_from_metrics) return false;
        const s = (b.booking_status_canon || '').toUpperCase();
        if (s === 'DELETED_SOFT') return false;
        return !b.originating_booking_id || !!b.referred_by_member_name;
      });

      const ids = valid.map((b: any) => b.id);
      if (ids.length === 0) return [] as RanFirstIntro[];

      const ran = new Map<string, { coach: string; booking: any }>();
      for (let i = 0; i < ids.length; i += 500) {
        const batch = ids.slice(i, i + 500);
        const { data: runs } = await supabase
          .from('intros_run')
          .select('linked_intro_booked_id, coach_name, result_canon')
          .in('linked_intro_booked_id', batch);
        (runs || []).forEach((r: any) => {
          if (!r.linked_intro_booked_id) return;
          if (NON_RAN_RESULT_CANONS.has((r.result_canon || '').toUpperCase())) return;
          const b = valid.find((x: any) => x.id === r.linked_intro_booked_id);
          // Fall back to booking.coach_name when run.coach_name is blank OR 'TBD'
          // (run rows are often left at TBD when the SA who logged the run didn't update the coach).
          const rawRun = (r.coach_name || '').trim();
          const coachFromRun = rawRun && !/^tbd$/i.test(rawRun) ? rawRun : '';
          const rawBooking = (b?.coach_name || '').trim();
          const coachFromBooking = rawBooking && !/^tbd$/i.test(rawBooking) ? rawBooking : '';
          const coach = coachFromRun || coachFromBooking;
          if (!coach) return;
          if (!ran.has(r.linked_intro_booked_id)) ran.set(r.linked_intro_booked_id, { coach, booking: b });
        });
      }

      const closedIds = await resolveClosedFirstIntroIds(Array.from(ran.keys()));

      const result: RanFirstIntro[] = [];
      ran.forEach((v, bookingId) => {
        result.push({
          bookingId,
          coach: v.coach,
          closed: closedIds.has(bookingId),
          memberName: v.booking?.member_name || 'Unknown',
          classDate: v.booking?.class_date || '',
          introTime: v.booking?.intro_time || null,
        });
      });
      return result;
    },
  });

  // Buy-date-anchored back-fill for "Avg Score · Closed":
  // any 1st-intro whose chain produced a SALE with buy_date in range,
  // regardless of whether the 1st intro's class_date sits inside range.
  const closedByBuyDateQuery = useQuery({
    queryKey: ['fv_trend_closed_by_buy_date', from, to],
    queryFn: async () => {
      const { data: saleRuns } = await supabase
        .from('intros_run')
        .select('linked_intro_booked_id')
        .gte('buy_date', from)
        .lte('buy_date', to)
        .in('result_canon', ['SALE', 'PREMIER', 'PREMIER_OTBEAT', 'ELITE', 'BASIC']);
      const ids = Array.from(new Set((saleRuns || []).map((r: any) => r.linked_intro_booked_id).filter(Boolean)));
      if (ids.length === 0) return new Set<string>();

      const known = new Map<string, any>();
      let frontier = ids;
      while (frontier.length) {
        const missing = frontier.filter(id => !known.has(id));
        if (!missing.length) break;
        const { data: rows } = await supabase
          .from('intros_booked')
          .select('id, originating_booking_id, is_vip, ignore_from_metrics, booking_status_canon, deleted_at')
          .in('id', missing);
        (rows || []).forEach((r: any) => known.set(r.id, r));
        frontier = (rows || []).map((r: any) => r.originating_booking_id).filter(Boolean);
      }

      const roots = new Set<string>();
      const findRoot = (id: string): any => {
        let cur = known.get(id);
        while (cur && cur.originating_booking_id && known.has(cur.originating_booking_id)) {
          cur = known.get(cur.originating_booking_id);
        }
        return cur;
      };
      ids.forEach(id => {
        const root = findRoot(id);
        if (!root) return;
        if (root.deleted_at) return;
        if (root.ignore_from_metrics) return;
        if ((root.booking_status_canon || '').toUpperCase() === 'DELETED_SOFT') return;
        roots.add(root.id);
      });
      return roots;
    },
  });

  // Extra scorecards for buy-date-anchored closed bookings whose class_date
  // sits outside the active range — needed so "Avg Score · Closed" reflects them.
  const extraIds = useMemo(
    () => Array.from(closedByBuyDateQuery.data || new Set<string>()),
    [closedByBuyDateQuery.data]
  );
  const extraClosedScorecardsQuery = useQuery({
    queryKey: ['fv_trend_extra_closed_scorecards', extraIds.sort().join(',')],
    enabled: extraIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('fv_scorecards' as any)
        .select('*')
        .in('first_timer_id', extraIds);
      return (data || []) as unknown as FvScorecard[];
    },
  });

  const isLoading = scorecardsQuery.isLoading || ranQuery.isLoading;
  const cards = scorecardsQuery.data || [];
  const ran = ranQuery.data || [];
  const closedRootsByBuyDate = closedByBuyDateQuery.data || new Set<string>();
  const extraClosedScorecards = extraClosedScorecardsQuery.data || [];

  const data = useMemo<FvTrendData>(() => {
    const primaryCards = pickPrimaryScorecards(cards, primary);

    // Studio trend.
    const size = pickBucketSize(range);
    let studioPoints = buildTrendPoints(primaryCards, range, size);
    if (smoothed) studioPoints = applyMovingAverage(studioPoints, 4);

    // Per-coach trend (one set per coach who has ran intros or scorecards).
    const coachSet = new Set<string>();
    ran.forEach(r => coachSet.add(r.coach));
    primaryCards.forEach(c => c.evaluatee_name && coachSet.add(c.evaluatee_name));
    const perCoachPoints = new Map<string, TrendPoint[]>();
    coachSet.forEach(coach => {
      const coachCards = primaryCards.filter(c => c.evaluatee_name === coach);
      let pts = buildTrendPoints(coachCards, range, size);
      if (smoothed) pts = applyMovingAverage(pts, 4);
      perCoachPoints.set(coach, pts);
    });

    // Closing tiles: bucket each ran intro by primary scorecard presence.
    const cardByTimer = new Map<string, FvScorecard>();
    primaryCards.forEach(c => { if (c.first_timer_id) cardByTimer.set(c.first_timer_id, c); });

    // Coverage: separate "has formal" vs "self only" vs "unscored" for ran intros.
    const allCardsByTimer = new Map<string, FvScorecard[]>();
    cards.filter(c => c.submitted_at && c.first_timer_id).forEach(c => {
      const arr = allCardsByTimer.get(c.first_timer_id!) || [];
      arr.push(c);
      allCardsByTimer.set(c.first_timer_id!, arr);
    });

    let closedSum = 0, closedN = 0, notSum = 0, notN = 0;
    const cov = {
      formal: { closed: 0, total: 0 },
      selfOnly: { closed: 0, total: 0 },
      unscored: { closed: 0, total: 0 },
    };
    let unscoredCount = 0;
    const unscoredByCoach = new Map<string, number>();
    const unscoredIntros: UnscoredIntro[] = [];
    const ranByCoach = new Map<string, number>();
    const formalByCoach = new Map<string, { sum: number; n: number }>();
    const selfByCoach = new Map<string, { sum: number; n: number }>();
    const closedCards: FvScorecard[] = [];
    const notClosedCards: FvScorecard[] = [];
    const coverageCards = {
      formal: [] as FvScorecard[],
      selfOnly: [] as FvScorecard[],
    };

    ran.forEach(r => {
      ranByCoach.set(r.coach, (ranByCoach.get(r.coach) || 0) + 1);
      const all = allCardsByTimer.get(r.bookingId) || [];
      const hasFormal = all.some(c => c.eval_type === 'formal_eval');
      const hasSelf = all.some(c => c.eval_type === 'self_eval');
      const primaryCard = cardByTimer.get(r.bookingId);

      // Coverage bucket
      if (hasFormal) {
        cov.formal.total++;
        if (r.closed) cov.formal.closed++;
        if (primaryCard) coverageCards.formal.push(primaryCard);
      } else if (hasSelf) {
        cov.selfOnly.total++;
        if (r.closed) cov.selfOnly.closed++;
        if (primaryCard) coverageCards.selfOnly.push(primaryCard);
      } else {
        cov.unscored.total++;
        if (r.closed) cov.unscored.closed++;
        unscoredCount++;
        unscoredByCoach.set(r.coach, (unscoredByCoach.get(r.coach) || 0) + 1);
        unscoredIntros.push({
          bookingId: r.bookingId,
          coach: r.coach,
          memberName: r.memberName,
          classDate: r.classDate,
          introTime: r.introTime,
        });
      }

      // Avg-closed / avg-not-closed (only when we have a primary score)
      if (primaryCard) {
        if (r.closed) { closedSum += primaryCard.total_score; closedN++; closedCards.push(primaryCard); }
        else { notSum += primaryCard.total_score; notN++; notClosedCards.push(primaryCard); }
      }

      // Per-coach formal/self averages
      all.forEach(c => {
        if (c.eval_type === 'formal_eval') {
          const cur = formalByCoach.get(r.coach) || { sum: 0, n: 0 };
          cur.sum += c.total_score; cur.n++;
          formalByCoach.set(r.coach, cur);
        } else if (c.eval_type === 'self_eval') {
          const cur = selfByCoach.get(r.coach) || { sum: 0, n: 0 };
          cur.sum += c.total_score; cur.n++;
          selfByCoach.set(r.coach, cur);
        }
      });
    });

    // Buy-date back-fill: include scored 1st intros whose chain closed in range
    // even if the 1st intro's class_date (and its scorecard) is outside range.
    const alreadyClosedIds = new Set(closedCards.map(c => c.first_timer_id).filter(Boolean) as string[]);
    const extraByTimer = new Map<string, FvScorecard[]>();
    extraClosedScorecards.forEach(c => {
      if (!c.first_timer_id || !c.submitted_at) return;
      const arr = extraByTimer.get(c.first_timer_id) || [];
      arr.push(c);
      extraByTimer.set(c.first_timer_id, arr);
    });
    closedRootsByBuyDate.forEach(rootId => {
      if (alreadyClosedIds.has(rootId)) return;
      const all = extraByTimer.get(rootId) || [];
      if (all.length === 0) return;
      const picked = pickPrimaryScorecards(all, primary);
      const card = picked[0];
      if (!card) return;
      closedSum += card.total_score;
      closedN++;
      closedCards.push(card);
    });

    const closingTiles: ClosingTile = {
      avgClosed: closedN ? closedSum / closedN : null,
      closedCount: closedN,
      avgNotClosed: notN ? notSum / notN : null,
      notClosedCount: notN,
      coverage: cov,
    };

    const formalAvg = new Map<string, { avg: number | null; count: number }>();
    formalByCoach.forEach((v, k) => formalAvg.set(k, { avg: v.n ? v.sum / v.n : null, count: v.n }));
    const selfAvg = new Map<string, { avg: number | null; count: number }>();
    selfByCoach.forEach((v, k) => selfAvg.set(k, { avg: v.n ? v.sum / v.n : null, count: v.n }));

    // Closed vs not-closed trend lines (only scorecards whose ran intro
    // resolved to closed/not-closed; pending intros excluded).
    let closedPoints = buildTrendPoints(closedCards, range, size);
    let notClosedPoints = buildTrendPoints(notClosedCards, range, size);
    if (smoothed) {
      closedPoints = applyMovingAverage(closedPoints, 4);
      notClosedPoints = applyMovingAverage(notClosedPoints, 4);
    }

    return {
      studioPoints,
      perCoachPoints,
      closedPoints,
      notClosedPoints,
      closingTiles,
      unscoredCount,
      unscoredByCoach,
      unscoredIntros,
      scorecards: cards,
      ranByCoach,
      formalByCoach: formalAvg,
      selfByCoach: selfAvg,
      closedCards,
      notClosedCards,
      coverageCards,
    };
  }, [cards, ran, range, primary, smoothed, closedRootsByBuyDate, extraClosedScorecards]);

  return { data, isLoading, refetch: () => { scorecardsQuery.refetch(); ranQuery.refetch(); } };
}
