import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { StudioScoreboard } from '@/components/dashboard/StudioScoreboard';
import { PerSATable } from '@/components/dashboard/PerSATable';
import { IndividualActivityTable } from '@/components/dashboard/IndividualActivityTable';
import { Leaderboards } from '@/components/dashboard/Leaderboards';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { EmployeeFilter } from '@/components/dashboard/EmployeeFilter';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { DatePreset, DateRange, getDateRangeForPreset } from '@/lib/pay-period';
import { format } from 'date-fns';

export default function Dashboard() {
  const { user } = useAuth();
  const { introsBooked, introsRun, sales, shiftRecaps, isLoading, lastUpdated, refreshData } = useData();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Date filter state - default to pay period
  const [datePreset, setDatePreset] = useState<DatePreset>('pay_period');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  
  // Employee filter state (admin only)
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  
  const isAdmin = user?.role === 'Admin';

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
  };

  // Calculate the current date range based on preset
  const dateRange = useMemo(() => {
    return getDateRangeForPreset(datePreset, customRange);
  }, [datePreset, customRange]);

  // Pass date range and shift recaps to metrics hook
  const metrics = useDashboardMetrics(introsBooked, introsRun, sales, dateRange, shiftRecaps);

  // For non-admin users, filter to show only their data
  const effectiveEmployee = isAdmin ? selectedEmployee : user?.name || null;

  // Filter per-SA table based on selected employee
  const filteredPerSA = useMemo(() => {
    if (!effectiveEmployee) return metrics.perSA;
    return metrics.perSA.filter(m => m.saName === effectiveEmployee);
  }, [metrics.perSA, effectiveEmployee]);

  const filteredIndividualActivity = useMemo(() => {
    if (!effectiveEmployee) return metrics.individualActivity;
    return metrics.individualActivity.filter(m => m.saName === effectiveEmployee);
  }, [metrics.individualActivity, effectiveEmployee]);

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
          <h1 className="text-xl font-bold">Dashboard</h1>
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
          {effectiveEmployee ? `${effectiveEmployee}'s performance` : 'Studio performance metrics'}
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
          
          {/* Global Date Filter */}
          <DateRangeFilter
            preset={datePreset}
            customRange={customRange}
            onPresetChange={setDatePreset}
            onCustomRangeChange={setCustomRange}
            dateRange={dateRange || { start: new Date(2020, 0, 1), end: new Date() }}
          />
        </div>
      </div>

      {/* Studio Scoreboard - main metrics (or personal metrics for non-admin) */}
      {effectiveEmployee && filteredPerSA.length > 0 ? (
        <StudioScoreboard
          introsRun={filteredPerSA[0].introsRun}
          introSales={filteredPerSA[0].sales}
          closingRate={filteredPerSA[0].closingRate}
          totalCommission={filteredPerSA[0].commission}
          goalWhyRate={filteredPerSA[0].goalWhyRate}
          relationshipRate={filteredPerSA[0].relationshipRate}
          madeAFriendRate={filteredPerSA[0].madeAFriendRate}
        />
      ) : (
        <StudioScoreboard
          introsRun={metrics.studio.introsRun}
          introSales={metrics.studio.introSales}
          closingRate={metrics.studio.closingRate}
          totalCommission={metrics.studio.totalCommission}
          goalWhyRate={metrics.studio.goalWhyRate}
          relationshipRate={metrics.studio.relationshipRate}
          madeAFriendRate={metrics.studio.madeAFriendRate}
        />
      )}

      {/* Leaderboards */}
      <Leaderboards 
        topBookers={metrics.leaderboards.topBookers}
        topCommission={metrics.leaderboards.topCommission}
        topClosing={metrics.leaderboards.topClosing}
        topShowRate={metrics.leaderboards.topShowRate}
      />

      {/* Per-SA Performance Table */}
      <PerSATable data={filteredPerSA} />

      {/* Individual Activity Table */}
      <IndividualActivityTable data={filteredIndividualActivity} />

      {/* Legend Card */}
      <Card className="bg-muted/30">
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Per-SA Performance</strong> = all metrics credited to intro_owner (who ran first intro)
            <br />
            <strong>Lead Measures</strong> = Goal+Why capture, Relationship experience, Made a Friend
            <br />
            <strong>Individual Activity</strong> = outreach efforts (calls, texts, DMs, emails) from shift recaps
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
