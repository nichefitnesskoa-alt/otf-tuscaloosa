import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { PersonalScoreboard } from '@/components/dashboard/PersonalScoreboard';
import { IndividualActivityTable } from '@/components/dashboard/IndividualActivityTable';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
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

  // Always filter to current user's data - NO fallback to studio data
  const userName = user?.name || '';

  // Get this user's personal metrics - returns zeros if no data exists
  const personalMetrics = useMemo(() => {
    const userMetrics = metrics.perSA.find(m => m.saName === userName);
    
    // Return zeros if no data exists for this user - NEVER show another user's data
    return userMetrics || {
      saName: userName,
      introsRun: 0,
      sales: 0,
      closingRate: 0,
      goalWhyRate: 0,
      relationshipRate: 0,
      madeAFriendRate: 0,
      commission: 0,
    };
  }, [metrics.perSA, userName]);

  // Filter individual activity to just this user
  const personalActivity = useMemo(() => {
    return metrics.individualActivity.filter(m => m.saName === userName);
  }, [metrics.individualActivity, userName]);

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
          <h1 className="text-xl font-bold">Personal Dashboard</h1>
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
          {userName}'s performance metrics
        </p>
        {lastUpdated && (
          <p className="text-xs text-muted-foreground/70">
            Last updated: {format(lastUpdated, 'h:mm:ss a')}
          </p>
        )}
        
        {/* Date Filter */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <DateRangeFilter
            preset={datePreset}
            customRange={customRange}
            onPresetChange={setDatePreset}
            onCustomRangeChange={setCustomRange}
            dateRange={dateRange || { start: new Date(2020, 0, 1), end: new Date() }}
          />
        </div>
      </div>

      {/* Personal Scoreboard - ALWAYS shows this user's data (zeros if none) */}
      <PersonalScoreboard
        userName={userName}
        introsRun={personalMetrics.introsRun}
        introSales={personalMetrics.sales}
        closingRate={personalMetrics.closingRate}
        totalCommission={personalMetrics.commission}
        goalWhyRate={personalMetrics.goalWhyRate}
        relationshipRate={personalMetrics.relationshipRate}
        madeAFriendRate={personalMetrics.madeAFriendRate}
      />

      {/* Individual Activity Table - only this user's activity */}
      <IndividualActivityTable data={personalActivity} />

      {/* Legend Card */}
      <Card className="bg-muted/30">
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Your Performance</strong> = metrics from intros you ran (as intro_owner)
            <br />
            <strong>Lead Measures</strong> = Goal+Why capture, Relationship experience, Made a Friend
            <br />
            <strong>Your Activity</strong> = outreach efforts (calls, texts, DMs, emails) from your shift recaps
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
