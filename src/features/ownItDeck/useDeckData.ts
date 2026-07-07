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
import { loadMonthlyTargets, type MonthlyTargets } from '@/lib/wig/targets';
import {
  useCurrentMeeting, useActiveOwners, useOwnerEntries, useActionItems, nextMondayCT,
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
  const monthKey = `${y}-${String(m).padStart(2, '0')}`;
  const startYMD = `${monthKey}-01`;
  // last day of month
  const lastDay = new Date(y, m, 0).getDate();
  const endYMD = `${monthKey}-${String(lastDay).padStart(2, '0')}`;
  return { monthKey, startYMD, endYMD, year: y, month: m };
}

export interface FunnelStats {
  leads: number;
  booked: number;
  showed: number;
  sold: number;
}

export interface CoachRow {
  name: string;
  runs: number;         // ran first intros (denominator)
  sales: number;        // sales attributed via total-journey (numerator)
  closePct: number | null;
}

export interface DeckData {
  monthKey: string;
  meetingDate: string | null;
  meetingId: string | null;

  netGain: {
    value: number;
    goal: number | null;
    delta: number | null;
  };

  targets: MonthlyTargets;

  sglFunnel: FunnelStats;
  nonSglFunnel: FunnelStats;

  coachClose: {
    overallPct: number | null;
    goalPct: number | null;
    rows: CoachRow[];
  };

  owners: Array<{
    id: string;
    display_name: string;
    lane_name: string | null;
    commitment: string | null;
    submitted: boolean;
  }>;

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
  const { monthKey, startYMD, endYMD } = useMemo(() => currentMonthCST(), []);
  const currentMonday = nextMondayCT();

  const { data: meeting } = useCurrentMeeting({ weekDate: currentMonday });
  const { data: owners = [] } = useActiveOwners();
  const { data: entries = [] } = useOwnerEntries(meeting?.id);
  const { data: allActions = [] } = useActionItems();

  const soml = useSomlData();

  // Net gain state + monthly targets
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

  // Month-scoped intros_booked (created this month = leads/booked; class_date = showed)
  const { data: bookedRows = [] } = useQuery({
    queryKey: ['deck-booked', monthKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('intros_booked')
        .select('id,lead_source,booking_status_canon,class_date,created_at,coach_name,originating_booking_id,deleted_at')
        .gte('created_at', `${startYMD}T00:00:00`)
        .lte('created_at', `${endYMD}T23:59:59`)
        .is('deleted_at', null);
      return (data as any[]) || [];
    },
  });

  const { data: runRows = [] } = useQuery({
    queryKey: ['deck-runs', monthKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('intros_run')
        .select('id,result_canon,buy_date,linked_intro_booked_id,coach_name,ignore_from_metrics,member_name,run_date,created_at');
      return (data as any[]) || [];
    },
  });

  // Sales this month (by buy_date fallback chain), excluding post-dated.
  const monthSales = useMemo(() => runRows.filter(r => {
    if (r.ignore_from_metrics) return false;
    if (!isSaleCanon(r.result_canon)) return false;
    if (isPostDatedSale(r)) return false;
    const d = getRunSaleDate(r);
    return d && d >= startYMD && d <= endYMD;
  }), [runRows, startYMD, endYMD]);

  // Bookings this month by SGL classification
  function buildFunnel(rows: any[]): FunnelStats {
    const bookedIds = new Set(rows.map(r => r.id));
    const showed = rows.filter(r =>
      r.booking_status_canon === 'SHOWED' || r.booking_status_canon === 'ACTIVE' && r.class_date && r.class_date <= endYMD
    ).length;
    // sold: any monthSales run linked to one of these bookings
    const sold = monthSales.filter(s => s.linked_intro_booked_id && bookedIds.has(s.linked_intro_booked_id)).length;
    return {
      leads: rows.length,
      booked: rows.length, // one row per booking; "leads" and "booked" merge here
      showed,
      sold,
    };
  }

  const sglRows = useMemo(() => bookedRows.filter(r => isSglLeadSource(r.lead_source)), [bookedRows]);
  const nonSglRows = useMemo(() => bookedRows.filter(r => !isSglLeadSource(r.lead_source)), [bookedRows]);

  const sglFunnel = useMemo(() => buildFunnel(sglRows), [sglRows, monthSales, endYMD]);
  const nonSglFunnel = useMemo(() => buildFunnel(nonSglRows), [nonSglRows, monthSales, endYMD]);

  // Coach close rate: FIRST intros only (originating_booking_id null),
  // grouped by coach on the run. Ran = has any linked run this month.
  const coachClose = useMemo(() => {
    const firstBookings = bookedRows.filter(b => !b.originating_booking_id);
    const firstIds = new Set(firstBookings.map(b => b.id));
    const runsThisMonth = runRows.filter(r =>
      r.linked_intro_booked_id && firstIds.has(r.linked_intro_booked_id) && !r.ignore_from_metrics,
    );
    const byCoach = new Map<string, { runs: number; sales: number }>();
    for (const r of runsThisMonth) {
      const c = (r.coach_name || '').trim();
      if (!c || c.toUpperCase() === 'TBD') continue;
      const cur = byCoach.get(c) || { runs: 0, sales: 0 };
      cur.runs += 1;
      if (monthSales.some(s => s.id === r.id)) cur.sales += 1;
      byCoach.set(c, cur);
    }
    const rows: CoachRow[] = [...byCoach.entries()].map(([name, v]) => ({
      name, runs: v.runs, sales: v.sales,
      closePct: v.runs > 0 ? Math.round((v.sales / v.runs) * 100) : null,
    })).sort((a, b) => (b.closePct ?? 0) - (a.closePct ?? 0));
    const totalRuns = rows.reduce((s, r) => s + r.runs, 0);
    const totalSales = rows.reduce((s, r) => s + r.sales, 0);
    const overallPct = totalRuns > 0 ? Math.round((totalSales / totalRuns) * 100) : null;
    return { overallPct, goalPct: targets.coachClose, rows };
  }, [bookedRows, runRows, monthSales, targets.coachClose]);

  // Owner commitments for current meeting
  const ownerRows = useMemo(() => {
    return owners
      .filter(o => !o.is_architect)
      .map(o => {
        const e = entries.find(en => en.owner_id === o.id);
        return {
          id: o.id,
          display_name: o.display_name,
          lane_name: o.lane_name,
          commitment: e?.commitment ?? null,
          submitted: !!e?.submitted_at,
        };
      })
      .sort((a, b) => {
        if (a.submitted !== b.submitted) return a.submitted ? 1 : -1;
        return a.display_name.localeCompare(b.display_name);
      });
  }, [owners, entries]);

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

  return {
    monthKey,
    meetingDate: meeting?.meeting_date ?? null,
    meetingId: meeting?.id ?? null,
    netGain: {
      value: netGainValue,
      goal: netGainGoal,
      delta: netGainGoal != null ? netGainValue - netGainGoal : null,
    },
    targets,
    sglFunnel,
    nonSglFunnel,
    coachClose,
    owners: ownerRows,
    openActions,
    soml,
    loading: !meeting,
  };
}
