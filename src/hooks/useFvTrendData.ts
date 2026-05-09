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

// Match WIG header: only NO_SHOW / UNRESOLVED / VIP_CLASS_INTRO are dropped from "ran" denominator.
const RAN_EXCLUDED = new Set(['NO_SHOW', 'UNRESOLVED', 'VIP_CLASS_INTRO']);

interface RanFirstIntro {
  bookingId: string;
  coach: string;
  closed: boolean;
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
  closingTiles: ClosingTile;
  unscoredCount: number;
  unscoredByCoach: Map<string, number>;
  scorecards: FvScorecard[];
  ranByCoach: Map<string, number>;
  formalByCoach: Map<string, { avg: number | null; count: number }>;
  selfByCoach: Map<string, { avg: number | null; count: number }>;
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
        .select('id, coach_name, originating_booking_id, is_vip, ignore_from_metrics, booking_status_canon, referred_by_member_name, member_name, paired_booking_id, converted_to_booking_id')
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

      // Pull runs for these bookings to filter to actually-ran intros.
      const ran = new Map<string, { coach: string; sale: boolean }>();
      for (let i = 0; i < ids.length; i += 500) {
        const batch = ids.slice(i, i + 500);
        const { data: runs } = await supabase
          .from('intros_run')
          .select('linked_intro_booked_id, coach_name, result_canon')
          .in('linked_intro_booked_id', batch);
        (runs || []).forEach((r: any) => {
          if (!r.linked_intro_booked_id) return;
          if (RAN_EXCLUDED.has(r.result_canon)) return;
          const b = valid.find((x: any) => x.id === r.linked_intro_booked_id);
          const coach = (r.coach_name || b?.coach_name || '').trim();
          if (!coach || /^tbd$/i.test(coach)) return;
          const existing = ran.get(r.linked_intro_booked_id);
          const sale = r.result_canon === 'SALE';
          if (!existing) ran.set(r.linked_intro_booked_id, { coach, sale });
          else if (sale && !existing.sale) ran.set(r.linked_intro_booked_id, { coach, sale: true });
        });
      }

      // Total Journey close: also flag close if a downstream 2nd intro chained from this booking ended in SALE.
      // Pull bookings where originating_booking_id is in our id set OR converted_to_booking_id matches.
      const { data: chained } = await supabase
        .from('intros_booked')
        .select('id, originating_booking_id')
        .in('originating_booking_id', ids);
      const childrenByOrigin = new Map<string, string[]>();
      (chained || []).forEach((c: any) => {
        if (!c.originating_booking_id) return;
        const arr = childrenByOrigin.get(c.originating_booking_id) || [];
        arr.push(c.id);
        childrenByOrigin.set(c.originating_booking_id, arr);
      });
      const allChildIds = (chained || []).map((c: any) => c.id);
      const childSales = new Set<string>();
      for (let i = 0; i < allChildIds.length; i += 500) {
        const batch = allChildIds.slice(i, i + 500);
        if (batch.length === 0) continue;
        const { data: childRuns } = await supabase
          .from('intros_run')
          .select('linked_intro_booked_id, result_canon')
          .in('linked_intro_booked_id', batch);
        (childRuns || []).forEach((r: any) => {
          if (r.result_canon === 'SALE' && r.linked_intro_booked_id) childSales.add(r.linked_intro_booked_id);
        });
      }

      const result: RanFirstIntro[] = [];
      ran.forEach((v, bookingId) => {
        let closed = v.sale;
        if (!closed) {
          const kids = childrenByOrigin.get(bookingId) || [];
          if (kids.some(k => childSales.has(k))) closed = true;
        }
        result.push({ bookingId, coach: v.coach, closed });
      });
      return result;
    },
  });

  const isLoading = scorecardsQuery.isLoading || ranQuery.isLoading;
  const cards = scorecardsQuery.data || [];
  const ran = ranQuery.data || [];

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
    const ranByCoach = new Map<string, number>();
    const formalByCoach = new Map<string, { sum: number; n: number }>();
    const selfByCoach = new Map<string, { sum: number; n: number }>();

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
      } else if (hasSelf) {
        cov.selfOnly.total++;
        if (r.closed) cov.selfOnly.closed++;
      } else {
        cov.unscored.total++;
        if (r.closed) cov.unscored.closed++;
        unscoredCount++;
        unscoredByCoach.set(r.coach, (unscoredByCoach.get(r.coach) || 0) + 1);
      }

      // Avg-closed / avg-not-closed (only when we have a primary score)
      if (primaryCard) {
        if (r.closed) { closedSum += primaryCard.total_score; closedN++; }
        else { notSum += primaryCard.total_score; notN++; }
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

    return {
      studioPoints,
      perCoachPoints,
      closingTiles,
      unscoredCount,
      unscoredByCoach,
      scorecards: cards,
      ranByCoach,
      formalByCoach: formalAvg,
      selfByCoach: selfAvg,
    };
  }, [cards, ran, range, primary, smoothed]);

  return { data, isLoading, refetch: () => { scorecardsQuery.refetch(); ranQuery.refetch(); } };
}
