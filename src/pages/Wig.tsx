import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';

import { useFvTrendData } from '@/hooks/useFvTrendData';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import { DatePreset, DateRange, getDateRangeForPreset } from '@/lib/pay-period';
import { Target, Trophy, UserCheck, Check, Loader2, RefreshCw, Pencil } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WigSaLeaderboard } from '@/components/wig/WigSaLeaderboard';

import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, isWithinInterval } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { isSaleInRange, isRunInRange } from '@/lib/sales-detection';
import { isCloseResult, labelForRun } from '@/lib/intros/resultLabels';
import { isBookingExcludedFromMetrics } from '@/lib/intros/excludedBookings';
import { resolvePromotedOrphanBookingIds } from '@/lib/intros/orphanedFirstIntros';
import { NON_RAN_BOOKING_STATUSES, didIntroActuallyRun } from '@/lib/canon/introRules';
import { CoachAttributionDrillDown, type CoachAttribution, type AttribIntro } from '@/components/dashboard/CoachAttributionDrillDown';
import { PersonListDrillDown, type PersonRow } from '@/components/dashboard/PersonListDrillDown';
import { getNowCentral, getCurrentMonthYear } from '@/lib/dateUtils';
import { useRealtimeMyDay } from '@/hooks/useRealtimeMyDay';
import { notifyDataChanged } from '@/lib/data/invalidation';
import { paceToToday, statusColor, statusClasses, formatPace } from '@/lib/wig/pace';
import { loadMonthlyTargets, saveMonthlyTarget, type MonthlyTargets } from '@/lib/wig/targets';
import { isAdmin as isAdminCheck } from '@/lib/auth/roles';

export default function Wig() {
  const { user } = useAuth();
  const { coaches: _activeCoaches } = useActiveStaff();
  const { introsBooked, introsRun, isLoading, lastUpdated, refreshData, silentRefreshData } = useData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  useRealtimeMyDay(useCallback(() => { silentRefreshData().catch(() => {}); }, [silentRefreshData]));

  // Date filter — default this_month, persist in sessionStorage
  const [datePreset, setDatePreset] = useState<DatePreset>(() => {
    const saved = sessionStorage.getItem('wig_date_preset');
    return (saved as DatePreset) || 'this_month';
  });
  const [customRange, setCustomRange] = useState<DateRange | undefined>(() => {
    const saved = sessionStorage.getItem('wig_custom_range');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { start: new Date(parsed.start), end: new Date(parsed.end) };
      } catch { return undefined; }
    }
    return undefined;
  });
  const dateRange = useMemo(() => getDateRangeForPreset(datePreset, customRange), [datePreset, customRange]);

  // Persist date selection to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('wig_date_preset', datePreset);
    if (customRange) {
      sessionStorage.setItem('wig_custom_range', JSON.stringify({ start: customRange.start.toISOString(), end: customRange.end.toISOString() }));
    }
  }, [datePreset, customRange]);

  // Monthly lead input
  const [leadCount, setLeadCount] = useState<string>('');
  const [leadSaving, setLeadSaving] = useState(false);
  const [leadSaved, setLeadSaved] = useState(false);

  // Monthly targets — single source of truth from src/lib/wig/targets.ts.
  // Nothing on this page carries a hardcoded target fallback.
  const [targets, setTargets] = useState<MonthlyTargets>({
    saSgl: null, saBooked: null, saSales: null, coachClose: null, studioLeads: null,
  });
  const [editingStudioTarget, setEditingStudioTarget] = useState(false);
  const [editingCloseTarget, setEditingCloseTarget] = useState(false);
  const [studioTargetInput, setStudioTargetInput] = useState<string>('');
  const [closeTargetInput, setCloseTargetInput] = useState<string>('');
  const [studioTargetSaved, setStudioTargetSaved] = useState(false);
  const [closeTargetSaved, setCloseTargetSaved] = useState(false);
  const isAdmin = isAdminCheck(user);

  const targetMonthYM = useMemo(() => {
    return dateRange ? format(dateRange.start, 'yyyy-MM') : format(getNowCentral(), 'yyyy-MM');
  }, [dateRange]);

  const refreshTargets = useCallback(async () => {
    const t = await loadMonthlyTargets(targetMonthYM);
    setTargets(t);
    setStudioTargetInput(t.studioLeads == null ? '' : String(t.studioLeads));
    setCloseTargetInput(t.coachClose == null ? '' : String(t.coachClose));
  }, [targetMonthYM]);

  useEffect(() => { refreshTargets(); }, [refreshTargets]);

  const handleSaveStudioTarget = async () => {
    const val = parseInt(studioTargetInput, 10);
    if (isNaN(val) || val < 0) { toast.error('Enter a number ≥ 0'); return; }
    const { error } = await saveMonthlyTarget('studioLeads', targetMonthYM, val, user?.name || 'unknown');
    if (error) { toast.error('Save failed'); return; }
    setEditingStudioTarget(false);
    setStudioTargetSaved(true);
    setTimeout(() => setStudioTargetSaved(false), 2000);
    refreshTargets();
  };

  const handleSaveCloseTarget = async () => {
    const val = parseInt(closeTargetInput, 10);
    if (isNaN(val) || val < 0 || val > 100) { toast.error('Enter 0–100'); return; }
    const { error } = await saveMonthlyTarget('coachClose', targetMonthYM, val, user?.name || 'unknown');
    if (error) { toast.error('Save failed'); return; }
    setEditingCloseTarget(false);
    setCloseTargetSaved(true);
    setTimeout(() => setCloseTargetSaved(false), 2000);
    refreshTargets();
  };

  // Monthly lead totals data
  const [monthlyLeadData, setMonthlyLeadData] = useState<{ month_year: string; lead_total: number }[]>([]);

  // Derive selected month from date range for the input label
  const selectedMonthYear = useMemo(() => {
    if (dateRange) {
      return format(dateRange.start, 'yyyy-MM');
    }
    return getCurrentMonthYear();
  }, [dateRange]);

  const selectedMonthLabel = useMemo(() => {
    if (dateRange) {
      return format(dateRange.start, 'MMMM yyyy');
    }
    return format(getNowCentral(), 'MMMM yyyy');
  }, [dateRange]);

  const loadMonthlyLeads = useCallback(async () => {
    const { data } = await supabase
      .from('monthly_lead_totals')
      .select('month_year, lead_total')
      .order('month_year', { ascending: false });
    setMonthlyLeadData((data as any[]) || []);
  }, []);

  // Pre-fill input when month changes or data loads
  useEffect(() => {
    const currentMonthRecord = monthlyLeadData.find(r => r.month_year === selectedMonthYear);
    if (currentMonthRecord) {
      setLeadCount(String(currentMonthRecord.lead_total));
    } else {
      setLeadCount('');
    }
  }, [selectedMonthYear, monthlyLeadData]);

  useEffect(() => { loadMonthlyLeads(); }, [loadMonthlyLeads]);

  const handleSaveLead = async () => {
    const count = parseInt(leadCount, 10);
    if (isNaN(count) || count < 0 || !user?.name) return;
    setLeadSaving(true);

    // Upsert by month_year
    const { data: existing } = await supabase
      .from('monthly_lead_totals')
      .select('id')
      .eq('month_year', selectedMonthYear)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase.from('monthly_lead_totals').update({
        lead_total: count,
        last_updated_by: user.name,
        updated_at: new Date().toISOString(),
      } as any).eq('id', (existing[0] as any).id);
    } else {
      await supabase.from('monthly_lead_totals').insert({
        month_year: selectedMonthYear,
        lead_total: count,
        last_updated_by: user.name,
      } as any);
    }

    setLeadSaving(false);
    setLeadSaved(true);
    setTimeout(() => setLeadSaved(false), 2000);
    loadMonthlyLeads();
  };

  // Compute total leads for the selected date range
  const totalLeads = useMemo(() => {
    if (!dateRange) return monthlyLeadData.reduce((s, r) => s + r.lead_total, 0);
    // Sum months that overlap with the selected date range
    const startMonth = format(dateRange.start, 'yyyy-MM');
    const endMonth = format(dateRange.end, 'yyyy-MM');
    return monthlyLeadData
      .filter(r => r.month_year >= startMonth && r.month_year <= endMonth)
      .reduce((s, r) => s + r.lead_total, 0);
  }, [monthlyLeadData, dateRange]);

  // === FUNNEL DATA - matching Studio ConversionFunnel logic exactly ===
  const filteredBookings = useMemo(() => {
    const todayCentral = getNowCentral();
    const effectiveEnd = dateRange ? (dateRange.end < todayCentral ? dateRange.end : todayCentral) : todayCentral;
    return introsBooked.filter(b => {
      if (isBookingExcludedFromMetrics(b)) return false;
      if (!dateRange) return true;
      try {
        return isWithinInterval(parseLocalDate(b.class_date), { start: dateRange.start, end: effectiveEnd });
      } catch { return false; }
    });
  }, [introsBooked, dateRange]);

  // Showed: match Studio logic - check intros_run linked to bookings, result !== 'No-show'
  const totalShowed = useMemo(() => {
    let count = 0;
    filteredBookings.forEach(b => {
      const runs = introsRun.filter(r => r.linked_intro_booked_id === b.id);
      const showedRun = runs.find(r => r.result !== 'No-show' && isRunInRange(r, dateRange || null));
      if (showedRun) count++;
    });
    return count;
  }, [filteredBookings, introsRun, dateRange]);

  // Closed: match Studio logic - sales from intros_run where linked booking is in active set
  const totalClosed = useMemo(() => {
    const activeBookingIds = new Set(filteredBookings.map(b => b.id));
    let count = 0;
    introsRun.forEach(r => {
      if (!isSaleInRange(r, dateRange || null)) return;
      if (r.linked_intro_booked_id && !activeBookingIds.has(r.linked_intro_booked_id)) return;
      count++;
    });
    return count;
  }, [introsRun, dateRange, filteredBookings]);

  // Close rate is computed below from coachTableTotals (declared lower in this component).
  // See `closeRate` after coachTableTotals state.

  // Studio leads target = monthly setting. Pace + color from shared helpers.
  const studioLeadsPace = useMemo(
    () => paceToToday(targets.studioLeads),
    [targets.studioLeads],
  );
  const studioLeadsStatus = statusColor(totalLeads, studioLeadsPace);





  // Date range boundaries for lead measures
  const rangeStartYMD = useMemo(() => dateRange ? format(dateRange.start, 'yyyy-MM-dd') : format(getNowCentral(), 'yyyy-MM-01'), [dateRange]);
  const rangeEndYMD = useMemo(() => dateRange ? format(dateRange.end, 'yyyy-MM-dd') : format(getNowCentral(), 'yyyy-MM-dd'), [dateRange]);

  // SA Lead Measures
  const [saLeadMeasures, setSaLeadMeasures] = useState<any[]>([]);
  const [saPeople, setSaPeople] = useState<Map<string, { referralAsks: PersonRow[]; packs: PersonRow[] }>>(new Map());
  const [saDrill, setSaDrill] = useState<{ sa: string; metric: 'referralAsks' | 'packs' } | null>(null);
  const [coachLeadMeasures, setCoachLeadMeasures] = useState<any[]>([]);
  const [coachTableTotals, setCoachTableTotals] = useState<{ coached: number; closes: number }>({ coached: 0, closes: 0 });
  const [coachAttribution, setCoachAttribution] = useState<Map<string, CoachAttribution>>(new Map());
  const [drill, setDrill] = useState<{ coach: string; metric: 'coached' | 'closes' } | null>(null);
  const [measuresLoading, setMeasuresLoading] = useState(true);

  // Close rate reconciles with the Coach — Coached & Closes table directly below it.
  const effectiveShowed = Math.max(coachTableTotals.coached, coachTableTotals.closes);
  const closeRate = effectiveShowed > 0 ? (coachTableTotals.closes / effectiveShowed) * 100 : 0;

  // FV scorecard data — feeds per-coach "Scored" + "Avg score" columns on the Coach tab.
  const fvRange = dateRange || { start: getNowCentral(), end: getNowCentral() };
  const fv = useFvTrendData(fvRange, 'self', false);

  const loadLeadMeasures = useCallback(async () => {
    setMeasuresLoading(true);
    try {
      const rangeStart = rangeStartYMD;
      const rangeEnd = rangeEndYMD;

      const [refRes, milestoneRes] = await Promise.all([
        supabase
          .from('intros_booked')
          .select('id, member_name, class_date, booked_by, coach_referral_asked')
          .eq('coach_referral_asked', true)
          .gte('class_date', rangeStart)
          .lte('class_date', rangeEnd),
        supabase
          .from('milestones')
          .select('id, member_name, created_at, created_by, five_class_pack_gifted, friend_name')
          .eq('entry_type', 'milestone')
          .eq('five_class_pack_gifted', true)
          .gte('created_at', rangeStart)
          .lte('created_at', rangeEnd + 'T23:59:59'),
      ]);

      // Aggregate by SA
      const saMap = new Map<string, { referralAsks: number; packs: number }>();
      const saPeopleMap = new Map<string, { referralAsks: PersonRow[]; packs: PersonRow[] }>();
      const ensureSaPeople = (n: string) => {
        let p = saPeopleMap.get(n);
        if (!p) { p = { referralAsks: [], packs: [] }; saPeopleMap.set(n, p); }
        return p;
      };
      (refRes.data || []).forEach((r: any) => {
        const name = r.booked_by || 'Unknown';
        const ex = saMap.get(name) || { referralAsks: 0, packs: 0 };
        ex.referralAsks++;
        saMap.set(name, ex);
        ensureSaPeople(name).referralAsks.push({
          id: `ref-${r.id}`,
          name: r.member_name || 'Unknown member',
          subtitle: r.class_date ? `Class ${format(parseLocalDate(r.class_date), 'MMM d')}` : undefined,
        });
      });
      (milestoneRes.data || []).forEach((r: any) => {
        const name = r.created_by || 'Unknown';
        const ex = saMap.get(name) || { referralAsks: 0, packs: 0 };
        ex.packs++;
        saMap.set(name, ex);
        ensureSaPeople(name).packs.push({
          id: `pack-${r.id}`,
          name: r.member_name || 'Unknown member',
          subtitle: [r.friend_name ? `Friend: ${r.friend_name}` : null, r.created_at ? format(new Date(r.created_at), 'MMM d') : null].filter(Boolean).join(' · ') || undefined,
        });
      });

      const saData = Array.from(saMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.referralAsks - a.referralAsks);
      setSaLeadMeasures(saData);
      setSaPeople(saPeopleMap);

      // Coach measures — use intros_booked as base for shoutout fields
      // Fetch showed first-intro bookings for the date range
      const coachBookingsRes = await supabase
        .from('intros_booked')
        .select('id, member_name, coach_name, originating_booking_id, booking_status_canon, is_vip, ignore_from_metrics, class_date, referred_by_member_name, lead_source, vip_session_id')
        .gte('class_date', rangeStart)
        .lte('class_date', rangeEnd)
        .not('coach_name', 'is', null);

      const allCoachBookings = ((coachBookingsRes.data || []) as any[]).filter(b => !isBookingExcludedFromMetrics(b));

      // Resolve "orphaned" 2nd intros: when a 2nd-intro booking's originating
      // 1st intro is excluded (e.g. DELETED_SOFT — wasn't a true intro), the
      // 2nd intro becomes the member's actual first real intro. Credit the
      // coach who ran it. When MULTIPLE children chain back to the same
      // excluded original (e.g. Alexa: a follow-up child + a sale child),
      // we promote exactly ONE — preferring the child that ended in a sale.
      const candidateChildren = allCoachBookings.filter(b => !!b.originating_booking_id && !b.referred_by_member_name);
      const originatingIds = Array.from(new Set(
        candidateChildren
          .map(b => b.originating_booking_id)
          .filter((id): id is string => !!id)
      ));
      const originatingRowsById = new Map<string, any>();
      if (originatingIds.length > 0) {
        const origBatches: string[][] = [];
        for (let i = 0; i < originatingIds.length; i += 500) origBatches.push(originatingIds.slice(i, i + 500));
        for (const batch of origBatches) {
          const { data: origRows } = await supabase
            .from('intros_booked')
            .select('id, booking_status_canon, is_vip, ignore_from_metrics, deleted_at, originating_booking_id, class_date, referred_by_member_name')
            .in('id', batch);
          (origRows || []).forEach((o: any) => originatingRowsById.set(o.id, o));
        }
      }

      // Fetch runs for candidate children so the resolver can detect which
      // child ended in a sale.
      const candidateChildIds = candidateChildren.map(b => b.id);
      const candidateRuns: any[] = [];
      if (candidateChildIds.length > 0) {
        const childBatches: string[][] = [];
        for (let i = 0; i < candidateChildIds.length; i += 500) childBatches.push(candidateChildIds.slice(i, i + 500));
        for (const batch of childBatches) {
          const { data: rows } = await supabase
            .from('intros_run')
            .select('linked_intro_booked_id, result, result_canon, buy_date')
            .in('linked_intro_booked_id', batch);
          (rows || []).forEach(r => candidateRuns.push(r));
        }
      }

      const resolverPool = [
        ...allCoachBookings,
        ...Array.from(originatingRowsById.values()).filter(o => !allCoachBookings.some(b => b.id === o.id)),
      ];
      const promotedOrphanIds = resolvePromotedOrphanBookingIds(resolverPool, candidateRuns);

      const firstIntroBookings = allCoachBookings.filter(b =>
        !b.originating_booking_id
        || !!b.referred_by_member_name
        || promotedOrphanIds.has(b.id)
      );

      // ── VIP Class attribution map ──
      const vipCoachMap = new Map<string, string>();
      const vipSessionIds = Array.from(new Set(
        firstIntroBookings
          .filter(b => (b.lead_source || '').startsWith('VIP Class') && b.vip_session_id)
          .map(b => b.vip_session_id as string)
      ));
      if (vipSessionIds.length > 0) {
        const { data: vipSessionRows } = await (supabase as any)
          .from('vip_sessions')
          .select('id, coach_name')
          .in('id', vipSessionIds);
        for (const v of (vipSessionRows || [])) {
          if (v.coach_name) vipCoachMap.set(v.id, v.coach_name);
        }
      }
      const resolveCloseCoach = (b: any, fallback: string | null | undefined): string | null => {
        if ((b.lead_source || '').startsWith('VIP Class') && b.vip_session_id) {
          const vc = vipCoachMap.get(b.vip_session_id);
          if (vc) return vc;
        }
        return fallback || null;
      };

      // Fetch linked intros_run rows for showed-intro detection + close coach attribution.
      // Pull runs for EVERY in-range booking (1st + 2nd) so Corporate · Last Coach
      // can attribute per-class without an extra round trip.
      const firstIntroBookingIds = firstIntroBookings.map(b => b.id);
      const allInRangeBookingIds = allCoachBookings.map(b => b.id);
      const showedBookingIds = new Set<string>();
      const runsByBookingId = new Map<string, any>();
      const allRunsByBookingId = new Map<string, any>(); // includes 2nd intros; unfiltered
      if (allInRangeBookingIds.length > 0) {
        const runBatches: string[][] = [];
        for (let i = 0; i < allInRangeBookingIds.length; i += 500) runBatches.push(allInRangeBookingIds.slice(i, i + 500));
        const firstIdSet = new Set(firstIntroBookingIds);
        for (const batch of runBatches) {
          const { data: runs } = await supabase
            .from('intros_run')
            .select('linked_intro_booked_id, result, result_canon, coach_name, buy_date, run_date, created_at')
            .in('linked_intro_booked_id', batch);
          (runs || []).forEach((r: any) => {
            allRunsByBookingId.set(r.linked_intro_booked_id, r);
            if (r.result_canon === 'NO_SHOW' || r.result_canon === 'UNRESOLVED') return;
            if (firstIdSet.has(r.linked_intro_booked_id)) {
              showedBookingIds.add(r.linked_intro_booked_id);
              runsByBookingId.set(r.linked_intro_booked_id, r);
            }
          });
        }
      }

      const showedFirstIntroBookings = firstIntroBookings.filter(b => showedBookingIds.has(b.id));

      // Aggregate "coached" denominator only — lead-measure detail moved to FV Scorecard section
      const coachMap = new Map<string, { coached: number }>();
      const ensureCoach = (name: string) => coachMap.get(name) || { coached: 0 };

      const isMissingCoach = (v: any) =>
        !v || (typeof v === 'string' && (v.trim() === '' || /^tbd$/i.test(v.trim())));

      // Per-coach attribution map for tappable drill-downs
      const attribMap = new Map<string, CoachAttribution>();
      const ensureAttrib = (n: string): CoachAttribution => {
        let a = attribMap.get(n);
        if (!a) { a = { coached: [], closes: [], excluded: [] }; attribMap.set(n, a); }
        return a;
      };
      const labelFromRun = (r: any) => labelForRun(r);

      showedFirstIntroBookings.forEach(b => {
        const linkedRunForCoach = runsByBookingId.get(b.id);
        const runCoachRaw = isMissingCoach(b.coach_name)
          ? (linkedRunForCoach?.coach_name || b.coach_name)
          : b.coach_name;
        if (isMissingCoach(runCoachRaw)) return;
        const runCoach = runCoachRaw;
        const coachedCoach = resolveCloseCoach(b, runCoach) || runCoach;

        const ex = ensureCoach(coachedCoach);
        ex.coached++;
        coachMap.set(coachedCoach, ex);

        ensureAttrib(coachedCoach).coached.push({
          bookingId: b.id,
          member: b.member_name || 'Unknown',
          classDate: b.class_date,
          source: b.lead_source,
          resultLabel: labelFromRun(linkedRunForCoach),
        });
      });

      // Close rate from intros_run (period runs for first intros, excluding no-shows)
      // Total Journey: also check if a 2nd intro booking resulted in a sale
      const coachCloseMap = new Map<string, { total: number; closed: number }>();
      const showedFirstIntroBookingIds = showedFirstIntroBookings.map(b => b.id);
      // Map booking_id -> booking row so we can resolve VIP-coach attribution per run
      const bookingByIdMap = new Map<string, any>();
      showedFirstIntroBookings.forEach(b => bookingByIdMap.set(b.id, b));

      // Hoisted so the post-loop backfill can read it (set of first-intro
      // booking IDs whose 2nd intro ran a sale — Total Journey).
      const secondRunSaleSet = new Set<string>();

      if (showedFirstIntroBookingIds.length > 0) {
        const closeBatches: string[][] = [];
        for (let i = 0; i < showedFirstIntroBookingIds.length; i += 500) closeBatches.push(showedFirstIntroBookingIds.slice(i, i + 500));
        
        // Also fetch 2nd intro bookings linked to these first intros
        const secondIntroBookingMap = new Map<string, string[]>(); // firstId -> [secondBookingIds]
        for (const batch of closeBatches) {
          const { data: secondBookings } = await supabase
            .from('intros_booked')
            .select('id, originating_booking_id')
            .in('originating_booking_id', batch);
          (secondBookings || []).forEach((sb: any) => {
            const existing = secondIntroBookingMap.get(sb.originating_booking_id) || [];
            existing.push(sb.id);
            secondIntroBookingMap.set(sb.originating_booking_id, existing);
          });
        }

        // Fetch runs for 2nd intro bookings to check for sales
        const allSecondIds = Array.from(secondIntroBookingMap.values()).flat();
        if (allSecondIds.length > 0) {
          for (let i = 0; i < allSecondIds.length; i += 500) {
            const batch2 = allSecondIds.slice(i, i + 500);
            const { data: secondRuns } = await supabase
              .from('intros_run')
              .select('linked_intro_booked_id, result, result_canon, buy_date, run_date, created_at')
              .in('linked_intro_booked_id', batch2);
            (secondRuns || []).forEach((r2: any) => {
              if (isSaleInRange(r2, dateRange || null)) {
                for (const [firstId, secondIds] of secondIntroBookingMap.entries()) {
                  if (secondIds.includes(r2.linked_intro_booked_id)) {
                    secondRunSaleSet.add(firstId);
                    break;
                  }
                }
              }
            });
          }
        }

        // Track which run rows have been counted so the buy_date pass below
        // doesn't double-credit a close already attributed via class_date.
        const countedRunBookingIds = new Set<string>();

        for (const batch of closeBatches) {
          const { data: runs } = await supabase
            .from('intros_run')
            .select('linked_intro_booked_id, coach_name, result, result_canon, buy_date, run_date, created_at')
            .in('linked_intro_booked_id', batch)
            .neq('result_canon', 'NO_SHOW')
            .neq('result_canon', 'UNRESOLVED');
          (runs || []).forEach((r: any) => {
            const linkedBooking = r.linked_intro_booked_id ? bookingByIdMap.get(r.linked_intro_booked_id) : null;
            // For VIP Class intros, credit the VIP class coach instead of the follow-up coach
            const cName = linkedBooking
              ? (resolveCloseCoach(linkedBooking, r.coach_name) || r.coach_name)
              : r.coach_name;
            if (!cName) return;
            const introBase: AttribIntro = {
              bookingId: r.linked_intro_booked_id || cName,
              member: linkedBooking?.member_name || 'Unknown',
              classDate: linkedBooking?.class_date || null,
              source: linkedBooking?.lead_source || null,
              resultLabel: labelFromRun(r),
            };
            // Exclude VIP Class Intro outcomes from close-rate math entirely
            if (r.result_canon === 'VIP_CLASS_INTRO') {
              ensureAttrib(cName).excluded.push(introBase);
              return;
            }
            const ex = coachCloseMap.get(cName) || { total: 0, closed: 0 };
            ex.total++;
            if (isSaleInRange(r, dateRange || null)) {
              ex.closed++;
              ensureAttrib(cName).closes.push({ ...introBase, via: 'direct', resultLabel: 'SALE', buyDate: r.buy_date || r.run_date || null });
              if (r.linked_intro_booked_id) countedRunBookingIds.add(r.linked_intro_booked_id);
            } else if (r.linked_intro_booked_id && secondRunSaleSet.has(r.linked_intro_booked_id)) {
              // Total Journey: 2nd intro resulted in sale → credit this coach
              ex.closed++;
              ensureAttrib(cName).closes.push({ ...introBase, via: '2nd_intro', resultLabel: 'SALE', buyDate: r.buy_date || r.run_date || null });
              // Mark BOTH the 1st-intro booking AND every downstream 2nd-intro
              // booking as counted, so the buy_date backfill pass below does
              // not double-credit the same Total Journey sale.
              countedRunBookingIds.add(r.linked_intro_booked_id);
              const secondIds = secondIntroBookingMap.get(r.linked_intro_booked_id) || [];
              for (const sid of secondIds) countedRunBookingIds.add(sid);
            }
            coachCloseMap.set(cName, ex);
          });
        }

        // === Cross-period close backfill (anchored to buy_date) ===
        // Studio totalClosed uses isSaleInRange (buy_date). The per-coach pass
        // above keys on class_date-in-range, so a member whose intro was in a
        // prior period but who buys in this period was being dropped from
        // Coach Closes drill-down. Fetch sale runs by buy_date in range and
        // merge any not already counted above.
        const SALE_CANONS = ['SALE','PREMIER','PREMIER_OTBEAT','ELITE','BASIC'];
        const { data: buyDateSales } = await supabase
          .from('intros_run')
          .select('id, linked_intro_booked_id, coach_name, result, result_canon, buy_date')
          .in('result_canon', SALE_CANONS)
          .gte('buy_date', rangeStart)
          .lte('buy_date', rangeEnd);

        const newSales = (buyDateSales || []).filter((r: any) =>
          r.linked_intro_booked_id && !countedRunBookingIds.has(r.linked_intro_booked_id)
        );

        const missingBookingIds = Array.from(new Set(
          newSales.map((r: any) => r.linked_intro_booked_id).filter((id: string) => !bookingByIdMap.has(id))
        ));
        if (missingBookingIds.length > 0) {
          for (let i = 0; i < missingBookingIds.length; i += 500) {
            const batch = missingBookingIds.slice(i, i + 500);
            const { data: rows } = await supabase
              .from('intros_booked')
              .select('id, member_name, coach_name, originating_booking_id, booking_status_canon, is_vip, ignore_from_metrics, class_date, referred_by_member_name, lead_source, vip_session_id, deleted_at')
              .in('id', batch);
            (rows || []).forEach((b: any) => bookingByIdMap.set(b.id, b));
          }
        }

        // Walk originating_booking_id up to the root first intro (Total Journey).
        // Stop walking if the immediate parent's intro didn't actually run
        // (no-show / cancelled / rescheduled / deleted, OR runs all no-show) —
        // in that case the current node IS the real 1st intro.
        const parentRunsCache = new Map<string, any[]>();
        const fetchParentRuns = async (parentId: string): Promise<any[]> => {
          if (parentRunsCache.has(parentId)) return parentRunsCache.get(parentId)!;
          const { data } = await supabase
            .from('intros_run')
            .select('result, result_canon')
            .eq('linked_intro_booked_id', parentId);
          const arr = data || [];
          parentRunsCache.set(parentId, arr);
          return arr;
        };
        const rootCache = new Map<string, any>();
        const resolveRoot = async (startId: string): Promise<any | null> => {
          if (rootCache.has(startId)) return rootCache.get(startId);
          let current = bookingByIdMap.get(startId);
          const visited = new Set<string>();
          while (current?.originating_booking_id && !visited.has(current.id)) {
            visited.add(current.id);
            const parentId = current.originating_booking_id;
            if (!bookingByIdMap.has(parentId)) {
              const { data: parentRow } = await supabase
                .from('intros_booked')
                .select('id, member_name, coach_name, originating_booking_id, booking_status_canon, is_vip, ignore_from_metrics, class_date, referred_by_member_name, lead_source, vip_session_id, deleted_at')
                .eq('id', parentId)
                .maybeSingle();
              if (parentRow) bookingByIdMap.set(parentId, parentRow);
            }
            const next = bookingByIdMap.get(parentId);
            if (!next) break;
            // Stop walking if this parent isn't a real ran-intro.
            const parentStatus = (next.booking_status_canon || '').toUpperCase();
            if (next.deleted_at || NON_RAN_BOOKING_STATUSES.has(parentStatus)) break;
            const parentRuns = await fetchParentRuns(parentId);
            const parentActuallyRan = parentRuns.length === 0
              || parentRuns.some(r => didIntroActuallyRun(r));
            if (!parentActuallyRan) break;
            current = next;
          }
          rootCache.set(startId, current || null);
          return current || null;
        };

        // Resolve VIP coach for any new vip_session_ids.
        const newVipSessionIds = Array.from(new Set(
          newSales
            .map((r: any) => bookingByIdMap.get(r.linked_intro_booked_id))
            .filter((b: any) => b && (b.lead_source || '').startsWith('VIP Class') && b.vip_session_id && !vipCoachMap.has(b.vip_session_id))
            .map((b: any) => b.vip_session_id as string)
        ));
        if (newVipSessionIds.length > 0) {
          const { data: vipRows } = await (supabase as any)
            .from('vip_sessions')
            .select('id, coach_name')
            .in('id', newVipSessionIds);
          for (const v of (vipRows || [])) {
            if (v.coach_name) vipCoachMap.set(v.id, v.coach_name);
          }
        }

        for (const r of newSales) {
          const linked = bookingByIdMap.get(r.linked_intro_booked_id);
          if (!linked) continue;
          const root = (await resolveRoot(r.linked_intro_booked_id)) || linked;
          if (isBookingExcludedFromMetrics(root)) continue;

          // Coach = root first intro's coach with VIP override (Total Journey),
          // falling back to the sale run's coach if the root has none.
          const cName = resolveCloseCoach(root, root.coach_name || r.coach_name) || r.coach_name;
          if (!cName) continue;

          const ex = coachCloseMap.get(cName) || { total: 0, closed: 0 };
          ex.total++;
          ex.closed++;
          coachCloseMap.set(cName, ex);

          const isViaSecond = !!linked.originating_booking_id && root.id !== linked.id;
          ensureAttrib(cName).closes.push({
            bookingId: root.id,
            member: root.member_name || linked.member_name || 'Unknown',
            classDate: root.class_date || null,
            buyDate: r.buy_date || null,
            source: root.lead_source || null,
            resultLabel: 'SALE',
            via: isViaSecond ? '2nd_intro' : 'direct',
          });
          countedRunBookingIds.add(r.linked_intro_booked_id);
        }
      }

      // Backfill via2ndIntroSale flag on coached rows so the drill explains
      // why an originator with no direct sale is being counted as a close.
      // secondRunSaleSet holds first-intro booking IDs whose 2nd intro ran a sale.
      attribMap.forEach(a => {
        a.coached = a.coached.map(it =>
          // secondRunSaleSet may be undefined if no first intros existed
          (typeof secondRunSaleSet !== 'undefined' && secondRunSaleSet.has(it.bookingId))
            ? { ...it, via2ndIntroSale: true }
            : it
        );
      });

      // ─────────────────────────────────────────────────────────────────────
      // OTF Corporate · Last Coach attribution
      //   - Coached = every in-range intro you personally ran (1st + 2nd),
      //     credited to the coach who ran that specific class.
      //   - Closes = exactly the same sales Total Journey counted, but
      //     credited to the coach of the member's LAST attended class
      //     (walks descendants of the close's root, picks latest class_date
      //     among ran bookings; falls back to the root if nothing else ran).
      // ─────────────────────────────────────────────────────────────────────
      const coachMapCorp = new Map<string, { coached: number }>();
      const coachCloseMapCorp = new Map<string, { total: number; closed: number }>();
      const attribMapCorp = new Map<string, CoachAttribution>();
      const ensureAttribCorp = (n: string): CoachAttribution => {
        let a = attribMapCorp.get(n);
        if (!a) { a = { coached: [], closes: [], excluded: [] }; attribMapCorp.set(n, a); }
        return a;
      };

      // Coached: iterate every in-range booking that actually ran.
      allCoachBookings.forEach((b: any) => {
        const run = allRunsByBookingId.get(b.id);
        if (!run) return;
        if (!didIntroActuallyRun(run)) return;
        // Exclude VIP class intro outcomes from the coached column (matches
        // Total Journey's exclusion further down for closes).
        if (run.result_canon === 'VIP_CLASS_INTRO') return;
        const runCoachRaw = isMissingCoach(b.coach_name)
          ? (run.coach_name || b.coach_name)
          : b.coach_name;
        if (isMissingCoach(runCoachRaw)) return;
        const cName = resolveCloseCoach(b, runCoachRaw) || runCoachRaw;
        const ex = coachMapCorp.get(cName) || { coached: 0 };
        ex.coached++;
        coachMapCorp.set(cName, ex);
        ensureAttribCorp(cName).coached.push({
          bookingId: b.id,
          member: b.member_name || 'Unknown',
          classDate: b.class_date,
          source: b.lead_source,
          resultLabel: labelFromRun(run),
        });
      });

      // Closes: collect every close Total Journey already counted, then
      // re-attribute to the last-ran booking in the chain.
      type TJClose = { coach: string; root: AttribIntro };
      const tjCloses: TJClose[] = [];
      attribMap.forEach((a, coach) => {
        a.closes.forEach(c => tjCloses.push({ coach, root: c }));
      });

      // Fetch all descendants (1 hop) for every TJ close root not already
      // covered by secondIntroBookingMap (cross-period buy_date sales).
      const closeRootIds = Array.from(new Set(tjCloses.map(t => t.root.bookingId)));
      const descendantsByRoot = new Map<string, any[]>();
      // Seed from in-period second intros we already fetched (id/originating only)
      // — we'll need richer fields to re-attribute, so fetch fresh below.
      if (closeRootIds.length > 0) {
        const descBatches: string[][] = [];
        for (let i = 0; i < closeRootIds.length; i += 500) descBatches.push(closeRootIds.slice(i, i + 500));
        for (const batch of descBatches) {
          const { data: descRows } = await supabase
            .from('intros_booked')
            .select('id, member_name, coach_name, originating_booking_id, class_date, lead_source, vip_session_id, booking_status_canon, deleted_at')
            .in('originating_booking_id', batch);
          (descRows || []).forEach((d: any) => {
            const arr = descendantsByRoot.get(d.originating_booking_id) || [];
            arr.push(d);
            descendantsByRoot.set(d.originating_booking_id, arr);
          });
        }
        // Walk grandchildren too (up to 3 hops) for deeper chains.
        let frontier = Array.from(descendantsByRoot.values()).flat().map(d => d.id);
        for (let hop = 0; hop < 2 && frontier.length > 0; hop++) {
          const nextFrontier: string[] = [];
          const hopBatches: string[][] = [];
          for (let i = 0; i < frontier.length; i += 500) hopBatches.push(frontier.slice(i, i + 500));
          for (const batch of hopBatches) {
            const { data: rows } = await supabase
              .from('intros_booked')
              .select('id, member_name, coach_name, originating_booking_id, class_date, lead_source, vip_session_id, booking_status_canon, deleted_at')
              .in('originating_booking_id', batch);
            (rows || []).forEach((d: any) => {
              // Find which root this descendant ultimately belongs to.
              for (const [rootId, kids] of descendantsByRoot.entries()) {
                if (kids.some(k => k.id === d.originating_booking_id)) {
                  descendantsByRoot.get(rootId)!.push(d);
                  nextFrontier.push(d.id);
                  break;
                }
              }
            });
          }
          frontier = nextFrontier;
        }
      }

      // Fetch runs for every descendant not already in allRunsByBookingId.
      const descIds = Array.from(descendantsByRoot.values()).flat().map(d => d.id);
      const missingDescIds = descIds.filter(id => !allRunsByBookingId.has(id));
      if (missingDescIds.length > 0) {
        const drBatches: string[][] = [];
        for (let i = 0; i < missingDescIds.length; i += 500) drBatches.push(missingDescIds.slice(i, i + 500));
        for (const batch of drBatches) {
          const { data: drRuns } = await supabase
            .from('intros_run')
            .select('linked_intro_booked_id, result, result_canon, coach_name, buy_date, run_date, created_at')
            .in('linked_intro_booked_id', batch);
          (drRuns || []).forEach((r: any) => allRunsByBookingId.set(r.linked_intro_booked_id, r));
        }
      }

      // Resolve VIP coach for any descendants on VIP sessions.
      const newVipIds = Array.from(new Set(
        Array.from(descendantsByRoot.values()).flat()
          .filter((d: any) => (d.lead_source || '').startsWith('VIP Class') && d.vip_session_id && !vipCoachMap.has(d.vip_session_id))
          .map((d: any) => d.vip_session_id as string)
      ));
      if (newVipIds.length > 0) {
        const { data: vipRows } = await (supabase as any)
          .from('vip_sessions')
          .select('id, coach_name')
          .in('id', newVipIds);
        for (const v of (vipRows || [])) {
          if (v.coach_name) vipCoachMap.set(v.id, v.coach_name);
        }
      }

      // Re-attribute each close to the last-ran booking in its chain.
      tjCloses.forEach(({ coach: tjCoach, root }) => {
        // Build chain: root + descendants.
        const rootRow = bookingByIdMap.get(root.bookingId);
        const chain: any[] = [];
        if (rootRow) chain.push(rootRow);
        const descs = descendantsByRoot.get(root.bookingId) || [];
        chain.push(...descs);

        // Pick latest class_date among bookings whose run actually ran
        // (and isn't VIP_CLASS_INTRO).
        let lastRan: any = null;
        for (const b of chain) {
          const r = allRunsByBookingId.get(b.id);
          if (!r) continue;
          if (!didIntroActuallyRun(r)) continue;
          if (r.result_canon === 'VIP_CLASS_INTRO') continue;
          if (!lastRan || (b.class_date || '') > (lastRan.b.class_date || '')) {
            lastRan = { b, r };
          }
        }

        let creditCoach: string | null;
        let creditBooking: any;
        if (lastRan) {
          const runCoachRaw = isMissingCoach(lastRan.b.coach_name)
            ? (lastRan.r.coach_name || lastRan.b.coach_name)
            : lastRan.b.coach_name;
          creditCoach = isMissingCoach(runCoachRaw)
            ? tjCoach
            : (resolveCloseCoach(lastRan.b, runCoachRaw) || runCoachRaw);
          creditBooking = lastRan.b;
        } else {
          // Nothing in the chain ran — fall back to the TJ coach. This keeps
          // sum(Corp closes) === sum(TJ closes) exactly.
          creditCoach = tjCoach;
          creditBooking = rootRow;
        }
        if (!creditCoach) creditCoach = tjCoach;

        const ex = coachCloseMapCorp.get(creditCoach) || { total: 0, closed: 0 };
        ex.total++;
        ex.closed++;
        coachCloseMapCorp.set(creditCoach, ex);

        ensureAttribCorp(creditCoach).closes.push({
          bookingId: creditBooking?.id || root.bookingId,
          member: creditBooking?.member_name || root.member,
          classDate: creditBooking?.class_date || root.classDate,
          buyDate: root.buyDate,
          source: creditBooking?.lead_source || root.source,
          resultLabel: 'SALE',
          via: lastRan && lastRan.b.id !== root.bookingId ? '2nd_intro' : 'direct',
        });
      });

      const allCoachNames = new Set<string>([...coachMap.keys(), ...coachCloseMap.keys()]);
      const coachData = Array.from(allCoachNames).map(name => {
        const wk = coachMap.get(name) || { coached: 0 };
        const cl = coachCloseMap.get(name) || { total: 0, closed: 0 };
        return {
          name,
          coached: wk.coached,
          closes: cl.closed,
          // Total-journey credit: if a coach has closes but no coached 1st intros
          // in range (sale credited via a 2nd intro), show 100% rather than 0%.
          closeRate: wk.coached > 0 ? (cl.closed / wk.coached) * 100 : (cl.closed > 0 ? 100 : 0),
          closeTotal: cl.total,
        };
      }).filter(c => !isMissingCoach(c.name) && (c.coached > 0 || c.closeTotal > 0)).sort((a, b) => b.coached - a.coached);

      const totalsCoached = coachData.reduce((sum, c) => sum + (c.coached || 0), 0);
      const totalsClosed = coachData.reduce((sum, c) => sum + (c.closes || 0), 0);
      setCoachTableTotals({ coached: totalsCoached, closes: totalsClosed });
      setCoachAttribution(attribMap);

      // Corporate table rows + totals
      const allCoachNamesCorp = new Set<string>([...coachMapCorp.keys(), ...coachCloseMapCorp.keys()]);
      const coachDataCorp = Array.from(allCoachNamesCorp).map(name => {
        const wk = coachMapCorp.get(name) || { coached: 0 };
        const cl = coachCloseMapCorp.get(name) || { total: 0, closed: 0 };
        return {
          name,
          coached: wk.coached,
          closes: cl.closed,
          closeRate: wk.coached > 0 ? (cl.closed / wk.coached) * 100 : (cl.closed > 0 ? 100 : 0),
          closeTotal: cl.total,
        };
      }).filter(c => !isMissingCoach(c.name) && (c.coached > 0 || c.closeTotal > 0)).sort((a, b) => b.coached - a.coached);
      setCoachLeadMeasuresCorporate(coachDataCorp);
      setCoachTableTotalsCorporate({
        coached: coachDataCorp.reduce((s, c) => s + c.coached, 0),
        closes: coachDataCorp.reduce((s, c) => s + c.closes, 0),
      });
      setCoachAttributionCorporate(attribMapCorp);

      // Everyone (SA, Coach, Admin) sees the full Coach Stats table on WIG.
      setCoachLeadMeasures(coachData);
    } catch (err) {
      console.error('Error loading lead measures:', err);
      setSaLeadMeasures([]);
      setCoachLeadMeasures([]);
    } finally {
      setMeasuresLoading(false);
    }
  }, [dateRange, rangeStartYMD, rangeEndYMD, user?.role, user?.name]);

  useEffect(() => { loadLeadMeasures(); }, [loadLeadMeasures]);

  

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refreshData(), loadMonthlyLeads(), loadLeadMeasures()]);
    setIsRefreshing(false);
  };

  // Coach close-rate status (target is a flat % — pace == target, no proration).
  // NOTE: All hooks must run before any early return to keep hook order stable.
  const sortedCoachRows = useMemo(
    () => [...coachLeadMeasures].sort((a, b) => b.closeRate - a.closeRate || b.closes - a.closes),
    [coachLeadMeasures],
  );
  const coachTotalCoached = sortedCoachRows.reduce((s, r) => s + (r.coached || 0), 0);
  const coachTotalCloses = sortedCoachRows.reduce((s, r) => s + (r.closes || 0), 0);
  const coachWeightedRate = coachTotalCoached > 0 ? (coachTotalCloses / coachTotalCoached) * 100 : 0;
  const coachHeroStatus = statusColor(closeRate, targets.coachClose);
  const coachHeroCls = statusClasses(coachHeroStatus);
  const studioHeroCls = statusClasses(studioLeadsStatus);

  // R/Y/G thresholds for the Coach Stats lead-measure columns.
  // Scored: 100% green, 75%+ yellow, else red. Avg score: 21+ green, 11-20 yellow, else red.
  const scoredStatus = (scored: number, coached: number): import('@/lib/wig/pace').WigStatus => {
    if (coached <= 0) return 'unset';
    const pct = (scored / coached) * 100;
    if (pct >= 100) return 'green';
    if (pct >= 75) return 'yellow';
    return 'red';
  };
  const avgScoreStatus = (avg: number | null | undefined): import('@/lib/wig/pace').WigStatus => {
    if (avg == null) return 'unset';
    if (avg >= 21) return 'green';
    if (avg >= 11) return 'yellow';
    return 'red';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Trophy className="w-6 h-6 text-primary" />
            WIG
          </h1>
          <p className="text-sm text-muted-foreground hidden sm:block">The scoreboard. Pace tells you if you're winning today.</p>
          <Button variant="ghost" size="sm" onClick={handleManualRefresh} disabled={isRefreshing} className="h-8 px-2">
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        {lastUpdated && (
          <p className="text-xs text-muted-foreground/70">
            Last updated: {format(lastUpdated, 'h:mm:ss a')}
          </p>
        )}
        <div className="mt-3">
          <DateRangeFilter
            preset={datePreset}
            customRange={customRange}
            onPresetChange={setDatePreset}
            onCustomRangeChange={setCustomRange}
            dateRange={dateRange || { start: new Date(2020, 0, 1), end: new Date() }}
          />
        </div>
      </div>

      <Tabs defaultValue="sa" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-3 h-11">
          <TabsTrigger value="sa" className="text-base font-semibold">SA</TabsTrigger>
          <TabsTrigger value="coach" className="text-base font-semibold">Coach</TabsTrigger>
        </TabsList>

        {/* ===== SA TAB — Hero + Leaderboard above the fold, actions below ===== */}
        <TabsContent value="sa" className="space-y-4">
          {/* SA Leaderboard renders its own hero (team SGL) + table */}
          <WigSaLeaderboard dateRange={dateRange} />

          {/* Studio total leads — BIG hero card with pace-to-today */}
          <Card className={cn('border-2 ring-2 ring-offset-0', studioHeroCls.ring)}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Target className={cn('w-5 h-5', studioHeroCls.text)} />
                <span className="text-sm uppercase tracking-wide font-bold text-muted-foreground">
                  Studio leads · {selectedMonthLabel}
                </span>
              </div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-7xl font-black tabular-nums leading-none text-foreground">
                  {totalLeads}
                </span>
                <span className="text-xl text-foreground">
                  of {studioLeadsPace != null ? Math.round(studioLeadsPace) : <em className="not-italic text-warning">CONFIRM</em>} today
                  {targets.studioLeads != null && (
                    <span className="ml-2 text-sm text-muted-foreground">(month goal: {targets.studioLeads})</span>
                  )}
                </span>
              </div>
              <div className={cn(
                'rounded-md px-4 py-3 text-lg font-semibold',
                studioLeadsStatus === 'green' && 'bg-success/15 text-success',
                studioLeadsStatus === 'yellow' && 'bg-warning/15 text-warning',
                studioLeadsStatus === 'red' && 'bg-destructive/15 text-destructive',
                studioLeadsStatus === 'unset' && 'bg-muted text-muted-foreground',
              )}>
                {studioLeadsPace != null ? (
                  <>
                    Should be at <span className="text-3xl font-black tabular-nums">{formatPace(studioLeadsPace)}</span> by today
                    <div className="mt-1 text-base font-bold">
                      {totalLeads >= studioLeadsPace
                        ? <>You're +{Math.round(totalLeads - studioLeadsPace)} ahead ✓</>
                        : <>You're {Math.round(studioLeadsPace - totalLeads)} behind pace</>}
                    </div>
                  </>
                ) : 'Set a monthly target to see today\'s pace'}
              </div>
              <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', studioHeroCls.bar)}
                  style={{ width: `${targets.studioLeads ? Math.min(100, (totalLeads / targets.studioLeads) * 100) : 0}%` }}
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <label className="text-[11px] text-muted-foreground">
                  Update total leads for {selectedMonthLabel} (from OTF report)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={leadCount}
                  onChange={e => setLeadCount(e.target.value)}
                  className="w-24 h-7 text-xs"
                  placeholder="0"
                />
                <Button size="sm" className="h-7 text-xs" onClick={handleSaveLead} disabled={leadSaving}>
                  {leadSaved ? <Check className="w-3.5 h-3.5" /> : 'Update'}
                </Button>
                {isAdmin && (
                  editingStudioTarget ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">Target:</span>
                      <Input
                        type="number" min={0}
                        value={studioTargetInput}
                        onChange={e => setStudioTargetInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveStudioTarget(); if (e.key === 'Escape') setEditingStudioTarget(false); }}
                        className="w-20 h-7 text-xs"
                        autoFocus
                      />
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleSaveStudioTarget}>
                        <Check className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                      onClick={() => { setStudioTargetInput(targets.studioLeads == null ? '' : String(targets.studioLeads)); setEditingStudioTarget(true); }}>
                      {studioTargetSaved ? <><Check className="w-3 h-3 mr-1 text-success" />Saved</> : 'Edit target'}
                    </Button>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== COACH TAB ===== */}
        <TabsContent value="coach" className="space-y-4">
          {/* Coach close-rate HERO — R/Y/G vs adjustable monthly close-% target */}
          <Card className={cn('border-2 ring-2 ring-offset-0', coachHeroCls.ring)}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <UserCheck className={cn('w-5 h-5', coachHeroCls.text)} />
                <span className="text-sm uppercase tracking-wide font-bold text-muted-foreground">
                  Studio close rate · {selectedMonthLabel}
                </span>
              </div>
              <div className="flex items-baseline gap-3 mb-3">
                <span className={cn('text-6xl font-black tabular-nums leading-none', coachHeroCls.text)}>
                  {closeRate.toFixed(0)}%
                </span>
                <span className="text-xl text-muted-foreground">
                  target {targets.coachClose != null ? `${targets.coachClose}%` : <em className="not-italic text-warning">CONFIRM</em>}
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', coachHeroCls.bar)}
                  style={{ width: `${targets.coachClose ? Math.min(100, (closeRate / targets.coachClose) * 100) : 0}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 flex-wrap text-[11px] text-muted-foreground">
                <span>
                  {coachHeroStatus === 'green' && 'at or above target ✓'}
                  {coachHeroStatus === 'yellow' && 'a little under target'}
                  {coachHeroStatus === 'red' && 'under target — pair coaches with closes'}
                  {coachHeroStatus === 'unset' && 'set target to start'}
                </span>
                {isAdmin && (
                  editingCloseTarget ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number" min={0} max={100}
                        value={closeTargetInput}
                        onChange={e => setCloseTargetInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveCloseTarget(); if (e.key === 'Escape') setEditingCloseTarget(false); }}
                        className="w-16 h-7 text-xs"
                        autoFocus
                      />
                      <span className="text-xs">%</span>
                      <Button size="sm" className="h-7 px-2" onClick={handleSaveCloseTarget}>Save</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                      onClick={() => { setCloseTargetInput(targets.coachClose == null ? '' : String(targets.coachClose)); setEditingCloseTarget(true); }}>
                      {closeTargetSaved ? <><Check className="w-3 h-3 mr-1 text-success" />Saved</> : <><Pencil className="w-3 h-3 mr-1" />Edit target</>}
                    </Button>
                  )
                )}
              </div>
            </CardContent>
          </Card>

          {/* Coach — Coached & Closes table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-primary" />
                Coach Stats
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Lead measure: self-eval every intro you run. Tap a number to drill in.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {measuresLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
                  <span className="text-sm text-muted-foreground">Loading…</span>
                </div>
              ) : sortedCoachRows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No data for this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-sm w-10">#</TableHead>
                        <TableHead className="text-sm">Coach</TableHead>
                        <TableHead className="text-sm text-center">Coached</TableHead>
                        <TableHead className="text-sm text-center">Scored</TableHead>
                        <TableHead className="text-sm text-center">Avg score</TableHead>
                        <TableHead className="text-sm text-center">Closes</TableHead>
                        <TableHead className="text-sm text-center">
                          Close %
                          <div className="text-xs font-normal text-muted-foreground">
                            target {targets.coachClose != null ? `${targets.coachClose}%` : '—'}
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedCoachRows.map((row, idx) => {
                        const rs = statusColor(row.closeRate, targets.coachClose);
                        const rsCls = statusClasses(rs);
                        const pct = targets.coachClose ? Math.min(100, (row.closeRate / targets.coachClose) * 100) : 0;
                        const unscored = fv.data?.unscoredByCoach?.get(row.name) ?? 0;
                        const scored = Math.max(0, row.coached - unscored);
                        const selfAvg = fv.data?.selfByCoach?.get(row.name);
                        const formalAvg = fv.data?.formalByCoach?.get(row.name);
                        // Prefer self-eval (the lead measure); fall back to formal.
                        const avgVal = selfAvg?.avg ?? formalAvg?.avg ?? null;
                        return (
                          <TableRow key={row.name} className={cn(rs === 'green' && 'bg-success/5')}>
                            <TableCell className="text-sm text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                            <TableCell className="text-base font-medium whitespace-nowrap">{row.name}</TableCell>
                            <TableCell className="text-center p-0">
                              <button
                                type="button"
                                disabled={row.coached === 0}
                                onClick={() => setDrill({ coach: row.name, metric: 'coached' })}
                                className="w-full min-h-[48px] px-3 text-3xl font-black tabular-nums cursor-pointer hover:bg-muted/40 hover:underline disabled:cursor-default disabled:hover:bg-transparent disabled:hover:no-underline"
                              >
                                {row.coached}
                              </button>
                            </TableCell>
                            <TableCell className="text-center tabular-nums">
                              <span className={cn('text-3xl font-black', statusClasses(scoredStatus(scored, row.coached)).text)}>
                                {scored}/{row.coached}
                              </span>
                            </TableCell>
                            <TableCell className="text-center tabular-nums">
                              {avgVal != null
                                ? <span className={cn('text-3xl font-black', statusClasses(avgScoreStatus(avgVal)).text)}>{avgVal.toFixed(1)}</span>
                                : <span className="text-muted-foreground font-normal text-2xl">—</span>}
                            </TableCell>
                            <TableCell className="text-center p-0">
                              <button
                                type="button"
                                disabled={row.closes === 0}
                                onClick={() => setDrill({ coach: row.name, metric: 'closes' })}
                                className="w-full min-h-[48px] px-3 text-3xl font-black tabular-nums text-success cursor-pointer hover:bg-muted/40 hover:underline disabled:cursor-default disabled:hover:bg-transparent disabled:hover:no-underline"
                              >
                                {row.closes}
                              </button>
                            </TableCell>
                            <TableCell className="text-center px-2">
                              <div className={cn('font-black text-3xl tabular-nums', rsCls.text)}>
                                {row.closeRate.toFixed(0)}%
                              </div>
                              <div className="mt-1 w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                                <div className={cn('h-full rounded-full', rsCls.bar)} style={{ width: `${pct}%` }} />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {(() => {
                        const totalCoached = coachTotalCoached;
                        const totalCloses = coachTotalCloses;
                        const weightedRate = coachWeightedRate;
                        const totalUnscored = sortedCoachRows.reduce((s, r) => s + (fv.data?.unscoredByCoach?.get(r.name) ?? 0), 0);
                        const totalScored = Math.max(0, totalCoached - totalUnscored);
                        const wrs = statusColor(weightedRate, targets.coachClose);
                        const wrsCls = statusClasses(wrs);
                        return (
                          <TableRow className="border-t-2 border-border bg-muted/30 font-bold">
                            <TableCell />
                            <TableCell className="text-base font-bold whitespace-nowrap">Total</TableCell>
                            <TableCell className="text-2xl text-center font-black tabular-nums">{totalCoached}</TableCell>
                            <TableCell className={cn('text-2xl text-center font-black tabular-nums', statusClasses(scoredStatus(totalScored, totalCoached)).text)}>{totalScored}/{totalCoached}</TableCell>
                            <TableCell className="text-2xl text-center font-black text-muted-foreground">—</TableCell>
                            <TableCell className="text-2xl text-center font-black text-success tabular-nums">{totalCloses}</TableCell>
                            <TableCell className="text-2xl text-center font-black">
                              <span className={wrsCls.text}>{weightedRate.toFixed(0)}%</span>
                            </TableCell>
                          </TableRow>
                        );
                      })()}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


      <CoachAttributionDrillDown
        open={!!drill}
        onOpenChange={(o) => { if (!o) setDrill(null); }}
        coach={drill?.coach || null}
        metric={drill?.metric || 'coached'}
        source="wig"
        rangeLabel={dateRange ? `${format(dateRange.start, 'MMM d')} – ${format(dateRange.end, 'MMM d, yyyy')}` : 'All time'}
        attribution={drill ? coachAttribution.get(drill.coach) || null : null}
      />

      <PersonListDrillDown
        open={!!saDrill}
        onOpenChange={(o) => { if (!o) setSaDrill(null); }}
        title={saDrill ? `${saDrill.sa} · ${saDrill.metric === 'referralAsks' ? 'POS Referral Asks' : 'Packs Gifted'}` : ''}
        scopeBadge="WIG tab"
        subtitle={dateRange ? `${format(dateRange.start, 'MMM d')} – ${format(dateRange.end, 'MMM d, yyyy')}` : 'All time'}
        rows={saDrill ? (saPeople.get(saDrill.sa)?.[saDrill.metric] || []) : []}
        emptyText="No records for this metric."
      />
    </div>
  );
}
