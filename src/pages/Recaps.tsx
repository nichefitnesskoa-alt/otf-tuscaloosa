import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, Copy, TrendingUp, Trophy, RefreshCw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StudioScoreboard } from '@/components/dashboard/StudioScoreboard';
import { PerSATable } from '@/components/dashboard/PerSATable';
import { BookerStatsTable } from '@/components/dashboard/BookerStatsTable';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { EmployeeFilter } from '@/components/dashboard/EmployeeFilter';
import { PipelineFunnel } from '@/components/dashboard/PipelineFunnel';
import { LeadSourceChart } from '@/components/dashboard/LeadSourceChart';
import { AmcTracker } from '@/components/dashboard/AmcTracker';
import { ConversionFunnel } from '@/components/dashboard/ConversionFunnel';
import { WeeklySchedule } from '@/components/dashboard/WeeklySchedule';
import { ReferralLeaderboard } from '@/components/dashboard/ReferralLeaderboard';
import { VipConversionCard } from '@/components/dashboard/VipConversionCard';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { DatePreset, DateRange, getDateRangeForPreset } from '@/lib/pay-period';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { IntroBooked } from '@/context/DataContext';

// 6B: Wrapper that fetches Q completion rate and passes it to StudioScoreboard
function QCompletionScoreboard({ scoreboardMetrics, introsBooked, dateRange, selectedEmployee, pipeline }: {
  scoreboardMetrics: { introsRun: number; introSales: number; closingRate: number; goalWhyRate: number; relationshipRate: number; madeAFriendRate: number };
  introsBooked: IntroBooked[];
  dateRange: DateRange | null;
  selectedEmployee: string | null;
  pipeline: { booked: number; showed: number; sold: number; revenue: number };
}) {
  const [qRate, setQRate] = useState<number | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const firstIntros = introsBooked.filter(b => {
        const isVip = (b as any).is_vip === true;
        const originatingId = (b as any).originating_booking_id;
        if (isVip || originatingId) return false;
        if (selectedEmployee) {
          const owner = (b as any).intro_owner || b.sa_working_shift;
          if (owner !== selectedEmployee) return false;
        }
        if (!dateRange) return true;
        try {
          const d = new Date(b.class_date);
          return d >= dateRange.start && d <= dateRange.end;
        } catch { return false; }
      });
      if (firstIntros.length === 0) { setQRate(undefined); return; }
      
      const ids = firstIntros.map(b => b.id);
      const { data: qs } = await supabase
        .from('intro_questionnaires')
        .select('booking_id, status')
        .in('booking_id', ids.slice(0, 500));
      
      const completed = new Set(
        (qs || []).filter(q => q.status === 'completed' || q.status === 'submitted').map(q => q.booking_id)
      );
      setQRate((completed.size / firstIntros.length) * 100);
    })();
  }, [introsBooked, dateRange, selectedEmployee]);

  return (
    <StudioScoreboard
      introsRun={scoreboardMetrics.introsRun}
      introSales={scoreboardMetrics.introSales}
      closingRate={scoreboardMetrics.closingRate}
      goalWhyRate={scoreboardMetrics.goalWhyRate}
      relationshipRate={scoreboardMetrics.relationshipRate}
      madeAFriendRate={scoreboardMetrics.madeAFriendRate}
      qCompletionRate={qRate}
      introsBooked={pipeline.booked}
      introsShowed={pipeline.showed}
    />
  );
}

export default function Recaps() {
  const { user } = useAuth();
  const { introsBooked, introsRun, sales, shiftRecaps, isLoading, lastUpdated, refreshData } = useData();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Date filter state - same as Personal Dashboard
  const [datePreset, setDatePreset] = useState<DatePreset>('pay_period');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  
  // Employee filter state
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  
  const isAdmin = user?.role === 'Admin';
  
  const dateRange = useMemo(() => getDateRangeForPreset(datePreset, customRange), [datePreset, customRange]);
  const metrics = useDashboardMetrics(introsBooked, introsRun, sales, dateRange, shiftRecaps);

  // 6B: Q Completion Rate - % of 1st intro bookings with completed questionnaire
  const qCompletionRate = useMemo(() => {
    const firstIntros = introsBooked.filter(b => {
      const isVip = (b as any).is_vip === true;
      const originatingId = (b as any).originating_booking_id;
      const isFirst = !originatingId;
      if (isVip || !isFirst) return false;
      if (!dateRange) return true;
      try {
        const d = new Date(b.class_date);
        return d >= dateRange.start && d <= dateRange.end;
      } catch { return false; }
    });
    if (firstIntros.length === 0) return undefined;
    // We need questionnaire data - use a simple query approach via state
    // For now we count bookings that have a questionnaire completed by checking DataContext
    // This is a placeholder until we can fetch questionnaire status in bulk
    return undefined; // Will be populated below
  }, [introsBooked, dateRange]);

  // Use leaderboard data from metrics
  const { topBookers, topClosing, topShowRate } = metrics.leaderboards;

  // Filter per-SA table based on selected employee
  const filteredPerSA = useMemo(() => {
    if (!selectedEmployee) return metrics.perSA;
    return metrics.perSA.filter(m => m.saName === selectedEmployee);
  }, [metrics.perSA, selectedEmployee]);

  // Filtered booker stats
  const filteredBookerStats = useMemo(() => {
    if (!selectedEmployee) return metrics.bookerStats;
    return metrics.bookerStats.filter(m => m.saName === selectedEmployee);
  }, [metrics.bookerStats, selectedEmployee]);

  // Filtered scoreboard metrics for individual view
  const scoreboardMetrics = useMemo(() => {
    if (!selectedEmployee) return metrics.studio;
    const sa = metrics.perSA.find(m => m.saName === selectedEmployee);
    if (!sa) return { introsRun: 0, introSales: 0, closingRate: 0, totalCommission: 0, goalWhyRate: 0, relationshipRate: 0, madeAFriendRate: 0 };
    return {
      introsRun: sa.introsRun,
      introSales: sa.sales,
      closingRate: sa.closingRate,
      totalCommission: sa.commission,
      goalWhyRate: sa.goalWhyRate,
      relationshipRate: sa.relationshipRate,
      madeAFriendRate: sa.madeAFriendRate,
    };
  }, [selectedEmployee, metrics]);

  // Filtered pipeline metrics
  const filteredPipeline = useMemo(() => {
    if (!selectedEmployee) return metrics.pipeline;
    // Recompute from raw data filtered to this SA
    const saBookings = introsBooked.filter(b => {
      const introOwner = (b as any).intro_owner || b.sa_working_shift;
      const originatingId = (b as any).originating_booking_id;
      const isFirst = originatingId === null || originatingId === undefined;
      const inRange = dateRange ? (() => { try { const d = new Date(b.class_date); return d >= dateRange.start && d <= dateRange.end; } catch { return false; } })() : true;
      return introOwner === selectedEmployee && isFirst && inRange;
    });
    let showed = 0, sold = 0;
    const MEMBERSHIP_RESULTS = ['premier', 'elite', 'basic'];
    saBookings.forEach(b => {
      const runs = introsRun.filter(r => r.linked_intro_booked_id === b.id && r.result !== 'No-show');
      if (runs.length > 0) {
        showed++;
        if (runs.some(r => MEMBERSHIP_RESULTS.some(m => (r.result || '').toLowerCase().includes(m)))) sold++;
      }
    });
    return { booked: saBookings.length, showed, sold, revenue: 0 };
  }, [selectedEmployee, introsBooked, introsRun, dateRange, metrics.pipeline]);

  // Filtered lead source metrics
  const filteredLeadSource = useMemo(() => {
    if (!selectedEmployee) return metrics.leadSourceMetrics;
    const saBookings = introsBooked.filter(b => {
      const introOwner = (b as any).intro_owner || b.sa_working_shift;
      const originatingId = (b as any).originating_booking_id;
      const isFirst = originatingId === null || originatingId === undefined;
      const inRange = dateRange ? (() => { try { const d = new Date(b.class_date); return d >= dateRange.start && d <= dateRange.end; } catch { return false; } })() : true;
      return introOwner === selectedEmployee && isFirst && inRange;
    });
    const MEMBERSHIP_RESULTS = ['premier', 'elite', 'basic'];
    const sourceMap = new Map<string, { source: string; booked: number; showed: number; sold: number; revenue: number }>();
    saBookings.forEach(b => {
      const source = b.lead_source || 'Unknown';
      const existing = sourceMap.get(source) || { source, booked: 0, showed: 0, sold: 0, revenue: 0 };
      existing.booked++;
      const runs = introsRun.filter(r => r.linked_intro_booked_id === b.id && r.result !== 'No-show');
      if (runs.length > 0) {
        existing.showed++;
        if (runs.some(r => MEMBERSHIP_RESULTS.some(m => (r.result || '').toLowerCase().includes(m)))) existing.sold++;
      }
      sourceMap.set(source, existing);
    });
    return Array.from(sourceMap.values()).sort((a, b) => b.booked - a.booked);
  }, [selectedEmployee, introsBooked, introsRun, dateRange, metrics.leadSourceMetrics]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
  };

  const generatePersonalSummaryText = () => {
    const rangeText = `${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d, yyyy')}`;
    const userName = user?.name || 'User';
    
    // Find this user's metrics
    const userMetrics = metrics.perSA.find(m => m.saName === userName);
    
    let text = `📊 ${userName}'s Recap (${rangeText})\n\n`;
    
    if (userMetrics) {
      text += `🎯 My Stats:\n`;
      text += `• Intros Run: ${userMetrics.introsRun}\n`;
      text += `• Sales: ${userMetrics.sales} (${userMetrics.closingRate.toFixed(0)}% close rate of showed)\n`;
      text += `• Commission: $${userMetrics.commission.toFixed(2)}\n`;
      text += `• Goal+Why: ${userMetrics.goalWhyRate.toFixed(0)}%\n`;
      text += `• Peak Exp: ${userMetrics.relationshipRate.toFixed(0)}%\n`;
      text += `• Made Friend: ${userMetrics.madeAFriendRate.toFixed(0)}%\n`;
    } else {
      text += `No intros recorded for this period yet.\n`;
    }

    return text;
  };

  const generateStudioSummaryText = () => {
    const rangeText = `${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d, yyyy')}`;
    
    let text = `📊 Studio Scoreboard (${rangeText})\n\n`;
    
    text += `🎯 Studio Totals:\n`;
    text += `• Intros Run: ${metrics.studio.introsRun}\n`;
    text += `• Sales: ${metrics.studio.introSales} (${metrics.studio.closingRate.toFixed(0)}% close rate of showed)\n`;
    text += `• Commission: $${metrics.studio.totalCommission.toFixed(2)}\n`;
    text += `• Goal+Why: ${metrics.studio.goalWhyRate.toFixed(0)}%\n`;
    text += `• Peak Exp: ${metrics.studio.relationshipRate.toFixed(0)}%\n`;
    text += `• Made Friend: ${metrics.studio.madeAFriendRate.toFixed(0)}%\n\n`;

    if (topBookers.length > 0) {
      text += `🏆 Top Bookers:\n`;
      topBookers.forEach((m, i) => {
        text += `${i + 1}. ${m.name}: ${m.value} booked\n`;
      });
      text += `\n`;
    }

    if (topClosing.length > 0) {
      text += `💰 Best Closing %:\n`;
      topClosing.forEach((m, i) => {
        text += `${i + 1}. ${m.name}: ${m.value.toFixed(0)}% ${m.subValue ? `(${m.subValue})` : ''}\n`;
      });
      text += `\n`;
    }

    return text;
  };

  const handleCopyPersonalSummary = () => {
    const text = generatePersonalSummaryText();
    navigator.clipboard.writeText(text);
    toast.success('Personal summary copied to clipboard!');
  };

  const handleCopyStudioSummary = () => {
    const text = generateStudioSummaryText();
    navigator.clipboard.writeText(text);
    toast.success('Studio summary copied to clipboard!');
  };

  const handleDownloadCSV = () => {
    const rangeText = `${format(dateRange.start, 'yyyy-MM-dd')}_to_${format(dateRange.end, 'yyyy-MM-dd')}`;
    
    // Generate CSV
    let csv = 'Category,SA Name,Metric,Value\n';
    
    // Studio totals
    csv += `Studio,All,Intros Run,${metrics.studio.introsRun}\n`;
    csv += `Studio,All,Sales,${metrics.studio.introSales}\n`;
    csv += `Studio,All,Close Rate,${metrics.studio.closingRate.toFixed(1)}%\n`;
    csv += `Studio,All,Commission,$${metrics.studio.totalCommission.toFixed(2)}\n`;
    csv += `Studio,All,Goal+Why Rate,${metrics.studio.goalWhyRate.toFixed(1)}%\n`;
    csv += `Studio,All,Peak Exp Rate,${metrics.studio.relationshipRate.toFixed(1)}%\n`;
    csv += `Studio,All,Made Friend Rate,${metrics.studio.madeAFriendRate.toFixed(1)}%\n`;
    
    // Per-SA data
    metrics.perSA.forEach(m => {
      csv += `Per-SA,${m.saName},Intros Run,${m.introsRun}\n`;
      csv += `Per-SA,${m.saName},Sales,${m.sales}\n`;
      csv += `Per-SA,${m.saName},Close Rate,${m.closingRate.toFixed(1)}%\n`;
      csv += `Per-SA,${m.saName},Goal+Why Rate,${m.goalWhyRate.toFixed(1)}%\n`;
      csv += `Per-SA,${m.saName},Peak Exp Rate,${m.relationshipRate.toFixed(1)}%\n`;
      csv += `Per-SA,${m.saName},Made Friend Rate,${m.madeAFriendRate.toFixed(1)}%\n`;
      csv += `Per-SA,${m.saName},Commission,$${m.commission.toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studio_scoreboard_${rangeText}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('CSV downloaded!');
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
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Studio Scoreboard
          </h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="h-8 px-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-1">
          Studio-wide performance metrics and leaderboards
        </p>
        {lastUpdated && (
          <p className="text-xs text-muted-foreground/70">
            Last updated: {format(lastUpdated, 'h:mm:ss a')}
          </p>
        )}
        
        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {/* Admin View-as Employee Filter */}
          <EmployeeFilter 
            selectedEmployee={selectedEmployee}
            onEmployeeChange={setSelectedEmployee}
          />
          
          {/* Global Date Filter - same as Personal Dashboard */}
          <DateRangeFilter
            preset={datePreset}
            customRange={customRange}
            onPresetChange={setDatePreset}
            onCustomRangeChange={setCustomRange}
            dateRange={dateRange || { start: new Date(2020, 0, 1), end: new Date() }}
          />
        </div>
      </div>

      {/* AMC Tracker - top of Studio */}
      <AmcTracker />

      {/* This Week's Schedule */}
      <WeeklySchedule />

      {/* Studio Scoreboard */}
      <QCompletionScoreboard
        scoreboardMetrics={scoreboardMetrics}
        introsBooked={introsBooked}
        dateRange={dateRange}
        selectedEmployee={selectedEmployee}
        pipeline={filteredPipeline}
      />

      {/* Conversion Funnel with 1st/2nd Intro toggle */}
      <ConversionFunnel dateRange={dateRange} />

      {/* Lead Source Analytics */}
      <LeadSourceChart data={filteredLeadSource} />

      {/* Referral Leaderboard */}
      <ReferralLeaderboard />

      {/* VIP Conversion Tracking */}
      <VipConversionCard dateRange={dateRange} />
      {/* Top Performers - only show when viewing all staff */}
      {!selectedEmployee && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {/* Top Bookers - limited to 3 */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Top Bookers</p>
                {topBookers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No data</p>
                ) : (
                  topBookers.slice(0, 3).map((m, i) => (
                    <div key={m.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        {i === 0 && '🥇'}
                        {i === 1 && '🥈'}
                        {i === 2 && '🥉'}
                        <span className="truncate max-w-[60px]">{m.name}</span>
                      </span>
                      <Badge variant="secondary" className="text-xs">{m.value}</Badge>
                    </div>
                  ))
                )}
              </div>

              {/* Top Show Rate - limited to 3 */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Best Show Rate</p>
                {topShowRate.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Min 3 booked</p>
                ) : (
                  topShowRate.slice(0, 3).map((m, i) => (
                    <div key={m.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        {i === 0 && '🥇'}
                        {i === 1 && '🥈'}
                        {i === 2 && '🥉'}
                        <span className="truncate max-w-[60px]">{m.name}</span>
                      </span>
                      <Badge variant="secondary" className="text-xs">{m.value.toFixed(0)}%</Badge>
                    </div>
                  ))
                )}
              </div>

              {/* Top Closers - limited to 3 */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Best Close Rate</p>
                {topClosing.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Min 1 ran</p>
                ) : (
                  topClosing.slice(0, 3).map((m, i) => (
                    <div key={m.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        {i === 0 && '🥇'}
                        {i === 1 && '🥈'}
                        {i === 2 && '🥉'}
                        <span className="truncate max-w-[60px]">{m.name}</span>
                      </span>
                      <Badge variant="secondary" className="text-xs">{m.value.toFixed(0)}%</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Runner & Booker Stats Tabs */}
      <Tabs defaultValue="runner">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="runner">Runner Stats</TabsTrigger>
          <TabsTrigger value="booker">Booker Stats</TabsTrigger>
        </TabsList>
        <TabsContent value="runner">
          <PerSATable data={filteredPerSA} />
        </TabsContent>
        <TabsContent value="booker">
          <BookerStatsTable data={filteredBookerStats} />
        </TabsContent>
      </Tabs>

      {/* Export Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Share to GroupMe</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-col gap-2">
            <Button onClick={handleCopyPersonalSummary} variant="outline" className="w-full">
              <Copy className="w-4 h-4 mr-2" />
              Copy My Personal Recap
            </Button>
            <Button onClick={handleCopyStudioSummary} variant="outline" className="w-full">
              <Copy className="w-4 h-4 mr-2" />
              Copy Studio Recap
            </Button>
            <Button onClick={handleDownloadCSV} variant="outline" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Download Full CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Legend Card */}
      <Card className="bg-muted/30">
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Studio Scoreboard</strong> = all metrics across all staff
            <br />
            <strong>Runner Stats</strong> = metrics credited to intro_owner (who ran first intro)
            <br />
            <strong>Booker Stats</strong> = credit for scheduling intros (as booked_by)
            <br />
            <strong>Lead Measures</strong> = Goal+Why capture, Peak Gym Experience, Made a Friend
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
