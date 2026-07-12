/**
 * Canonical resolver for per-SA SOML goals.
 *
 * PERMANENCE NOTE: `soml_config` originated as "Summer of More Life"
 * campaign infrastructure, but Sales, Referral Leads, and Referrals goals
 * stored here are now the PERMANENT source of truth studio-wide — the
 * shift header, WIG SA leaderboard, SA Weekly Goals, SomlSection, and
 * derived Booked Intros target all read from here. Only `upgrades` remains
 * campaign-scoped and retires at month's end. Do not delete or rename this
 * table once the "Summer of More Life" name retires.
 *
 * SINGLE SOURCE OF TRUTH for "what is this SA's effective SOML target for
 * sales / referralLeads / referrals / upgrades this window?" — the SOML
 * section on the WIG page AND the shift header both read from here so
 * they can never diverge.
 *
 * Rules (mirror SomlSection):
 *   1. `soml_config` holds the window (start_date / end_date) and the
 *      TEAM totals for each metric.
 *   2. `soml_sa_goals` holds per-SA overrides. NULL = no override.
 *   3. The default per-SA target = (team goal − sum(overrides)) / (activeSAs − overriddenCount)
 *      — same "redistribute the remainder" logic as SomlSection.
 *   4. Koa is excluded from the SA roster (Admin).
 *
 * Never re-implement inline; call `useSomlEffectiveTargets()` and use
 * `effectiveFor(sa, metric)`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import { useSomlData, type SomlConfig } from '@/hooks/useSomlData';

export type SomlMetricKey = 'referrals' | 'upgrades' | 'sales' | 'referralLeads';

export const SOML_METRIC_TO_GOAL_COL: Record<SomlMetricKey, string> = {
  referrals: 'referrals_goal',
  upgrades: 'upgrades_goal',
  sales: 'sales_goal',
  referralLeads: 'referral_leads_goal',
};

interface SaOverride {
  sa_name: string;
  referrals_goal: number | null;
  upgrades_goal: number | null;
  sales_goal: number | null;
  referral_leads_goal: number | null;
}

export interface SomlEffectiveTargets {
  config: SomlConfig | null;
  rosterSas: string[];              // active SAs excluding Koa
  overrides: Record<string, SaOverride>;
  effectiveFor: (sa: string, metric: SomlMetricKey) => number;
  teamGoal: (metric: SomlMetricKey) => number;
  loading: boolean;
}

export function useSomlEffectiveTargets(): SomlEffectiveTargets {
  const { config, loading: somlLoading } = useSomlData();
  const { salesAssociates } = useActiveStaff();
  const [overrides, setOverrides] = useState<Record<string, SaOverride>>({});
  const [ovLoaded, setOvLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('soml_sa_goals')
      .select('sa_name, referrals_goal, upgrades_goal, sales_goal, referral_leads_goal');
    const map: Record<string, SaOverride> = {};
    ((data as SaOverride[]) || []).forEach(r => { map[r.sa_name] = r; });
    setOverrides(map);
    setOvLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  const rosterSas = useMemo(
    () => (salesAssociates || []).filter(n => n !== 'Koa'),
    [salesAssociates],
  );

  const goals: Record<SomlMetricKey, number> = useMemo(() => ({
    referrals: config?.referrals_goal ?? 0,
    upgrades: config?.upgrades_goal ?? 0,
    sales: config?.sales_goal ?? 0,
    referralLeads: config?.referral_leads_goal ?? 0,
  }), [config]);

  const defaultPerSa = useMemo<Record<SomlMetricKey, number>>(() => {
    const activeCount = rosterSas.length;
    const compute = (m: SomlMetricKey): number => {
      let sum = 0, count = 0;
      for (const sa of rosterSas) {
        const ov = overrides[sa];
        if (!ov) continue;
        const v = ov[SOML_METRIC_TO_GOAL_COL[m] as keyof SaOverride] as number | null;
        if (v != null) { sum += v; count += 1; }
      }
      const nonOverridden = activeCount - count;
      if (nonOverridden <= 0) return 0;
      const remaining = Math.max(0, goals[m] - sum);
      return remaining / nonOverridden;
    };
    return {
      referrals: compute('referrals'),
      upgrades: compute('upgrades'),
      sales: compute('sales'),
      referralLeads: compute('referralLeads'),
    };
  }, [rosterSas, overrides, goals]);

  const effectiveFor = useCallback((sa: string, metric: SomlMetricKey): number => {
    const ov = overrides[sa];
    const key = SOML_METRIC_TO_GOAL_COL[metric] as keyof SaOverride;
    if (ov && ov[key] != null) return ov[key] as number;
    return defaultPerSa[metric];
  }, [overrides, defaultPerSa]);

  const teamGoal = useCallback((metric: SomlMetricKey) => goals[metric], [goals]);

  return {
    config,
    rosterSas,
    overrides,
    effectiveFor,
    teamGoal,
    loading: somlLoading || !ovLoaded,
  };
}

/**
 * Compute pace anchor for a SOML window: today capped to [start, end].
 * Matches SomlSection's paceAnchor exactly.
 */
export function somlPaceAnchor(config: SomlConfig | null, now: Date): Date {
  if (!config) return now;
  const [sy, sm, sd] = config.start_date.split('-').map(Number);
  const [ey, em, ed] = config.end_date.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  if (now < start) return start;
  if (now > end) return end;
  return now;
}
