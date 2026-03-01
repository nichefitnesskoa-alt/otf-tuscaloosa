import { useState, useMemo, useEffect } from 'react';
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
import { StudioScoreboard } from '@/components/dashboard/StudioScoreboard';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { LeadMeasuresTable } from '@/components/dashboard/LeadMeasuresTable';
import { OutreachTable } from '@/components/dashboard/OutreachTable';
import { useLeadMeasures } from '@/hooks/useLeadMeasures';
import { DatePreset, DateRange, getDateRangeForPreset } from '@/lib/pay-period';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { parseLocalDate } from '@/lib/utils';
import { isWithinInterval } from 'date-fns';
import { isMembershipSale } from '@/lib/sales-detection';
import MembershipPurchasesPanel from '@/components/admin/MembershipPurchasesPanel';
import PayPeriodCommission from '@/components/PayPeriodCommission';

export default function Recaps() {
  const { user } = useAuth();
  const { introsBooked, introsRun, sales, shiftRecaps, followUpQueue, followupTouches, isLoading, lastUpdated, refreshData } = useData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mainTab, setMainTab] = useState('studio');

  // Date filter state
  const [datePreset, setDatePreset] = useState<DatePreset>('pay_period');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  
  // Employee filter state
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  
  const isAdmin = user?.role === 'Admin';
  
  const dateRange = useMemo(() => getDateRangeForPreset(datePreset, customRange), [datePreset, customRange]);
  const metrics = useDashboardMetrics(introsBooked, introsRun, sales, dateRange, shiftRecaps, undefined, followUpQueue, followupTouches);
  const leadMeasuresOpts = useMemo(() => dateRange ? { startDate: format(dateRange.start, 'yyyy-MM-dd'), endDate: format(dateRange.end, 'yyyy-MM-dd') } : undefined, [dateRange]);
  const { data: leadMeasures, loading: leadMeasuresLoading } = useLeadMeasures(leadMeasuresOpts);

  // Compute scoreboard metrics from existing data
  const scoreboardIntrosRun = metrics.studio.introsRun;
  const scoreboardSales = metrics.studio.introSales;
  const scoreboardClosingRate = metrics.studio.closingRate;
  const scoreboardBooked = metrics.pipeline.booked;
  const scoreboardShowed = metrics.pipeline.showed;
  const scoreboardNoShows = metrics.pipeline.noShows;

  // Q Completion + Prep Rate from DB
  const [qCompletionRate, setQCompletionRate] = useState<number | undefined>();
  const [prepRate, setPrepRate] = useState<number | undefined>();

  useEffect(() => {
    (async () => {
      const firstIntros = introsBooked.filter(b => {
        if ((b as any).is_vip === true || (b as any).originating_booking_id) return false;
        if (!dateRange) return true;
        try {
          const d = parseLocalDate(b.class_date);
          return isWithinInterval(d, { start: dateRange.start, end: dateRange.end });
        } catch { return false; }
      });
      if (firstIntros.length === 0) { setQCompletionRate(undefined); setPrepRate(undefined); return; }

      const ids = firstIntros.map(b => b.id).slice(0, 500);
      const [{ data: qs }, { data: preppedRows }] = await Promise.all([
        supabase.from('intro_questionnaires').select('booking_id, status').in('booking_id', ids),
        supabase.from('intros_booked').select('id').in('id', ids).eq('prepped', true),
      ]);
      const completedQIds = new Set((qs || []).filter(q => q.status === 'completed' || q.status === 'submitted').map(q => q.booking_id));
      const preppedIds = new Set((preppedRows || []).map(r => r.id));
      setQCompletionRate((completedQIds.size / firstIntros.length) * 100);
      setPrepRate((preppedIds.size / firstIntros.length) * 100);
    })();
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

  // Filtered outreach data
  const filteredOutreach = useMemo(() => {
    if (!selectedEmployee) return leadMeasures;
    return leadMeasures.filter(m => m.saName === selectedEmployee);
  }, [leadMeasures, selectedEmployee]);

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
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Studio
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
        {lastUpdated && (
          <p className="text-xs text-muted-foreground/70">
            Last updated: {format(lastUpdated, 'h:mm:ss a')}
          </p>
        )}
        
        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <EmployeeFilter 
            selectedEmployee={selectedEmployee}
            onEmployeeChange={setSelectedEmployee}
          />
          <DateRangeFilter
            preset={datePreset}
            customRange={customRange}
            onPresetChange={setDatePreset}
            onCustomRangeChange={setCustomRange}
            dateRange={dateRange || { start: new Date(2020, 0, 1), end: new Date() }}
          />
        </div>
      </div>

      {/* Top-level tabs: Sales | Studio */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="studio">Studio</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4 mt-4">
          <MembershipPurchasesPanel externalDateRange={dateRange} />
          <PayPeriodCommission dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="studio" className="space-y-4 mt-4">
          <StudioScoreboard
            introsRun={scoreboardIntrosRun}
            introSales={scoreboardSales}
            closingRate={scoreboardClosingRate}
            qCompletionRate={qCompletionRate}
            prepRate={prepRate}
            introsBooked={scoreboardBooked}
            introsShowed={scoreboardShowed}
            noShows={scoreboardNoShows}
          />

          <LeadMeasuresTable data={leadMeasures} loading={leadMeasuresLoading} />
          <ConversionFunnel dateRange={dateRange} />
          <LeadSourceChart data={filteredLeadSource} />
          <ReferralLeaderboard />

          <Tabs defaultValue="runner">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="runner">Runner Stats</TabsTrigger>
              <TabsTrigger value="booker">Booker Stats</TabsTrigger>
              <TabsTrigger value="outreach">Outreach</TabsTrigger>
            </TabsList>
            <TabsContent value="runner">
              <PerSATable data={filteredPerSA} />
            </TabsContent>
            <TabsContent value="booker">
              <BookerStatsTable data={filteredBookerStats} />
            </TabsContent>
            <TabsContent value="outreach">
              <OutreachTable data={filteredOutreach} loading={leadMeasuresLoading} />
            </TabsContent>
          </Tabs>

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
        </TabsContent>
      </Tabs>
    </div>
  );
}
