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
import { TodaysRace } from '@/components/dashboard/TodaysRace';
import { WeeklyChallenges, Challenge } from '@/components/dashboard/WeeklyChallenges';
import { AchievementGrid, Achievement } from '@/components/dashboard/AchievementBadge';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { DatePreset, DateRange, getDateRangeForPreset } from '@/lib/pay-period';
import { format, endOfWeek, startOfWeek } from 'date-fns';

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

  // Generate achievements based on metrics
  const achievements: Achievement[] = useMemo(() => {
    return [
      {
        id: 'first_sale',
        name: 'First Sale',
        description: 'Close your first membership sale',
        icon: '💰',
        earned: personalMetrics.sales >= 1,
        earnedDate: personalMetrics.sales >= 1 ? 'This period' : undefined,
      },
      {
        id: 'hundred_club',
        name: '$100 Week',
        description: 'Earn $100+ commission in a week',
        icon: '💵',
        earned: personalMetrics.commission >= 100,
        progress: personalMetrics.commission,
        maxProgress: 100,
      },
      {
        id: 'friend_maker',
        name: 'Friend Maker',
        description: 'Make friends with 10 intro clients',
        icon: '🤝',
        earned: personalMetrics.madeAFriendRate >= 80 && personalMetrics.introsRun >= 3,
        progress: Math.round(personalMetrics.madeAFriendRate),
        maxProgress: 80,
      },
      {
        id: 'perfect_show',
        name: 'Perfect Show Rate',
        description: 'Achieve 100% show rate in a week',
        icon: '✨',
        earned: false, // Would need to track this specifically
      },
      {
        id: 'goal_getter',
        name: 'Goal Getter',
        description: 'Capture Goal+Why for every intro',
        icon: '🎯',
        earned: personalMetrics.goalWhyRate >= 100 && personalMetrics.introsRun >= 3,
        progress: Math.round(personalMetrics.goalWhyRate),
        maxProgress: 100,
      },
      {
        id: 'closer',
        name: 'The Closer',
        description: 'Achieve 50%+ closing rate',
        icon: '🏆',
        earned: personalMetrics.closingRate >= 50 && personalMetrics.introsRun >= 3,
        progress: Math.round(personalMetrics.closingRate),
        maxProgress: 50,
      },
    ];
  }, [personalMetrics]);

  // Weekly challenges (sample - could be driven by admin settings)
  const weeklyChallenges: Challenge[] = useMemo(() => {
    const endOfThisWeek = endOfWeek(new Date(), { weekStartsOn: 0 });
    
    return [
      {
        id: 'goal_why_challenge',
        title: 'Goal + Why Champion',
        description: 'Highest Goal+Why capture rate wins',
        metric: 'goalWhyRate' as const,
        target: 90,
        currentValue: personalMetrics.goalWhyRate,
        leader: metrics.perSA.length > 0 
          ? { name: metrics.perSA.sort((a, b) => b.goalWhyRate - a.goalWhyRate)[0].saName, value: metrics.perSA.sort((a, b) => b.goalWhyRate - a.goalWhyRate)[0].goalWhyRate }
          : undefined,
        endsAt: endOfThisWeek,
        reward: 'Team lunch!',
      },
    ];
  }, [personalMetrics.goalWhyRate, metrics.perSA]);

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

          {/* Achievements */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                🏅 Achievements
              </h3>
              <AchievementGrid achievements={achievements} />
            </CardContent>
          </Card>

          {/* Today's Race */}
          <TodaysRace 
            participants={metrics.todaysRace}
            currentUserName={userName}
          />

          {/* Weekly Challenges */}
          <WeeklyChallenges
            challenges={weeklyChallenges}
            currentUserName={userName}
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
            totalCommission={metrics.studio.totalCommission}
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

          {/* Individual Activity */}
          <IndividualActivityTable data={metrics.individualActivity} />
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
