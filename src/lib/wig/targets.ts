/**
 * Canonical monthly target loader/saver for the WIG scoreboard.
 *
 * All WIG numbers (hero, leaderboard, Own It tile, coach close-rate)
 * read targets through this module — never via ad-hoc supabase calls
 * and never with hardcoded fallback numbers. A missing setting returns
 * `null`; the UI must render "CONFIRM THIS VALUE" rather than guess.
 *
 * Keys (all month-scoped, YYYY-MM):
 *   sa_sgl_target:YYYY-MM           per-SA self-generated leads target
 *   sa_leads_booked_target:YYYY-MM  per-SA booked-intros target
 *   sa_sales_target:YYYY-MM         per-SA sales target
 *   coach_close_rate_target:YYYY-MM coach close-rate % target (0-100)
 *   studio_leads_target:YYYY-MM     studio total leads (context line)
 *
 * Legacy `wig_lead_target:YYYY-MM` and global `wig_lead_target` are
 * read through one cycle for the studio-leads target.
 */
import { supabase } from '@/integrations/supabase/client';
import { notifyDataChanged } from '@/lib/data/invalidation';

export const TARGET_KEYS = {
  saSgl: 'sa_sgl_target',
  saBooked: 'sa_leads_booked_target',
  saSales: 'sa_sales_target',
  coachClose: 'coach_close_rate_target',
  studioLeads: 'studio_leads_target',
} as const;

export type TargetKind = keyof typeof TARGET_KEYS;

export interface MonthlyTargets {
  saSgl: number | null;
  saBooked: number | null;
  saSales: number | null;
  coachClose: number | null;
  studioLeads: number | null;
}

function parseIntOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = parseInt(String(v), 10);
  return isNaN(n) ? null : n;
}

export function monthKey(kind: TargetKind, yyyymm: string): string {
  return `${TARGET_KEYS[kind]}:${yyyymm}`;
}

/** Loads all five monthly targets for a given YYYY-MM. Null = unset. */
export async function loadMonthlyTargets(yyyymm: string): Promise<MonthlyTargets> {
  const keys = [
    monthKey('saSgl', yyyymm),
    monthKey('saBooked', yyyymm),
    monthKey('saSales', yyyymm),
    monthKey('coachClose', yyyymm),
    monthKey('studioLeads', yyyymm),
    // legacy fallbacks for studio leads only
    `wig_lead_target:${yyyymm}`,
    'wig_lead_target',
  ];
  const { data } = await supabase
    .from('studio_settings')
    .select('setting_key, setting_value')
    .in('setting_key', keys);
  const map = new Map(((data as any[]) || []).map(r => [r.setting_key, r.setting_value]));

  const studio =
    parseIntOrNull(map.get(monthKey('studioLeads', yyyymm))) ??
    parseIntOrNull(map.get(`wig_lead_target:${yyyymm}`)) ??
    parseIntOrNull(map.get('wig_lead_target'));

  return {
    saSgl: parseIntOrNull(map.get(monthKey('saSgl', yyyymm))),
    saBooked: parseIntOrNull(map.get(monthKey('saBooked', yyyymm))),
    saSales: parseIntOrNull(map.get(monthKey('saSales', yyyymm))),
    coachClose: parseIntOrNull(map.get(monthKey('coachClose', yyyymm))),
    studioLeads: studio,
  };
}

export async function saveMonthlyTarget(
  kind: TargetKind,
  yyyymm: string,
  value: number,
  updatedBy: string,
): Promise<{ error: Error | null }> {
  const key = monthKey(kind, yyyymm);
  const { error } = await supabase
    .from('studio_settings')
    .upsert(
      {
        setting_key: key,
        setting_value: String(value),
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: 'setting_key' },
    );
  if (!error) {
    notifyDataChanged([TARGET_KEYS[kind], 'wig_targets'], `${TARGET_KEYS[kind]}-edit`);
  }
  return { error: (error as any) || null };
}
