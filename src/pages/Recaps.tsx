import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Trophy, RefreshCw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PerSATable } from '@/components/dashboard/PerSATable';
import { BookerStatsTable } from '@/components/dashboard/BookerStatsTable';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { EmployeeFilter } from '@/components/dashboard/EmployeeFilter';
import { LeadSourceChart } from '@/components/dashboard/LeadSourceChart';
import { ConversionFunnel } from '@/components/dashboard/ConversionFunnel';
import { ReferralLeaderboard } from '@/components/dashboard/ReferralLeaderboard';
import { VipConversionCard } from '@/components/dashboard/VipConversionCard';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { DatePreset, DateRange, getDateRangeForPreset } from '@/lib/pay-period';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function Recaps() {
  const { user } = useAuth();
  const { introsBooked, introsRun, sales, shiftRecaps, followUpQueue, followupTouches, isLoading, lastUpdated, refreshData } = useData();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Date filter state - same as Personal Dashboard
  const [datePreset, setDatePreset] = useState<DatePreset>('pay_period');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  
  // Employee filter state
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  
  const isAdmin = user?.role === 'Admin';
  
  const dateRange = useMemo(() => getDateRangeForPreset(datePreset, customRange), [datePreset, customRange]);
  const metrics = useDashboardMetrics(introsBooked, introsRun, sales, dateRange, shiftRecaps, undefined, followUpQueue, followupTouches);

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

      {/* Conversion Funnel with 1st/2nd Intro dual-row view */}

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

      {/* Saves & Rebooks Card */}
      {(metrics.rebooksCreatedInRange > 0 || metrics.followUpConversionsInRange > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              🔄 Saves & Conversions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold">{metrics.rebooksCreatedInRange}</p>
                <p className="text-xs text-muted-foreground">Rebooks</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.noShowSavesInRange}</p>
                <p className="text-xs text-muted-foreground">No-Show Saves</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.followUpConversionsInRange}</p>
                <p className="text-xs text-muted-foreground">FU Conversions</p>
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

      {/* Legend Card */}
      <Card className="bg-muted/30">
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Studio Scoreboard</strong> = all metrics across all staff
            <br />
            <strong>Runner Stats</strong> = metrics credited to intro_owner (who ran first intro)
            <br />
            <strong>Booker Stats</strong> = credit for scheduling intros (as booked_by)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
