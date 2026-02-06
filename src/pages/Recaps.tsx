import { useState, useMemo } from 'react';
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
import { ClientJourneyReadOnly } from '@/components/dashboard/ClientJourneyReadOnly';
import { MembershipPurchasesReadOnly } from '@/components/dashboard/MembershipPurchasesReadOnly';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { DatePreset, DateRange, getDateRangeForPreset } from '@/lib/pay-period';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function Recaps() {
  const { user } = useAuth();
  const { introsBooked, introsRun, sales, shiftRecaps, isLoading, lastUpdated, refreshData } = useData();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Date filter state - same as Personal Dashboard
  const [datePreset, setDatePreset] = useState<DatePreset>('pay_period');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  
  // Employee filter state (admin only)
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  
  const isAdmin = user?.role === 'Admin';
  
  const dateRange = useMemo(() => getDateRangeForPreset(datePreset, customRange), [datePreset, customRange]);
  const metrics = useDashboardMetrics(introsBooked, introsRun, sales, dateRange, shiftRecaps);

  // Use leaderboard data from metrics
  const { topBookers, topClosing, topShowRate } = metrics.leaderboards;

  // Filter per-SA table based on selected employee (admin only)
  const filteredPerSA = useMemo(() => {
    if (!selectedEmployee) return metrics.perSA;
    return metrics.perSA.filter(m => m.saName === selectedEmployee);
  }, [metrics.perSA, selectedEmployee]);

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
      text += `• Sales: ${userMetrics.sales} (${userMetrics.closingRate.toFixed(0)}% close rate)\n`;
      text += `• Commission: $${userMetrics.commission.toFixed(2)}\n`;
      text += `• Goal+Why: ${userMetrics.goalWhyRate.toFixed(0)}%\n`;
      text += `• Relationship: ${userMetrics.relationshipRate.toFixed(0)}%\n`;
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
    text += `• Sales: ${metrics.studio.introSales} (${metrics.studio.closingRate.toFixed(0)}% close rate)\n`;
    text += `• Commission: $${metrics.studio.totalCommission.toFixed(2)}\n`;
    text += `• Goal+Why: ${metrics.studio.goalWhyRate.toFixed(0)}%\n`;
    text += `• Relationship: ${metrics.studio.relationshipRate.toFixed(0)}%\n`;
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
    csv += `Studio,All,Relationship Rate,${metrics.studio.relationshipRate.toFixed(1)}%\n`;
    csv += `Studio,All,Made Friend Rate,${metrics.studio.madeAFriendRate.toFixed(1)}%\n`;
    
    // Per-SA data
    metrics.perSA.forEach(m => {
      csv += `Per-SA,${m.saName},Intros Run,${m.introsRun}\n`;
      csv += `Per-SA,${m.saName},Sales,${m.sales}\n`;
      csv += `Per-SA,${m.saName},Close Rate,${m.closingRate.toFixed(1)}%\n`;
      csv += `Per-SA,${m.saName},Goal+Why Rate,${m.goalWhyRate.toFixed(1)}%\n`;
      csv += `Per-SA,${m.saName},Relationship Rate,${m.relationshipRate.toFixed(1)}%\n`;
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
            isAdmin={isAdmin}
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

      {/* Studio Scoreboard */}
      <StudioScoreboard
        introsRun={metrics.studio.introsRun}
        introSales={metrics.studio.introSales}
        closingRate={metrics.studio.closingRate}
        goalWhyRate={metrics.studio.goalWhyRate}
        relationshipRate={metrics.studio.relationshipRate}
        madeAFriendRate={metrics.studio.madeAFriendRate}
      />

      {/* Pipeline Funnel */}
      <PipelineFunnel
        booked={metrics.pipeline.booked}
        showed={metrics.pipeline.showed}
        sold={metrics.pipeline.sold}
        revenue={metrics.pipeline.revenue}
      />

      {/* Lead Source Analytics */}
      <LeadSourceChart data={metrics.leadSourceMetrics} />

      {/* Client Pipeline (read-only) */}
      <ClientJourneyReadOnly />

      {/* Members Who Bought (read-only) */}
      <MembershipPurchasesReadOnly />

      {/* Top Performers */}
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
          <BookerStatsTable data={metrics.bookerStats} />
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
            <strong>Lead Measures</strong> = Goal+Why capture, Relationship experience, Made a Friend
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
