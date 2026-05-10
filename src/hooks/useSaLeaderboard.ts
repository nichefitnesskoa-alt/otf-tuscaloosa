import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  buildSaLeaderboard,
  type ShiftRow,
  type MilestoneRow,
  type ReferralAskRow,
  type SaLeaderboardRow,
} from '@/lib/sa/saStreaks';
import type { ShiftCoverageReport } from '@/lib/sa/coverage';

export interface SaLeaderboardData {
  rows: SaLeaderboardRow[];
  shifts: ShiftRow[];
  milestones: MilestoneRow[];
  referrals: ReferralAskRow[];
  coverageReports: ShiftCoverageReport[];
  loading: boolean;
}

/**
 * Loads everything needed to compute SA leaderboard + drill-downs for a date
 * range. Single source of truth for SA WIG, SA detail page, and drill-downs —
 * so a number on Page A always matches the same number on Page B.
 *
 * Note: streaks always look back from the most recent shift in the loaded set,
 * regardless of date filter. To preserve range-faithful streaks, callers that
 * need a long lookback should pass an extended fetch window via `streakLookbackDays`.
 */
export function useSaLeaderboard(
  rangeStart: string, // YYYY-MM-DD
  rangeEnd: string,
  streakLookbackDays = 30,
): SaLeaderboardData {
  const [data, setData] = useState<SaLeaderboardData>({
    rows: [],
    shifts: [],
    milestones: [],
    referrals: [],
    coverageReports: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setData(d => ({ ...d, loading: true }));
      // Streak window starts earlier so streak math is stable
      const streakStart = format(
        new Date(new Date(rangeStart).getTime() - streakLookbackDays * 86400_000),
        'yyyy-MM-dd',
      );
      const [shiftsRes, milestonesRes, referralsRes, coverageRes] = await Promise.all([
        supabase
          .from('shift_task_completions')
          .select('sa_name, shift_date, shift_type')
          .gte('shift_date', streakStart)
          .lte('shift_date', rangeEnd),
        supabase
          .from('milestones')
          .select('id, member_name, milestone_type, created_by, created_at, friend_name, five_class_pack_gifted')
          .eq('entry_type', 'milestone')
          .gte('created_at', streakStart)
          .lte('created_at', rangeEnd + 'T23:59:59'),
        supabase
          .from('intros_booked')
          .select('id, member_name, class_date, booked_by')
          .eq('coach_referral_asked', true)
          .gte('class_date', rangeStart)
          .lte('class_date', rangeEnd),
        (supabase as any)
          .from('shift_coverage_reports')
          .select('id, sa_name, shift_date, shift_type, milestones_celebrated, milestones_missed, notes')
          .gte('shift_date', rangeStart)
          .lte('shift_date', rangeEnd),
      ]);

      if (cancelled) return;

      const allShifts = (shiftsRes.data || []) as ShiftRow[];
      const allMilestones = (milestonesRes.data || []) as MilestoneRow[];
      const referrals = (referralsRes.data || []) as ReferralAskRow[];
      const coverageReports = (coverageRes.data || []) as ShiftCoverageReport[];

      // Filter to in-range for displayed counts; streaks use full window.
      const inRangeShifts = allShifts.filter(s => s.shift_date >= rangeStart);
      const inRangeMilestones = allMilestones.filter(m => m.created_at >= rangeStart);

      // Build leaderboard using IN-RANGE counts but pass FULL window to streaks
      const inRangeRows = buildSaLeaderboard(inRangeShifts, inRangeMilestones, referrals);
      const fullStreaks = buildSaLeaderboard(allShifts, allMilestones, referrals);
      const streakByName = new Map(fullStreaks.map(r => [r.name, r.streak]));
      const rows = inRangeRows.map(r => ({ ...r, streak: streakByName.get(r.name) ?? 0 }));

      setData({
        rows,
        shifts: inRangeShifts,
        milestones: inRangeMilestones,
        referrals,
        coverageReports,
        loading: false,
      });
    })();
    return () => { cancelled = true; };
  }, [rangeStart, rangeEnd, streakLookbackDays]);

  return data;
}
