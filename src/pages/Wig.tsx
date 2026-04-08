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
import { DatePreset, DateRange, getDateRangeForPreset } from '@/lib/pay-period';
import { Target, Trophy, Users, UserCheck, Check, Loader2, RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, isWithinInterval, startOfMonth, endOfMonth, differenceInDays, startOfQuarter, endOfQuarter } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { isMembershipSale, isSaleInRange, isRunInRange } from '@/lib/sales-detection';
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
  const [leadTarget, setLeadTarget] = useState<number>(650);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState<string>('650');
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
      if ((b as any).is_vip) return false;
      if ((b as any).ignore_from_metrics) return false;
      const status = ((b as any).booking_status_canon || '').toUpperCase();
      if (status === 'DELETED_SOFT' || status.includes('DUPLICATE') || status.includes('DELETED') || status.includes('DEAD')) return false;
      if (!dateRange) return true;
      try {
        return isWithinInterval(parseLocalDate(b.class_date), { start: dateRange.start, end: effectiveEnd });
      } catch { return false; }
    });
  }, [introsBooked, dateRange]);

  const totalBooked = filteredBookings.length;

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
      // If linked to a booking, make sure it's in our active set
      if (r.linked_intro_booked_id && !activeBookingIds.has(r.linked_intro_booked_id)) return;
      count++;
    });
    return count;
  }, [introsRun, dateRange, filteredBookings]);

  // Pull-forward: ensure funnel doesn't show impossible numbers
  const effectiveShowed = Math.max(totalShowed, totalClosed);
  const effectiveBooked = Math.max(totalBooked, effectiveShowed);

  const leadToBookedRate = totalLeads > 0 ? (effectiveBooked / totalLeads) * 100 : 0;
  const bookedToShownRate = effectiveBooked > 0 ? (effectiveShowed / effectiveBooked) * 100 : 0;
  const closeRate = effectiveShowed > 0 ? (totalClosed / effectiveShowed) * 100 : 0;

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
  const [coachLeadMeasures, setCoachLeadMeasures] = useState<any[]>([]);
  const [measuresLoading, setMeasuresLoading] = useState(true);

  const loadLeadMeasures = useCallback(async () => {
    setMeasuresLoading(true);
    try {
      const rangeStart = rangeStartYMD;
      const rangeEnd = rangeEndYMD;

      const [refRes, deployRes, milestoneRes] = await Promise.all([
        supabase
          .from('intros_booked')
          .select('booked_by, coach_referral_asked')
          .eq('coach_referral_asked', true)
          .gte('class_date', rangeStart)
          .lte('class_date', rangeEnd),
        supabase
          .from('milestones')
          .select('created_by')
          .eq('entry_type', 'deploy')
          .gte('created_at', rangeStart)
          .lte('created_at', rangeEnd + 'T23:59:59'),
        supabase
          .from('milestones')
          .select('created_by, five_class_pack_gifted')
          .eq('entry_type', 'milestone')
          .eq('five_class_pack_gifted', true)
          .gte('created_at', rangeStart)
          .lte('created_at', rangeEnd + 'T23:59:59'),
      ]);

      // Aggregate by SA
      const saMap = new Map<string, { referralAsks: number; deploys: number; packs: number }>();
      (refRes.data || []).forEach((r: any) => {
        const name = r.booked_by || 'Unknown';
        const ex = saMap.get(name) || { referralAsks: 0, deploys: 0, packs: 0 };
        ex.referralAsks++;
        saMap.set(name, ex);
      });
      (deployRes.data || []).forEach((r: any) => {
        const name = r.created_by || 'Unknown';
        const ex = saMap.get(name) || { referralAsks: 0, deploys: 0, packs: 0 };
        ex.deploys++;
        saMap.set(name, ex);
      });
      (milestoneRes.data || []).forEach((r: any) => {
        const name = r.created_by || 'Unknown';
        const ex = saMap.get(name) || { referralAsks: 0, deploys: 0, packs: 0 };
        ex.packs++;
        saMap.set(name, ex);
      });

      const saData = Array.from(saMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.referralAsks - a.referralAsks);
      setSaLeadMeasures(saData);

      // Coach measures
      const coachRunsRes = await supabase
        .from('intros_run')
        .select('coach_name, coach_shoutout_start, coach_shoutout_end, goal_why_captured, made_a_friend, result, result_canon, linked_intro_booked_id, run_date, created_at')
        .not('coach_name', 'is', null)
        .neq('result_canon', 'NO_SHOW')
        .neq('result_canon', 'UNRESOLVED');

      // Also fetch coach_member_pair_plan from intros_booked for pairing rate
      const pairPlanRes = await supabase
        .from('intros_booked')
        .select('id, coach_member_pair_plan, originating_booking_id')
        .not('coach_member_pair_plan', 'is', null);

      const allCoachRuns = (coachRunsRes.data || []) as any[];

      // Get first intros only (check originating_booking_id)
      const linkedIds = allCoachRuns.map(r => r.linked_intro_booked_id).filter(Boolean);
      const originatingMap = new Map<string, boolean>();
      if (linkedIds.length > 0) {
        const batches: string[][] = [];
        for (let i = 0; i < linkedIds.length; i += 500) batches.push(linkedIds.slice(i, i + 500));
        for (const batch of batches) {
          const { data: bookings } = await supabase
            .from('intros_booked')
            .select('id, originating_booking_id')
            .in('id', batch);
          (bookings || []).forEach((b: any) => {
            originatingMap.set(b.id, !!b.originating_booking_id);
          });
        }
      }

      const firstIntroRuns = allCoachRuns.filter(r => {
        if (!r.linked_intro_booked_id) return true;
        return !originatingMap.get(r.linked_intro_booked_id);
      });

      // Filter by date range
      const periodRuns = firstIntroRuns.filter(r => {
        const rd = r.run_date || (r.created_at || '').split('T')[0];
        if (!rd) return false;
        if (!dateRange) return true;
        try {
          return isWithinInterval(parseLocalDate(rd), { start: dateRange.start, end: dateRange.end });
        } catch { return false; }
      });

      // All-time for close rate (or date-range filtered)
      const closeRateRuns = firstIntroRuns.filter(r => {
        const rd = r.run_date || (r.created_at || '').split('T')[0];
        if (!rd) return false;
        if (!dateRange) return true;
        try {
          return isWithinInterval(parseLocalDate(rd), { start: dateRange.start, end: dateRange.end });
        } catch { return false; }
      });

      // Aggregate coaches
      // Build pairing plan set (first intros with coach_member_pair_plan set)
      const pairPlanBookingIds = new Set(
        ((pairPlanRes.data || []) as any[])
          .filter(b => !b.originating_booking_id)
          .map(b => b.id)
      );

      // Fetch debrief submission data for debrief rate
      const debriefBookingIds = periodRuns.map(r => r.linked_intro_booked_id).filter(Boolean);
      const debriefMap = new Map<string, boolean>();
      if (debriefBookingIds.length > 0) {
        const debriefBatches: string[][] = [];
        for (let i = 0; i < debriefBookingIds.length; i += 500) debriefBatches.push(debriefBookingIds.slice(i, i + 500));
        for (const batch of debriefBatches) {
          const { data: dRows } = await supabase
            .from('intros_booked')
            .select('id, coach_debrief_submitted' as any)
            .in('id', batch);
          (dRows || []).forEach((b: any) => { debriefMap.set(b.id, b.coach_debrief_submitted === true); });
        }
      }

      const coachMap = new Map<string, { coached: number; shoutouts: number; answeredShoutout: number; whyUsed: number; answeredWhy: number; friends: number; answeredFriend: number; paired: number; debriefed: number }>();
      periodRuns.forEach(r => {
        const name = r.coach_name;
        const ex = coachMap.get(name) || { coached: 0, shoutouts: 0, answeredShoutout: 0, whyUsed: 0, answeredWhy: 0, friends: 0, answeredFriend: 0, paired: 0, debriefed: 0 };
        ex.coached++;
        // Only count answered (non-null) for rates
        if (r.coach_shoutout_start != null || r.coach_shoutout_end != null) {
          ex.answeredShoutout++;
          if (r.coach_shoutout_start || r.coach_shoutout_end) ex.shoutouts++;
        }
        if (r.goal_why_captured != null) {
          ex.answeredWhy++;
          if (r.goal_why_captured === 'yes') ex.whyUsed++;
        }
        if (r.made_a_friend != null) {
          ex.answeredFriend++;
          if (r.made_a_friend) ex.friends++;
        }
        if (r.linked_intro_booked_id && pairPlanBookingIds.has(r.linked_intro_booked_id)) ex.paired++;
        if (r.linked_intro_booked_id && debriefMap.get(r.linked_intro_booked_id)) ex.debriefed++;
        coachMap.set(name, ex);
      });

      const coachCloseMap = new Map<string, { total: number; closed: number }>();
      closeRateRuns.forEach(r => {
        const name = r.coach_name;
        const ex = coachCloseMap.get(name) || { total: 0, closed: 0 };
        ex.total++;
        if (r.result_canon === 'SALE' || isMembershipSale(r.result)) ex.closed++;
        coachCloseMap.set(name, ex);
      });

      const allCoachNames = new Set([...coachMap.keys(), ...coachCloseMap.keys()]);
      const coachData = Array.from(allCoachNames).map(name => {
        const wk = coachMap.get(name) || { coached: 0, shoutouts: 0, answeredShoutout: 0, whyUsed: 0, answeredWhy: 0, friends: 0, answeredFriend: 0, paired: 0, debriefed: 0 };
        const cl = coachCloseMap.get(name) || { total: 0, closed: 0 };
        return {
          name,
          coached: wk.coached,
          shoutoutRate: wk.answeredShoutout > 0 ? (wk.shoutouts / wk.answeredShoutout) * 100 : 0,
          whyUsedRate: wk.answeredWhy > 0 ? (wk.whyUsed / wk.answeredWhy) * 100 : 0,
          friendRate: wk.answeredFriend > 0 ? (wk.friends / wk.answeredFriend) * 100 : 0,
          pairingRate: wk.coached > 0 ? (wk.paired / wk.coached) * 100 : 0,
          closeRate: cl.total > 0 ? (cl.closed / cl.total) * 100 : 0,
          closeTotal: cl.total,
          debriefRate: wk.coached > 0 ? (wk.debriefed / wk.coached) * 100 : 0,
        };
      }).filter(c => c.coached > 0 || c.closeTotal > 0).sort((a, b) => b.coached - a.coached);

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

  const totalTeamDeploys = saLeadMeasures.reduce((s, r) => s + r.deploys, 0);

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

      </div>

      {/* SECTION 2 — LEAD MEASURES */}
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
            {/* Team deploy total */}
            <div className="px-4 py-2 border-b">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Team Deploy Activations</span>
                <span className="font-medium">{totalTeamDeploys} / 5</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden mt-1">
                <div
                  className={cn('h-full rounded-full transition-all', totalTeamDeploys >= 4 ? 'bg-success' : totalTeamDeploys >= 2 ? 'bg-warning' : 'bg-destructive')}
                  style={{ width: `${Math.min((totalTeamDeploys / 5) * 100, 100)}%` }}
                />
              </div>
            </div>
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
                      <TableHead className="text-xs text-center">Deploys</TableHead>
                      <TableHead className="text-xs text-center">Packs Gifted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saLeadMeasures.map(row => (
                      <TableRow key={row.name}>
                        <TableCell className="text-sm font-medium whitespace-nowrap">{row.name}</TableCell>
                        <TableCell className="text-sm text-center">{row.referralAsks}</TableCell>
                        <TableCell className="text-sm text-center">{row.deploys}</TableCell>
                        <TableCell className="text-sm text-center">{row.packs}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coach Lead Measures */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" />
              Coach Lead Measures
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {measuresLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-2" />
                <span className="text-xs text-muted-foreground">Loading…</span>
              </div>
            ) : coachLeadMeasures.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No data for this period — all values are 0.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Coach</TableHead>
                      <TableHead className="text-xs text-center">Coached</TableHead>
                      <TableHead className="text-xs text-center">Debrief %</TableHead>
                      <TableHead className="text-xs text-center">Shoutout %</TableHead>
                      <TableHead className="text-xs text-center">Got Curious %</TableHead>
                      <TableHead className="text-xs text-center">Intro to Member %</TableHead>
                      <TableHead className="text-xs text-center">Pairing %</TableHead>
                      <TableHead className="text-xs text-center">Close %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coachLeadMeasures.map(row => (
                      <TableRow key={row.name}>
                        <TableCell className="text-sm font-medium whitespace-nowrap">{row.name}</TableCell>
                        <TableCell className="text-sm text-center">{row.coached}</TableCell>
                        <TableCell className="text-sm text-center">
                          <span className={row.debriefRate >= 90 ? 'text-success' : row.debriefRate >= 70 ? 'text-warning' : 'text-destructive'}>
                            {row.debriefRate.toFixed(0)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-center">
                          <span className={row.shoutoutRate >= 100 ? 'text-success' : row.shoutoutRate >= 50 ? 'text-warning' : 'text-destructive'}>
                            {row.shoutoutRate.toFixed(0)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-center">
                          <span className={row.whyUsedRate >= 75 ? 'text-success' : row.whyUsedRate >= 50 ? 'text-warning' : 'text-destructive'}>
                            {row.whyUsedRate.toFixed(0)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-center">
                          <span className={row.friendRate >= 100 ? 'text-success' : row.friendRate >= 50 ? 'text-warning' : 'text-destructive'}>
                            {row.friendRate.toFixed(0)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-center">
                          <span className={row.pairingRate >= 100 ? 'text-success' : row.pairingRate >= 50 ? 'text-warning' : 'text-destructive'}>
                            {row.pairingRate.toFixed(0)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-center">
                          <div>
                            <span className={row.closeRate >= 40 ? 'text-success' : row.closeRate >= 30 ? 'text-warning' : 'text-destructive'}>
                              {row.closeRate.toFixed(0)}%
                            </span>
                            <p className="text-[9px] text-muted-foreground">Period to date</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SECTION 3 — MILESTONES & DEPLOY */}
      <MilestonesDeploySection dateRange={dateRange} />
    </div>
  );
}
