import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { MilestonesDeploySection } from '@/components/dashboard/MilestonesDeploySection';
import { ReferralAskTracker } from '@/components/dashboard/ReferralAskTracker';
import { WigFirstVisitSection } from '@/components/scorecard/WigFirstVisitSection';
import { DatePreset, DateRange, getDateRangeForPreset } from '@/lib/pay-period';
import { Target, Trophy, Users, UserCheck, Check, Loader2, RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, isWithinInterval, startOfMonth, endOfMonth, differenceInDays, startOfQuarter, endOfQuarter } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { isMembershipSale, isSaleInRange, isRunInRange } from '@/lib/sales-detection';
import { isCloseRun } from '@/lib/intros/close-detection';
import { isCloseResult, labelForRun } from '@/lib/intros/resultLabels';
import { isBookingExcludedFromMetrics } from '@/lib/intros/excludedBookings';
import { resolvePromotedOrphanBookingIds } from '@/lib/intros/orphanedFirstIntros';
import { CoachAttributionDrillDown, type CoachAttribution, type AttribIntro } from '@/components/dashboard/CoachAttributionDrillDown';
import { PersonListDrillDown, type PersonRow } from '@/components/dashboard/PersonListDrillDown';
import { getNowCentral, getCurrentMonthYear } from '@/lib/dateUtils';

export default function Wig() {
  const { user } = useAuth();
  const { introsBooked, introsRun, isLoading, lastUpdated, refreshData } = useData();
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // Editable lead target
  const [leadTarget, setLeadTarget] = useState<number>(240);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState<string>('240');
  const [targetSaved, setTargetSaved] = useState(false);

  const loadLeadTarget = useCallback(async () => {
    const { data } = await supabase
      .from('studio_settings')
      .select('setting_value')
      .eq('setting_key', 'wig_lead_target')
      .maybeSingle();
    if (data) {
      const val = parseInt((data as any).setting_value, 10);
      if (!isNaN(val)) {
        setLeadTarget(val);
        setTargetInput(String(val));
      }
    }
  }, []);

  useEffect(() => { loadLeadTarget(); }, [loadLeadTarget]);

  const handleSaveTarget = async () => {
    const val = parseInt(targetInput, 10);
    if (isNaN(val) || val < 0) return;
    const { error } = await supabase
      .from('studio_settings')
      .update({ setting_value: String(val), updated_by: user?.name || 'unknown', updated_at: new Date().toISOString() } as any)
      .eq('setting_key', 'wig_lead_target');
    if (!error) {
      setLeadTarget(val);
      setEditingTarget(false);
      setTargetSaved(true);
      setTimeout(() => setTargetSaved(false), 2000);
    } else {
      toast.error('Failed to save target');
    }
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

  const getStatusColor = (current: number, target: number) => {
    const ratio = current / target;
    if (ratio >= 0.8) return 'text-success';
    if (ratio >= 0.5) return 'text-warning';
    return 'text-destructive';
  };

  const getBarColor = (current: number, target: number) => {
    const ratio = current / target;
    if (ratio >= 0.8) return 'bg-success';
    if (ratio >= 0.5) return 'bg-warning';
    return 'bg-destructive';
  };

  // Pacing indicator for leads card
  const pacingInfo = useMemo(() => {
    if (!datePreset || !['this_month', 'this_quarter'].includes(datePreset)) return null;
    if (totalLeads === 0 || leadTarget === 0) return null;

    const today = getNowCentral();
    let periodStart: Date;
    let periodEnd: Date;

    if (datePreset === 'this_month') {
      periodStart = startOfMonth(today);
      periodEnd = endOfMonth(today);
    } else {
      periodStart = startOfQuarter(today);
      periodEnd = endOfQuarter(today);
    }

    const daysElapsed = differenceInDays(today, periodStart) + 1;
    const totalDays = differenceInDays(periodEnd, periodStart) + 1;
    if (daysElapsed <= 0) return null;

    const projected = Math.round((totalLeads / daysElapsed) * totalDays);
    const color = projected >= leadTarget
      ? 'text-success'
      : projected >= leadTarget * 0.8
        ? 'text-warning'
        : 'text-destructive';

    return { projected, color };
  }, [datePreset, totalLeads, leadTarget]);

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
            .select('linked_intro_booked_id, result, result_canon')
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

      // Fetch linked intros_run rows for showed-intro detection + close coach attribution
      const firstIntroBookingIds = firstIntroBookings.map(b => b.id);
      const showedBookingIds = new Set<string>();
      const runsByBookingId = new Map<string, any>();
      if (firstIntroBookingIds.length > 0) {
        const runBatches: string[][] = [];
        for (let i = 0; i < firstIntroBookingIds.length; i += 500) runBatches.push(firstIntroBookingIds.slice(i, i + 500));
        for (const batch of runBatches) {
          const { data: runs } = await supabase
            .from('intros_run')
            .select('linked_intro_booked_id, result, result_canon, coach_name, run_date, created_at')
            .in('linked_intro_booked_id', batch);
          (runs || []).forEach((r: any) => {
            if (r.result_canon === 'NO_SHOW' || r.result_canon === 'UNRESOLVED') return;
            showedBookingIds.add(r.linked_intro_booked_id);
            runsByBookingId.set(r.linked_intro_booked_id, r);
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
              .select('linked_intro_booked_id, result, result_canon')
              .in('linked_intro_booked_id', batch2);
            (secondRuns || []).forEach((r2: any) => {
              if (isCloseRun(r2)) {
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

        for (const batch of closeBatches) {
          const { data: runs } = await supabase
            .from('intros_run')
            .select('linked_intro_booked_id, coach_name, result, result_canon')
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
            if (isCloseRun(r)) {
              ex.closed++;
              ensureAttrib(cName).closes.push({ ...introBase, via: 'direct', resultLabel: 'SALE' });
            } else if (r.linked_intro_booked_id && secondRunSaleSet.has(r.linked_intro_booked_id)) {
              // Total Journey: 2nd intro resulted in sale → credit this coach
              ex.closed++;
              ensureAttrib(cName).closes.push({ ...introBase, via: '2nd_intro', resultLabel: 'SALE' });
            }
            coachCloseMap.set(cName, ex);
          });
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


      const allCoachNames = new Set<string>([...coachMap.keys(), ...coachCloseMap.keys()]);
      const coachData = Array.from(allCoachNames).map(name => {
        const wk = coachMap.get(name) || { coached: 0 };
        const cl = coachCloseMap.get(name) || { total: 0, closed: 0 };
        return {
          name,
          coached: wk.coached,
          closes: cl.closed,
          closeRate: wk.coached > 0 ? (cl.closed / wk.coached) * 100 : 0,
          closeTotal: cl.total,
        };
      }).filter(c => !isMissingCoach(c.name) && (c.coached > 0 || c.closeTotal > 0)).sort((a, b) => b.coached - a.coached);

      const totalsCoached = coachData.reduce((sum, c) => sum + (c.coached || 0), 0);
      const totalsClosed = coachData.reduce((sum, c) => sum + (c.closes || 0), 0);
      setCoachTableTotals({ coached: totalsCoached, closes: totalsClosed });
      setCoachAttribution(attribMap);

      if (user?.role === 'Coach') {
        setCoachLeadMeasures(coachData.filter(c => c.name === user.name));
      } else {
        setCoachLeadMeasures(coachData);
      }
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const scoreCards = [
    { label: 'Leads this period', current: totalLeads, target: leadTarget, isPercent: false },
    { label: 'Close rate', current: closeRate, target: 40, isPercent: true },
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            WIG
          </h1>
          <p className="text-xs text-muted-foreground">The scoreboard. Your lead measures and the studio's quarterly targets.</p>
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

      {/* SECTION 1 — SCOREBOARD */}
      <div className="space-y-4">
        {/* Monthly lead input */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">
                Total leads for {selectedMonthLabel} (from OTF report)
              </label>
              <Input
                type="number"
                min={0}
                value={leadCount}
                onChange={e => setLeadCount(e.target.value)}
                className="w-24 h-8 text-sm"
                placeholder="0"
              />
              <Button size="sm" className="h-8 text-xs" onClick={handleSaveLead} disabled={leadSaving}>
                {leadSaved ? <Check className="w-3.5 h-3.5" /> : 'Update'}
              </Button>
              {leadSaved && <span className="text-xs text-success">Saved</span>}
            </div>
          </CardContent>
        </Card>

        {/* Metric cards */}
        <div className="grid grid-cols-2 gap-2">
          {scoreCards.map(card => {
            const progressValue = Math.min((card.current / card.target) * 100, 100);
            const isLeadCard = card.label === 'Leads this period';
            return (
              <Card key={card.label}>
                <CardContent className="p-3 text-center space-y-1">
                  <p className={cn('text-2xl font-bold', getStatusColor(card.current, card.target))}>
                    {card.isPercent ? `${card.current.toFixed(0)}%` : card.current}
                  </p>
                  {isLeadCard && editingTarget ? (
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-[10px] text-muted-foreground">Target:</span>
                      <Input
                        type="number"
                        min={0}
                        value={targetInput}
                        onChange={e => setTargetInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveTarget(); if (e.key === 'Escape') { setEditingTarget(false); setTargetInput(String(leadTarget)); } }}
                        className="w-16 h-5 text-[10px] px-1 text-center"
                        autoFocus
                      />
                      <Button size="sm" variant="ghost" className="h-5 px-1" onClick={handleSaveTarget}>
                        <Check className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <p
                      className={cn('text-[10px] text-muted-foreground', isLeadCard && 'cursor-pointer hover:text-foreground hover:underline')}
                      onClick={isLeadCard ? () => { setTargetInput(String(leadTarget)); setEditingTarget(true); } : undefined}
                      title={isLeadCard ? 'Tap to edit target' : undefined}
                    >
                      Target: {card.isPercent ? `${card.target}%` : card.target}
                      {isLeadCard && targetSaved && <span className="ml-1 text-success">Saved</span>}
                    </p>
                  )}
                  <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', getBarColor(card.current, card.target))}
                      style={{ width: `${progressValue}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{card.label}</p>
                  {isLeadCard && pacingInfo && (
                    <p className={cn('text-[10px] font-medium', pacingInfo.color)}>
                      On pace for ~{pacingInfo.projected} {pacingInfo.projected >= leadTarget ? '✓' : ''}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Coach Lead Measures table removed — replaced by First Visit Experience scorecard system (coming next) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" />
              Coach — Coached & Closes
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Tap a number to see who.</p>
          </CardHeader>
          <CardContent className="p-0">
            {measuresLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-2" />
                <span className="text-xs text-muted-foreground">Loading…</span>
              </div>
            ) : coachLeadMeasures.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No data for this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Coach</TableHead>
                      <TableHead className="text-xs text-center">Coached</TableHead>
                      <TableHead className="text-xs text-center">Closes</TableHead>
                      <TableHead className="text-xs text-center">Close %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coachLeadMeasures.map(row => (
                      <TableRow key={row.name}>
                        <TableCell className="text-sm font-medium whitespace-nowrap">{row.name}</TableCell>
                        <TableCell className="text-sm text-center p-0">
                          <button
                            type="button"
                            disabled={row.coached === 0}
                            onClick={() => setDrill({ coach: row.name, metric: 'coached' })}
                            className="w-full min-h-[44px] px-3 cursor-pointer hover:bg-muted/40 hover:underline disabled:cursor-default disabled:hover:bg-transparent disabled:hover:no-underline"
                          >
                            {row.coached}
                          </button>
                        </TableCell>
                        <TableCell className="text-sm text-center font-medium text-success p-0">
                          <button
                            type="button"
                            disabled={row.closes === 0}
                            onClick={() => setDrill({ coach: row.name, metric: 'closes' })}
                            className="w-full min-h-[44px] px-3 cursor-pointer hover:bg-muted/40 hover:underline disabled:cursor-default disabled:hover:bg-transparent disabled:hover:no-underline"
                          >
                            {row.closes}
                          </button>
                        </TableCell>
                        <TableCell className="text-sm text-center">
                          <span className={row.closeRate >= 40 ? 'text-success' : row.closeRate >= 30 ? 'text-warning' : 'text-destructive'}>
                            {row.closeRate.toFixed(0)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SECTION — FIRST VISIT EXPERIENCE (auto-counts intros & scorecards per coach) */}
        <WigFirstVisitSection dateRange={dateRange} />
      </div>

      {/* SECTION 2 — SA LEAD MEASURES */}
      <div className="space-y-4">
        {/* SA Lead Measures */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              SA Lead Measures
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {measuresLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-2" />
                <span className="text-xs text-muted-foreground">Loading…</span>
              </div>
            ) : saLeadMeasures.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No data for this period — all values are 0.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">SA</TableHead>
                      <TableHead className="text-xs text-center">POS Referral Ask</TableHead>
                      <TableHead className="text-xs text-center">Packs Gifted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saLeadMeasures.map(row => (
                      <TableRow key={row.name}>
                        <TableCell className="text-sm font-medium whitespace-nowrap">{row.name}</TableCell>
                        <TableCell className="text-sm text-center p-0">
                          <button
                            type="button"
                            disabled={row.referralAsks === 0}
                            onClick={() => setSaDrill({ sa: row.name, metric: 'referralAsks' })}
                            className="w-full min-h-[44px] px-3 cursor-pointer hover:bg-muted/40 hover:underline disabled:cursor-default disabled:hover:bg-transparent disabled:hover:no-underline"
                          >
                            {row.referralAsks}
                          </button>
                        </TableCell>
                        <TableCell className="text-sm text-center p-0">
                          <button
                            type="button"
                            disabled={row.packs === 0}
                            onClick={() => setSaDrill({ sa: row.name, metric: 'packs' })}
                            className="w-full min-h-[44px] px-3 cursor-pointer hover:bg-muted/40 hover:underline disabled:cursor-default disabled:hover:bg-transparent disabled:hover:no-underline"
                          >
                            {row.packs}
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Referral Ask Tracker — closed memberships needing a referral ask */}
        <ReferralAskTracker dateRange={dateRange} />

      </div>

      {/* SECTION 3 — MILESTONES & DEPLOY */}
      <MilestonesDeploySection dateRange={dateRange} />

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
