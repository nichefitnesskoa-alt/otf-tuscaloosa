/**
 * Canonical resolver for per-SA monthly SGL (self-generated leads) targets.
 *
 * SINGLE SOURCE OF TRUTH for "what is this SA's effective SGL target this
 * month?". WigSaLeaderboard, ShiftOutcomeHeader, SaWeeklyGoals and any
 * other surface that displays an SA's SGL goal MUST read from here so they
 * can never diverge.
 *
 * Rules (mirror the original WigSaLeaderboard math extracted from lines
 * 200–243, kept faithful):
 *   1. Team SGL goal is LOCKED at (global per-SA target × active SA count).
 *      Individual overrides never lower the team goal.
 *   2. If an SA has a per-SA override in studio_settings
 *      (`sa_sgl_target:YYYY-MM:<sa>`), that value wins for that SA.
 *   3. All non-overridden SAs split the remaining shortfall equally, so the
 *      team total still hits the monthly goal:
 *        remaining     = max(0, teamGoal − sum(overrides))
 *        redistributed = remaining / (activeCount − overriddenCount)
 *   4. Koa is excluded from the SA roster.
 *
 * Never re-implement inline; call `useEffectiveSglTargets(yyyymm)` and use
 * `effectiveFor(sa)`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import {
  loadMonthlyTargets,
  loadPerSaOverrides,
  type MonthlyTargets,
} from '@/lib/wig/targets';

export interface EffectiveSglTargets {
  /** Global per-SA monthly SGL target (studio_settings.sa_sgl_target:YYYY-MM). */
  perSaGlobal: number | null;
  /** Team SGL goal = perSaGlobal × activeCount. Null if perSaGlobal unset. */
  teamGoal: number | null;
  /** Per-SA overrides map (sa → integer target). */
  overrides: Record<string, number>;
  /** Redistributed per-SA target for non-overridden SAs. Null if unset. */
  redistributedPerSa: number | null;
  /** Effective per-SA target: override wins, else redistributed default. */
  effectiveFor: (sa: string) => number | null;
  /** Active SA roster (excluding Koa). */
  rosterSas: string[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function computeRedistributedPerSa(
  perSaGlobal: number | null,
  rosterSas: string[],
  overrides: Record<string, number>,
): { teamGoal: number | null; redistributedPerSa: number | null; overrideSum: number; overrideCount: number } {
  const activeCount = rosterSas.length;
  if (perSaGlobal == null || activeCount === 0) {
    return { teamGoal: null, redistributedPerSa: null, overrideSum: 0, overrideCount: 0 };
  }
  const teamGoal = perSaGlobal * activeCount;
  let overrideSum = 0;
  let overrideCount = 0;
  for (const sa of rosterSas) {
    if (Object.prototype.hasOwnProperty.call(overrides, sa)) {
      overrideSum += overrides[sa] || 0;
      overrideCount += 1;
    }
  }
  const nonOverridden = activeCount - overrideCount;
  if (nonOverridden <= 0) {
    return { teamGoal, redistributedPerSa: 0, overrideSum, overrideCount };
  }
  const remaining = Math.max(0, teamGoal - overrideSum);
  return { teamGoal, redistributedPerSa: remaining / nonOverridden, overrideSum, overrideCount };
}

export function useEffectiveSglTargets(yyyymm: string): EffectiveSglTargets {
  const { salesAssociates } = useActiveStaff();
  const [targets, setTargets] = useState<MonthlyTargets>({
    saSgl: null, saBooked: null, saSales: null, coachClose: null, studioLeads: null, netGain: null,
  });
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const [t, ov] = await Promise.all([
      loadMonthlyTargets(yyyymm),
      loadPerSaOverrides(yyyymm),
    ]);
    setTargets(t);
    setOverrides(ov);
    setLoaded(true);
  }, [yyyymm]);

  useEffect(() => { refresh(); }, [refresh]);

  const rosterSas = useMemo(
    () => (salesAssociates || []).filter(n => n !== 'Koa'),
    [salesAssociates],
  );

  const { teamGoal, redistributedPerSa } = useMemo(
    () => computeRedistributedPerSa(targets.saSgl, rosterSas, overrides),
    [targets.saSgl, rosterSas, overrides],
  );

  const effectiveFor = useCallback(
    (sa: string): number | null => {
      if (Object.prototype.hasOwnProperty.call(overrides, sa)) return overrides[sa];
      if (redistributedPerSa != null) return redistributedPerSa;
      return targets.saSgl;
    },
    [overrides, redistributedPerSa, targets.saSgl],
  );

  return {
    perSaGlobal: targets.saSgl,
    teamGoal,
    overrides,
    redistributedPerSa,
    effectiveFor,
    rosterSas,
    loading: !loaded,
    refresh,
  };
}
