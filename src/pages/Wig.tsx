import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { MilestonesDeploySection } from '@/components/dashboard/MilestonesDeploySection';
import { DatePreset, DateRange, getDateRangeForPreset } from '@/lib/pay-period';
import { Target, Trophy, ArrowDown, Users, UserCheck, Check, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { isMembershipSale, isSaleInRange } from '@/lib/sales-detection';

export default function Wig() {
  const { user } = useAuth();
  const { introsBooked, introsRun, isLoading, lastUpdated, refreshData } = useData();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Date filter — default this_month
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const dateRange = useMemo(() => getDateRangeForPreset(datePreset, customRange), [datePreset, customRange]);

  // Daily lead input
  const [leadCount, setLeadCount] = useState<string>('');
  const [leadSaving, setLeadSaving] = useState(false);
  const [leadSaved, setLeadSaved] = useState(false);

  // Lead log data
  const [leadLogData, setLeadLogData] = useState<{ log_date: string; lead_count: number }[]>([]);

  const todayYMD = format(new Date(), 'yyyy-MM-dd');

  const loadLeadLog = useCallback(async () => {
    const { data } = await supabase
      .from('daily_lead_log')
      .select('log_date, lead_count')
      .order('log_date', { ascending: false });
    setLeadLogData((data as any[]) || []);
    // Pre-fill today's value
    const todayRecord = (data as any[])?.find((r: any) => r.log_date === todayYMD);
    if (todayRecord) setLeadCount(String(todayRecord.lead_count));
  }, [todayYMD]);

  useEffect(() => { loadLeadLog(); }, [loadLeadLog]);

  const handleSaveLead = async () => {
    const count = parseInt(leadCount, 10);
    if (isNaN(count) || count < 0 || !user?.name) return;
    setLeadSaving(true);

    // Check if record exists for today
    const { data: existing } = await supabase
      .from('daily_lead_log')
      .select('id')
      .eq('log_date', todayYMD)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase.from('daily_lead_log').update({ lead_count: count, logged_by: user.name } as any).eq('id', (existing[0] as any).id);
    } else {
      await supabase.from('daily_lead_log').insert({ log_date: todayYMD, lead_count: count, logged_by: user.name } as any);
    }

    setLeadSaving(false);
    setLeadSaved(true);
    setTimeout(() => setLeadSaved(false), 2000);
    loadLeadLog();
  };

  // Compute metrics filtered by dateRange
  const totalLeads = useMemo(() => {
    if (!dateRange) return leadLogData.reduce((s, r) => s + r.lead_count, 0);
    return leadLogData
      .filter(r => {
        try {
          const d = parseLocalDate(r.log_date);
          return isWithinInterval(d, { start: dateRange.start, end: dateRange.end });
        } catch { return false; }
      })
      .reduce((s, r) => s + r.lead_count, 0);
  }, [leadLogData, dateRange]);

  const filteredBookings = useMemo(() => {
    return introsBooked.filter(b => {
      if ((b as any).is_vip) return false;
      if ((b as any).ignore_from_metrics) return false;
      const status = ((b as any).booking_status_canon || '').toUpperCase();
      if (status === 'DELETED_SOFT') return false;
      if (!dateRange) return true;
      try {
        return isWithinInterval(parseLocalDate(b.class_date), { start: dateRange.start, end: dateRange.end });
      } catch { return false; }
    });
  }, [introsBooked, dateRange]);

  const totalBooked = filteredBookings.length;

  const showedBookings = useMemo(() => {
    return filteredBookings.filter(b => {
      const canon = ((b as any).booking_status_canon || '').toUpperCase();
      return canon === 'SHOWED';
    });
  }, [filteredBookings]);

  const totalShowed = showedBookings.length;

  const totalClosed = useMemo(() => {
    return introsRun.filter(r => {
      if (!isSaleInRange(r, dateRange || null)) return false;
      return true;
    }).length;
  }, [introsRun, dateRange]);

  const leadToBookedRate = totalLeads > 0 ? (totalBooked / totalLeads) * 100 : 0;
  const bookedToShownRate = totalBooked > 0 ? (totalShowed / totalBooked) * 100 : 0;
  const closeRate = totalShowed > 0 ? (totalClosed / totalShowed) * 100 : 0;

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

  // Week boundaries for lead measures
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekStartYMD = format(weekStart, 'yyyy-MM-dd');
  const weekEndYMD = format(weekEnd, 'yyyy-MM-dd');

  // SA Lead Measures
  const [saLeadMeasures, setSaLeadMeasures] = useState<any[]>([]);
  const [coachLeadMeasures, setCoachLeadMeasures] = useState<any[]>([]);
  const [measuresLoading, setMeasuresLoading] = useState(true);

  const loadLeadMeasures = useCallback(async () => {
    setMeasuresLoading(true);

    // SA measures: referral asks, deploy activations, milestone packs
    const rangeStart = dateRange?.start ? format(dateRange.start, 'yyyy-MM-dd') : weekStartYMD;
    const rangeEnd = dateRange?.end ? format(dateRange.end, 'yyyy-MM-dd') : weekEndYMD;

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
      .select('coach_name, coach_shoutout_start, coach_shoutout_end, goal_why_captured, made_a_friend, result, result_canon, linked_intro_booked_id')
      .not('coach_name', 'is', null);

    const allCoachRuns = (coachRunsRes.data || []) as any[];

    // Get first intros only (check originating_booking_id)
    const linkedIds = allCoachRuns.map(r => r.linked_intro_booked_id).filter(Boolean);
    let originatingMap = new Map<string, boolean>();
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

    // Filter by date range for weekly metrics
    const weekRuns = firstIntroRuns.filter(r => {
      const rd = r.run_date || (r.created_at || '').split('T')[0];
      if (!rd) return false;
      try {
        return isWithinInterval(parseLocalDate(rd), { start: dateRange?.start || weekStart, end: dateRange?.end || weekEnd });
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
    const coachMap = new Map<string, { coached: number; shoutouts: number; whyUsed: number; friends: number; closes: number; closeTotal: number }>();

    // Populate from weekly runs for lead measures
    weekRuns.forEach(r => {
      const name = r.coach_name;
      const ex = coachMap.get(name) || { coached: 0, shoutouts: 0, whyUsed: 0, friends: 0, closes: 0, closeTotal: 0 };
      ex.coached++;
      if (r.coach_shoutout_start || r.coach_shoutout_end) ex.shoutouts++;
      if (r.goal_why_captured === 'yes') ex.whyUsed++;
      if (r.made_a_friend) ex.friends++;
      coachMap.set(name, ex);
    });

    // Close rate from all date-range runs
    const coachCloseMap = new Map<string, { total: number; closed: number }>();
    closeRateRuns.forEach(r => {
      const name = r.coach_name;
      const ex = coachCloseMap.get(name) || { total: 0, closed: 0 };
      ex.total++;
      if (r.result_canon === 'SALE' || isMembershipSale(r.result)) ex.closed++;
      coachCloseMap.set(name, ex);
    });

    // Merge
    const allCoachNames = new Set([...coachMap.keys(), ...coachCloseMap.keys()]);
    const coachData = Array.from(allCoachNames).map(name => {
      const wk = coachMap.get(name) || { coached: 0, shoutouts: 0, whyUsed: 0, friends: 0, closes: 0, closeTotal: 0 };
      const cl = coachCloseMap.get(name) || { total: 0, closed: 0 };
      return {
        name,
        coached: wk.coached,
        shoutoutRate: wk.coached > 0 ? (wk.shoutouts / wk.coached) * 100 : 0,
        whyUsedRate: wk.coached > 0 ? (wk.whyUsed / wk.coached) * 100 : 0,
        friendRate: wk.coached > 0 ? (wk.friends / wk.coached) * 100 : 0,
        closeRate: cl.total > 0 ? (cl.closed / cl.total) * 100 : 0,
        closeTotal: cl.total,
      };
    }).filter(c => c.coached > 0 || c.closeTotal > 0).sort((a, b) => b.coached - a.coached);

    // Coach role filter
    if (user?.role === 'Coach') {
      setCoachLeadMeasures(coachData.filter(c => c.name === user.name));
    } else {
      setCoachLeadMeasures(coachData);
    }

    setMeasuresLoading(false);
  }, [dateRange, weekStart, weekEnd, weekStartYMD, weekEndYMD, user]);

  useEffect(() => { loadLeadMeasures(); }, [loadLeadMeasures]);

  const totalTeamDeploys = saLeadMeasures.reduce((s, r) => s + r.deploys, 0);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refreshData(), loadLeadLog(), loadLeadMeasures()]);
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
    { label: 'Leads this period', current: totalLeads, target: 650, isPercent: false },
    { label: 'Lead to booked', current: leadToBookedRate, target: 70, isPercent: true },
    { label: 'Booked to shown', current: bookedToShownRate, target: 70, isPercent: true },
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
        {/* Daily lead input */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Today's leads (from OTF report)</label>
              <Input
                type="number"
                min={0}
                value={leadCount}
                onChange={e => setLeadCount(e.target.value)}
                className="w-24 h-8 text-sm"
                placeholder="0"
              />
              <Button size="sm" className="h-8 text-xs" onClick={handleSaveLead} disabled={leadSaving}>
                {leadSaved ? <Check className="w-3.5 h-3.5" /> : 'Save'}
              </Button>
              {leadSaved && <span className="text-xs text-success">Saved</span>}
            </div>
          </CardContent>
        </Card>

        {/* Metric cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {scoreCards.map(card => {
            const progressValue = card.isPercent
              ? Math.min((card.current / card.target) * 100, 100)
              : Math.min((card.current / card.target) * 100, 100);
            return (
              <Card key={card.label}>
                <CardContent className="p-3 text-center space-y-1">
                  <p className={cn('text-2xl font-bold', getStatusColor(card.current, card.target))}>
                    {card.isPercent ? `${card.current.toFixed(0)}%` : card.current}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Target: {card.isPercent ? `${card.target}%` : card.target}</p>
                  <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', getBarColor(card.current, card.target))}
                      style={{ width: `${progressValue}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{card.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Live Conversion Funnel
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex flex-col items-center gap-1">
              {[
                { label: 'Leads', value: totalLeads, color: 'bg-muted text-foreground', width: 100 },
                { label: 'Booked', value: totalBooked, color: 'bg-info/20 text-info border border-info/30', width: 85 },
                { label: 'Shown', value: totalShowed, color: 'bg-warning/20 text-warning border border-warning/30', width: 70 },
                { label: 'Closed', value: totalClosed, color: 'bg-success/20 text-success border border-success/30', width: 55 },
              ].map((stage, i, arr) => (
                <div key={stage.label} className="w-full">
                  <div
                    className={cn('flex items-center justify-between p-3 rounded-lg', stage.color)}
                    style={{ width: `${stage.width}%`, margin: '0 auto' }}
                  >
                    <span className="text-sm font-medium">{stage.label}</span>
                    <span className="text-lg font-bold">{stage.value}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="flex items-center justify-center my-1">
                      <ArrowDown className="w-4 h-4 text-muted-foreground" />
                      {arr[i + 1].value > 0 && stage.value > 0 && (
                        <span className={cn(
                          'ml-2 text-xs font-medium',
                          (arr[i + 1].value / stage.value) >= 0.7 ? 'text-success' :
                          (arr[i + 1].value / stage.value) >= 0.5 ? 'text-warning' : 'text-destructive'
                        )}>
                          {((arr[i + 1].value / stage.value) * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
              <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
            ) : saLeadMeasures.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No data for this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">SA</TableHead>
                      <TableHead className="text-xs text-center">Referral Asks</TableHead>
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
              <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
            ) : coachLeadMeasures.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No data for this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Coach</TableHead>
                      <TableHead className="text-xs text-center">Coached</TableHead>
                      <TableHead className="text-xs text-center">Shoutout %</TableHead>
                      <TableHead className="text-xs text-center">Got Curious %</TableHead>
                      <TableHead className="text-xs text-center">Intro to Member %</TableHead>
                      <TableHead className="text-xs text-center">Close %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coachLeadMeasures.map(row => (
                      <TableRow key={row.name}>
                        <TableCell className="text-sm font-medium whitespace-nowrap">{row.name}</TableCell>
                        <TableCell className="text-sm text-center">{row.coached}</TableCell>
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
      <MilestonesDeploySection />
    </div>
  );
}
