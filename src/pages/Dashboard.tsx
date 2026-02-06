import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Building2, User } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PersonalScoreboard } from '@/components/dashboard/PersonalScoreboard';
import { StudioScoreboard } from '@/components/dashboard/StudioScoreboard';
import { IndividualActivityTable } from '@/components/dashboard/IndividualActivityTable';
import { PerSATable } from '@/components/dashboard/PerSATable';
import { BookerStatsTable } from '@/components/dashboard/BookerStatsTable';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { Leaderboards } from '@/components/dashboard/Leaderboards';
import { ProgressRing } from '@/components/dashboard/ProgressRing';
import { PipelineFunnel } from '@/components/dashboard/PipelineFunnel';
import { LeadSourceChart } from '@/components/dashboard/LeadSourceChart';
import { ClientJourneyReadOnly } from '@/components/dashboard/ClientJourneyReadOnly';
import { MembershipPurchasesReadOnly } from '@/components/dashboard/MembershipPurchasesReadOnly';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { DatePreset, DateRange, getDateRangeForPreset } from '@/lib/pay-period';
import { format } from 'date-fns';

const DAILY_INTRO_GOAL = 3;

export default function Dashboard() {
  const { user } = useAuth();
  const { introsBooked, introsRun, sales, shiftRecaps, isLoading, lastUpdated, refreshData } = useData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'personal' | 'studio'>('personal');

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

  const userName = user?.name || '';

  // Pass date range and shift recaps to metrics hook
  const metrics = useDashboardMetrics(introsBooked, introsRun, sales, dateRange, shiftRecaps, userName);

  // Get this user's personal metrics - returns zeros if no data exists
  const personalMetrics = useMemo(() => {
    const userMetrics = metrics.perSA.find(m => m.saName === userName);
    
    // Return zeros if no data exists for this user
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

  // Today's intros for progress ring
  const todaysIntros = useMemo(() => {
    const todayEntry = metrics.todaysRace.find(e => e.name === userName);
    return todayEntry?.introsRun || 0;
  }, [metrics.todaysRace, userName]);

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
        {lastUpdated && (
          <p className="text-xs text-muted-foreground/70">
            Last updated: {format(lastUpdated, 'h:mm:ss a')}
          </p>
        )}
        
        {/* Date Filter & View Mode Toggle */}
        <div className="flex flex-col gap-3 mt-3">
          <DateRangeFilter
            preset={datePreset}
            customRange={customRange}
            onPresetChange={setDatePreset}
            onCustomRangeChange={setCustomRange}
            dateRange={dateRange || { start: new Date(2020, 0, 1), end: new Date() }}
          />
          
          {/* View Mode Toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'personal' | 'studio')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="personal" className="flex items-center gap-1.5">
                <User className="w-4 h-4" />
                My Stats
              </TabsTrigger>
              <TabsTrigger value="studio" className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4" />
                Studio
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {viewMode === 'personal' ? (
        /* ===== PERSONAL VIEW ===== */
        <div className="space-y-4">
          {/* Progress Ring + Personal Scoreboard */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1 flex flex-col items-center justify-center">
              <ProgressRing
                value={todaysIntros}
                max={DAILY_INTRO_GOAL}
                size={90}
                label="Today's Goal"
              />
            </div>
            <div className="col-span-2">
              <Card className="h-full">
                <CardContent className="p-3 flex flex-col justify-center h-full">
                  <div className="text-2xl font-bold text-success">${personalMetrics.commission.toFixed(0)}</div>
                  <div className="text-xs text-muted-foreground">Commission this period</div>
                  <div className="mt-2 text-sm">
                    <span className="font-medium">{personalMetrics.introsRun}</span>
                    <span className="text-muted-foreground"> intros run • </span>
                    <span className="font-medium text-success">{personalMetrics.sales}</span>
                    <span className="text-muted-foreground"> sales</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Personal Scoreboard */}
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

          {/* Personal Activity */}
          <IndividualActivityTable data={personalActivity} />
        </div>
      ) : (
        /* ===== STUDIO VIEW ===== */
        <div className="space-y-4">
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

          {/* Leaderboards with My Rank */}
          <Leaderboards 
            topBookers={metrics.leaderboards.topBookers}
            topCommission={metrics.leaderboards.topCommission}
            topClosing={metrics.leaderboards.topClosing}
            topShowRate={metrics.leaderboards.topShowRate}
            currentUserName={userName}
            allParticipants={metrics.participantCounts}
          />

          {/* Dual Attribution Tabs */}
          <Tabs defaultValue="runner">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="runner">Runner Stats</TabsTrigger>
              <TabsTrigger value="booker">Booker Stats</TabsTrigger>
            </TabsList>
            <TabsContent value="runner">
              <PerSATable data={metrics.perSA} />
            </TabsContent>
            <TabsContent value="booker">
              <BookerStatsTable data={metrics.bookerStats} />
            </TabsContent>
          </Tabs>

        </div>
      )}

      {/* Legend Card */}
      <Card className="bg-muted/30">
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Runner Stats</strong> = metrics from intros you ran (as intro_owner)
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
