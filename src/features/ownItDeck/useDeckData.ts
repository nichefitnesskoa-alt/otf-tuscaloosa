/**
 * useDeckData — fans out to every data source the Own It deck needs.
 * Scope: current calendar month in America/Chicago + current Own It meeting.
 *
 * Reuses canonical helpers/hooks; no new business logic.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isSglLeadSource } from '@/lib/metrics/sglClassification';
import { isSaleCanon, getRunSaleDate, isPostDatedSale } from '@/lib/sales-detection';
import { didIntroActuallyRun } from '@/lib/canon/introRules';
import { loadMonthlyTargets, type MonthlyTargets } from '@/lib/wig/targets';
import {
  useCurrentMeeting, useActiveOwners, useOwnerEntries, useActionItems, nextMondayCT,
  type OwnerEntry,
} from '@/hooks/useTheTable';
import { useSomlData } from '@/hooks/useSomlData';

// ── CT date helpers ───────────────────────────────────────────
export function currentMonthCST() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const y = +parts.find(p => p.type === 'year')!.value;
  const m = +parts.find(p => p.type === 'month')!.value;
  const d = +parts.find(p => p.type === 'day')!.value;
  const monthKey = `${y}-${String(m).padStart(2, '0')}`;
  const startYMD = `${monthKey}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const endYMD = `${monthKey}-${String(lastDay).padStart(2, '0')}`;
  return { monthKey, startYMD, endYMD, todayYMD: `${monthKey}-${String(d).padStart(2,'0')}`, year: y, month: m, day: d, lastDay };
}

export interface FunnelStats {
  leads: number;
  booked: number;
  showed: number;
  sold: number;
  bySource: Array<{ source: string; count: number }>;
  rows: any[]; // underlying intros_booked rows (for drilldown)
}

interface DeckBookingRow {
  id: string;
  member_name: string | null;
  lead_source: string | null;
  booking_status_canon: string | null;
  class_date: string | null;
  created_at: string;
  coach_name: string | null;
  originating_booking_id: string | null;
  deleted_at: string | null;
  ignore_from_metrics: boolean | null;
  intro_owner: string | null;
}

interface DeckRunRow {
  id: string;
  result_canon: string | null;
  result: string | null;
  buy_date: string | null;
  linked_intro_booked_id: string | null;
  coach_name: string | null;
  ignore_from_metrics: boolean | null;
  member_name: string | null;
  run_date: string | null;
  created_at: string;
}

export interface CoachRow {
  name: string;
  runs: number;
  sales: number;
  closePct: number | null;
  firstRuns: number;
  secondRuns: number;
}

export interface PendingChurn {
  id: string;
  member_name: string;
  churn_date: string;
  notes: string | null;
}

export interface LeadRow {
  id: string;
  name: string;
  source: string | null;
  created_at: string;
}

function monthIsoBoundsCT(startYMD: string, endYMD: string) {
  return {
    // Current studio is Central Time. These explicit offsets avoid the prior
    // bare `YYYY-MM-DDT...` bounds that the database treated inconsistently.
    startIso: new Date(`${startYMD}T00:00:00-06:00`).toISOString(),
    endIso: new Date(`${endYMD}T23:59:59-05:00`).toISOString(),
  };
}

export interface OwnerFull {
  id: string;
  staff_id: string;
  display_name: string;
  lane_name: string | null;
  category: string | null;
  entry: OwnerEntry | null;
  submitted: boolean;
  priorEntry: OwnerEntry | null;    // full prior meeting entry (fallback for owners who didn't submit)
  openActions: Array<{ id: string; description: string; due_date: string; status: string }>;
}

export interface DeckData {
  monthKey: string;
  meetingDate: string | null;
  meetingId: string | null;

  netGain: {
    value: number;
    goal: number | null;
    delta: number | null;
    pendingChurns: PendingChurn[];
    scheduledTerminationsLeft: number;
    salesNeededToHitGoal: number | null;
    pace: number | null;
  };

  targets: MonthlyTargets;

  studioLeadsTotal: number | null;       // authoritative WIG number from monthly_lead_totals
  studioLeadsPace: number | null;
  topLeadSources: Array<{ source: string; count: number }>;
  leadRows: LeadRow[];                   // raw leads for drill

  sglFunnel: FunnelStats;
  nonSglFunnel: FunnelStats;

  coachClose: {
    overallPct: number | null;
    goalPct: number | null;
    overallRuns: number;
    overallSales: number;
    rows: CoachRow[];
  };

  ownersFull: OwnerFull[];               // per-owner slide data, sorted submitted-first

  openActions: Array<{
    id: string;
    owner_name: string;
    description: string;
    due_date: string;
    status: string;
  }>;

  soml: ReturnType<typeof useSomlData>;

  loading: boolean;
}

export function useDeckData(): DeckData {
  const { monthKey, startYMD, endYMD, day, lastDay, todayYMD } = useMemo(() => currentMonthCST(), []);
  const { startIso, endIso } = useMemo(() => monthIsoBoundsCT(startYMD, endYMD), [startYMD, endYMD]);
  const currentMonday = nextMondayCT();

  const { data: meeting } = useCurrentMeeting({ weekDate: currentMonday });
  const { data: owners = [] } = useActiveOwners();
  const { data: entries = [] } = useOwnerEntries(meeting?.id);
  const { data: allActions = [] } = useActionItems();

  const soml = useSomlData();

  const [netGainValue, setNetGainValue] = useState<number>(0);
  const [targets, setTargets] = useState<MonthlyTargets>({
    saSgl: null, saBooked: null, saSales: null, coachClose: null, studioLeads: null, netGain: null,
  });

  useEffect(() => {
    (async () => {
      const [{ data: ng }, t] = await Promise.all([
        supabase.from('net_gain_state').select('value').eq('id', 1).maybeSingle(),
        loadMonthlyTargets(monthKey),
      ]);
      setNetGainValue((ng as any)?.value ?? 0);
      setTargets(t);
    })();
    const h = () => {
      supabase.from('net_gain_state').select('value').eq('id', 1).maybeSingle()
        .then(({ data }) => setNetGainValue((data as any)?.value ?? 0));
      loadMonthlyTargets(monthKey).then(setTargets);
    };
    window.addEventListener('otf:netGainChanged', h);
    return () => window.removeEventListener('otf:netGainChanged', h);
  }, [monthKey]);

  // Pending churns for the rest of the month
  const { data: pendingChurns = [] } = useQuery({
    queryKey: ['deck-pending-churns', monthKey],
    queryFn: async () => {
      const { data } = await (supabase as any).from('net_gain_churns')
        .select('id,member_name,churn_date,notes,applied_at')
        .is('applied_at', null)
        .lte('churn_date', endYMD)
        .order('churn_date', { ascending: true });
      return ((data as any[]) || []).map(c => ({
        id: c.id, member_name: c.member_name, churn_date: c.churn_date, notes: c.notes,
      })) as PendingChurn[];
    },
  });

  // Authoritative studio-leads number (manually entered monthly)
  const { data: studioLeadsRow } = useQuery({
    queryKey: ['deck-monthly-lead-total', monthKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_lead_totals')
        .select('lead_total')
        .eq('month_year', monthKey)
        .maybeSingle();
      return (data as any) || null;
    },
  });

  // All lead rows this month (for drill + top-sources breakdown)
  const { data: leadRows = [] } = useQuery({
    queryKey: ['deck-leads', monthKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select('id,first_name,last_name,source,created_at')
        .gte('created_at', startIso)
        .lte('created_at', endIso);
      return ((data as any[]) || []).map(r => ({
        id: r.id,
        name: `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Unknown',
        source: r.source,
        created_at: r.created_at,
      })) as LeadRow[];
    },
  });

  // Month-scoped intros_booked (leads/booked = created this month; showed = class_date)
  const { data: bookedRows = [] } = useQuery({
    queryKey: ['deck-booked', monthKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('intros_booked')
        .select('id,member_name,lead_source,booking_status_canon,class_date,created_at,coach_name,originating_booking_id,deleted_at,ignore_from_metrics,intro_owner')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .is('deleted_at', null);
      return ((data as any[]) || []) as DeckBookingRow[];
    },
  });

  // Class-date scoped bookings power showed/coach stats. This is separate from
  // created_at-scoped bookedRows so coach slides still show July runs whose
  // booking was created in late June.
  const { data: classMonthBookings = [] } = useQuery({
    queryKey: ['deck-class-month-bookings', monthKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('intros_booked')
        .select('id,member_name,lead_source,booking_status_canon,class_date,created_at,coach_name,originating_booking_id,deleted_at,ignore_from_metrics,intro_owner')
        .gte('class_date', startYMD)
        .lte('class_date', endYMD)
        .is('deleted_at', null);
      return ((data as any[]) || []) as DeckBookingRow[];
    },
  });

  const { data: runRows = [] } = useQuery({
    queryKey: ['deck-runs', monthKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('intros_run')
        .select('id,result_canon,result,buy_date,linked_intro_booked_id,coach_name,ignore_from_metrics,member_name,run_date,created_at');
      return ((data as any[]) || []) as DeckRunRow[];
    },
  });

  const monthSales = useMemo(() => runRows.filter(r => {
    if (r.ignore_from_metrics) return false;
    if (!isSaleCanon(r.result_canon)) return false;
    if (isPostDatedSale(r)) return false;
    const d = getRunSaleDate(r);
    return d && d >= startYMD && d <= endYMD;
  }), [runRows, startYMD, endYMD]);

  function buildFunnel(rows: any[]): FunnelStats {
    const bookedIds = new Set(rows.map(r => r.id));
    const showed = runRows.filter(r =>
      r.linked_intro_booked_id && bookedIds.has(r.linked_intro_booked_id) &&
      !r.ignore_from_metrics &&
      r.run_date && r.run_date >= startYMD && r.run_date <= endYMD &&
      didIntroActuallyRun(r)
    ).length;
    const sold = monthSales.filter(s => s.linked_intro_booked_id && bookedIds.has(s.linked_intro_booked_id)).length;
    const bySourceMap = new Map<string, number>();
    for (const r of rows) {
      const s = (r.lead_source || 'Unknown').trim() || 'Unknown';
      bySourceMap.set(s, (bySourceMap.get(s) || 0) + 1);
    }
    const bySource = [...bySourceMap.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);
    return { leads: rows.length, booked: rows.length, showed, sold, bySource, rows };
  }

  const sglRows = useMemo(() => bookedRows.filter(r => isSglLeadSource(r.lead_source)), [bookedRows]);
  const nonSglRows = useMemo(() => bookedRows.filter(r => !isSglLeadSource(r.lead_source)), [bookedRows]);

  const sglFunnel = useMemo(() => buildFunnel(sglRows), [sglRows, monthSales, endYMD]);
  const nonSglFunnel = useMemo(() => buildFunnel(nonSglRows), [nonSglRows, monthSales, endYMD]);

  // Top lead sources across ALL leads (from leads table)
  const topLeadSources = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of leadRows) {
      const s = (l.source || 'Unknown').trim() || 'Unknown';
      m.set(s, (m.get(s) || 0) + 1);
    }
    return [...m.entries()].map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);
  }, [leadRows]);

  // Coach close
  const coachClose = useMemo(() => {
    const firstBookings = classMonthBookings.filter(b => !b.originating_booking_id && !b.ignore_from_metrics);
    const firstIds = new Set(firstBookings.map(b => b.id));
    const runsThisMonth = runRows.filter(r =>
      r.linked_intro_booked_id && firstIds.has(r.linked_intro_booked_id) &&
      !r.ignore_from_metrics &&
      r.run_date && r.run_date >= startYMD && r.run_date <= endYMD &&
      didIntroActuallyRun(r),
    );
    const classMonthIds = new Set(classMonthBookings.map(b => b.id));
    const secondRunsThisMonth = runRows.filter(r =>
      r.linked_intro_booked_id && !firstIds.has(r.linked_intro_booked_id) && !r.ignore_from_metrics &&
        r.run_date && r.run_date >= startYMD && r.run_date <= endYMD && didIntroActuallyRun(r) &&
        classMonthIds.has(r.linked_intro_booked_id),
    );
    const byCoach = new Map<string, { runs: number; sales: number; firstRuns: number; secondRuns: number }>();
    for (const r of runsThisMonth) {
      const c = (r.coach_name || '').trim();
      if (!c || c.toUpperCase() === 'TBD') continue;
      const cur = byCoach.get(c) || { runs: 0, sales: 0, firstRuns: 0, secondRuns: 0 };
      cur.runs += 1;
      cur.firstRuns += 1;
      if (monthSales.some(s => s.id === r.id)) cur.sales += 1;
      byCoach.set(c, cur);
    }
    for (const r of secondRunsThisMonth) {
      const c = (r.coach_name || '').trim();
      if (!c || c.toUpperCase() === 'TBD') continue;
      const cur = byCoach.get(c) || { runs: 0, sales: 0, firstRuns: 0, secondRuns: 0 };
      cur.secondRuns += 1;
      byCoach.set(c, cur);
    }
    const rows: CoachRow[] = [...byCoach.entries()].map(([name, v]) => ({
      name, runs: v.runs, sales: v.sales,
      firstRuns: v.firstRuns, secondRuns: v.secondRuns,
      closePct: v.runs > 0 ? Math.round((v.sales / v.runs) * 100) : null,
    })).sort((a, b) => (b.closePct ?? 0) - (a.closePct ?? 0));
    const totalRuns = rows.reduce((s, r) => s + r.runs, 0);
    const totalSales = rows.reduce((s, r) => s + r.sales, 0);
    const overallPct = totalRuns > 0 ? Math.round((totalSales / totalRuns) * 100) : null;
    return { overallPct, goalPct: targets.coachClose, overallRuns: totalRuns, overallSales: totalSales, rows };
  }, [classMonthBookings, runRows, monthSales, targets.coachClose, startYMD, endYMD]);

  // Prior meeting entries (fallback for owners who didn't submit this week)
  const { data: priorEntriesByOwner = {} } = useQuery({
    queryKey: ['deck-prior-entries', meeting?.id],
    queryFn: async () => {
      if (!meeting?.id) return {} as Record<string, OwnerEntry>;
      const { data: prior } = await supabase.from('table_meetings')
        .select('id,meeting_date')
        .lt('meeting_date', meeting.meeting_date)
        .order('meeting_date', { ascending: false })
        .limit(1);
      const priorId = (prior as any[])?.[0]?.id;
      if (!priorId) return {} as Record<string, OwnerEntry>;
      const { data: priorEntries } = await supabase.from('table_owner_entries')
        .select('*')
        .eq('meeting_id', priorId);
      const out: Record<string, OwnerEntry> = {};
      for (const e of (((priorEntries as any[]) || []) as OwnerEntry[])) {
        out[e.owner_id] = e;
      }
      return out;
    },
    enabled: !!meeting?.id,
  });

  // Per-owner action items grouped by owner staff_id
  const actionsByOwner = useMemo(() => {
    const m = new Map<string, typeof allActions>();
    for (const a of allActions) {
      if (a.status === 'done') continue;
      const arr = m.get(a.owner_staff_id) || [];
      arr.push(a);
      m.set(a.owner_staff_id, arr);
    }
    return m;
  }, [allActions]);

  const ownersFull = useMemo<OwnerFull[]>(() => {
    return owners
      .filter(o => !o.is_architect)
      .map(o => {
        const e = entries.find(en => en.owner_id === o.id) || null;
        const openActions = (actionsByOwner.get(o.staff_id) || []).map(a => ({
          id: a.id, description: a.description, due_date: a.due_date, status: a.status,
        }));
        return {
          id: o.id,
          staff_id: o.staff_id,
          display_name: o.display_name,
          lane_name: o.lane_name,
          category: o.category,
          entry: e,
          submitted: !!e?.submitted_at,
          priorEntry: priorEntriesByOwner[o.id] ?? null,
          openActions,
        };
      })
      .sort((a, b) => {
        if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
        return a.display_name.localeCompare(b.display_name);
      });
  }, [owners, entries, priorEntriesByOwner, actionsByOwner]);

  const openActions = useMemo(() =>
    allActions
      .filter(a => a.status === 'open' || a.status === 'in_progress')
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .map(a => ({
        id: a.id, owner_name: a.owner_name, description: a.description,
        due_date: a.due_date, status: a.status,
      })),
    [allActions],
  );

  const netGainGoal = targets.netGain;
  const scheduledTerminationsLeft = pendingChurns.length;
  const salesNeededToHitGoal = netGainGoal != null
    ? Math.max(0, (netGainGoal + scheduledTerminationsLeft) - netGainValue)
    : null;
  const pace = netGainGoal != null && lastDay > 0
    ? Math.round((netGainGoal * (day / lastDay)) * 10) / 10
    : null;

  const studioLeadsTotal = (studioLeadsRow as any)?.lead_total ?? null;
  const studioLeadsPace = targets.studioLeads != null && lastDay > 0
    ? Math.round((targets.studioLeads * (day / lastDay)) * 10) / 10
    : null;

  return {
    monthKey,
    meetingDate: meeting?.meeting_date ?? null,
    meetingId: meeting?.id ?? null,
    netGain: {
      value: netGainValue,
      goal: netGainGoal,
      delta: netGainGoal != null ? netGainValue - netGainGoal : null,
      pendingChurns,
      scheduledTerminationsLeft,
      salesNeededToHitGoal,
      pace,
    },
    targets,
    studioLeadsTotal,
    studioLeadsPace,
    topLeadSources,
    leadRows,
    sglFunnel,
    nonSglFunnel,
    coachClose,
    ownersFull,
    openActions,
    soml,
    loading: !meeting,
  };
}
