// Referrals block for the Own It weekly export.
// - Total asks this week (Mon..Sun anchored to meeting Monday).
// - Members asked more than once in the trailing 30 days (flag list).
// - Members in the sales roster (intros_run.result_canon = 'SALE') who haven't
//   been asked in the trailing 90 days ("never asked recently").

import { supabase } from '@/integrations/supabase/client';

export interface ReferralsExportData {
  weekTotal: number;
  flagged: { name: string; count: number }[];
  neverAskedRecently: string[];
  rosterCount: number;
}

const DAY = 24 * 60 * 60 * 1000;

export async function fetchReferralsExportData(meetingDate: string): Promise<ReferralsExportData> {
  // Meeting Monday → previous-week window is the 7 days ending the day before the meeting.
  const meetingNoon = new Date(meetingDate + 'T12:00:00');
  const weekEnd = new Date(meetingNoon.getTime() - DAY);
  const weekStart = new Date(weekEnd.getTime() - 6 * DAY);
  const cutoff30 = new Date(meetingNoon.getTime() - 30 * DAY);
  const cutoff90 = new Date(meetingNoon.getTime() - 90 * DAY);

  // 1. Pull all asks within the trailing 90 days (covers all three calculations).
  const { data: askRows } = await supabase
    .from('referral_asks' as any)
    .select('member_name, asked_at')
    .gte('asked_at', cutoff90.toISOString());
  const asks = (askRows as any[]) || [];

  // Week total
  const weekTotal = asks.filter(a => {
    const t = new Date(a.asked_at).getTime();
    return t >= weekStart.getTime() && t <= weekEnd.getTime() + DAY;
  }).length;

  // 30-day per-member counts
  const thirtyDayCounts = new Map<string, number>();
  for (const a of asks) {
    if (new Date(a.asked_at) < cutoff30) continue;
    const key = (a.member_name as string).trim().toLowerCase();
    thirtyDayCounts.set(key, (thirtyDayCounts.get(key) ?? 0) + 1);
  }
  // Display name = most recent casing seen
  const displayName = new Map<string, string>();
  for (const a of asks) {
    const key = (a.member_name as string).trim().toLowerCase();
    if (!displayName.has(key)) displayName.set(key, (a.member_name as string).trim());
  }
  const flagged = Array.from(thirtyDayCounts.entries())
    .filter(([, c]) => c > 1)
    .map(([k, c]) => ({ name: displayName.get(k) ?? k, count: c }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  // 2. Sales roster: distinct member_name from intros_run where result_canon = 'SALE'.
  const { data: saleRows } = await supabase
    .from('intros_run')
    .select('member_name')
    .eq('result_canon', 'SALE');
  const rosterSet = new Map<string, string>();
  for (const r of (saleRows as any[]) || []) {
    const name = (r.member_name as string)?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!rosterSet.has(key)) rosterSet.set(key, name);
  }

  // Asked in trailing 90 days
  const askedKeys90 = new Set<string>();
  for (const a of asks) {
    askedKeys90.add((a.member_name as string).trim().toLowerCase());
  }

  const neverAskedRecently = Array.from(rosterSet.entries())
    .filter(([k]) => !askedKeys90.has(k))
    .map(([, name]) => name)
    .sort((a, b) => a.localeCompare(b));

  return {
    weekTotal,
    flagged,
    neverAskedRecently,
    rosterCount: rosterSet.size,
  };
}

export function renderReferralsBlock(d: ReferralsExportData): string {
  const out: string[] = [];
  out.push('════════ REFERRALS ════════');
  out.push('');
  out.push(`Total referral asks this week: ${d.weekTotal}`);
  out.push('');

  out.push(`Members asked more than once in the last 30 days: ${d.flagged.length}`);
  if (d.flagged.length) {
    for (const f of d.flagged) {
      out.push(`  • ${f.name} — ${f.count} asks`);
    }
  } else {
    out.push('  (none)');
  }
  out.push('');

  out.push(`Members not asked in the last 90 days: ${d.neverAskedRecently.length} of ${d.rosterCount} on roster`);
  if (d.neverAskedRecently.length) {
    // Cap the printed list at 50 to keep the export readable; show count remainder.
    const shown = d.neverAskedRecently.slice(0, 50);
    for (const n of shown) out.push(`  • ${n}`);
    if (d.neverAskedRecently.length > shown.length) {
      out.push(`  …and ${d.neverAskedRecently.length - shown.length} more.`);
    }
  } else {
    out.push('  (everyone on the roster has been asked recently)');
  }
  out.push('');
  out.push('Roster source: members with at least one SALE intro on file.');
  out.push('');

  return out.join('\n');
}
