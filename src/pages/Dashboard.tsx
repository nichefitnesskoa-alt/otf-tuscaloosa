import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, TrendingUp, Users, Calendar, Loader2, 
  Target, Percent, UserCheck, BarChart3
} from 'lucide-react';
import { useMemo } from 'react';

export default function Dashboard() {
  const { user } = useAuth();
  const { shiftRecaps, introsBooked, introsRun, sales, isLoading } = useData();

  // Calculate metrics based on role
  const isAdmin = user?.role === 'Admin';
  const userName = user?.name || '';

  const metrics = useMemo(() => {
    // Filter data based on role
    const userRecaps = isAdmin ? shiftRecaps : shiftRecaps.filter(r => r.staff_name === userName);
    
    // Intros booked (credited to booked_by / sa_working_shift)
    const userIntrosBooked = isAdmin 
      ? introsBooked 
      : introsBooked.filter(b => b.sa_working_shift === userName);
    
    // Intros run (credited to SA who ran it)
    const userIntrosRun = isAdmin 
      ? introsRun 
      : introsRun.filter(r => r.intro_owner === userName || r.sa_name === userName);
    
    // Sales (intro-based = intro_owner, outside = whoever logged)
    const userSales = isAdmin 
      ? sales 
      : sales.filter(s => s.intro_owner === userName);

    // Calculate intros showed (outcome != No-show)
    const introsShowed = userIntrosRun.filter(r => r.result !== 'No-show');
    
    // Calculate show rate
    const showRate = userIntrosBooked.length > 0 
      ? (introsShowed.length / userIntrosBooked.length) * 100 
      : 0;

    // Calculate intro-based sales (membership outcomes from intros_run)
    const introBasedSales = userIntrosRun.filter(r => 
      r.commission_amount && r.commission_amount > 0
    );

    // Calculate closing percentage (intro-based sales / intros showed)
    const closingRate = introsShowed.length > 0 
      ? (introBasedSales.length / introsShowed.length) * 100 
      : 0;

    // Calculate commission (intro_owner gets credit)
    const introCommission = userIntrosRun.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
    const saleCommission = userSales.reduce((sum, s) => sum + (s.commission_amount || 0), 0);
    const totalCommission = introCommission + saleCommission;

    // Lead measure execution %
    const leadMeasureTotal = userIntrosRun.length * 3; // 3 lead measures per intro
    const leadMeasureCompleted = userIntrosRun.reduce((sum, r) => {
      let count = 0;
      if (r.halfway_encouragement) count++;
      if (r.premobility_encouragement) count++;
      if (r.coaching_summary_presence) count++;
      return sum + count;
    }, 0);
    const leadMeasureRate = leadMeasureTotal > 0 
      ? (leadMeasureCompleted / leadMeasureTotal) * 100 
      : 0;

    // Quality goal % (Clear goals)
    const withGoalQuality = userIntrosRun.filter(r => r.goal_quality);
    const clearGoals = withGoalQuality.filter(r => r.goal_quality === 'Clear');
    const qualityGoalRate = withGoalQuality.length > 0 
      ? (clearGoals.length / withGoalQuality.length) * 100 
      : 0;

    // Pricing engagement % (Yes)
    const withPricingEngagement = userIntrosRun.filter(r => r.pricing_engagement);
    const yesEngagement = withPricingEngagement.filter(r => r.pricing_engagement === 'Yes');
    const pricingEngagementRate = withPricingEngagement.length > 0 
      ? (yesEngagement.length / withPricingEngagement.length) * 100 
      : 0;

    // Total outreach activity
    const totalActivity = userRecaps.reduce((sum, r) => 
      sum + (r.calls_made || 0) + (r.texts_sent || 0) + (r.emails_sent || 0) + (r.dms_sent || 0), 0
    );

    // Total sales count (intro-based + outside-intro)
    const totalSalesCount = introBasedSales.length + userSales.length;

    return {
      userRecaps,
      userIntrosBooked,
      userIntrosRun,
      userSales,
      introsShowed,
      introBasedSales,
      showRate,
      closingRate,
      totalCommission,
      leadMeasureRate,
      qualityGoalRate,
      pricingEngagementRate,
      totalActivity,
      totalSalesCount,
    };
  }, [shiftRecaps, introsBooked, introsRun, sales, isAdmin, userName]);

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
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? 'All staff overview' : 'Your performance'}
        </p>
      </div>

      {/* Commission Card (Commission Owner) */}
      <Card className="bg-foreground text-background">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-70">Commission Earned</p>
              <p className="text-xs opacity-50">(Commission owner)</p>
              <p className="text-4xl font-black text-success">
                ${metrics.totalCommission.toFixed(2)}
              </p>
              <p className="text-xs opacity-50 mt-1">All time</p>
            </div>
            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-success" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Booking & Show Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Booked by</span>
            </div>
            <p className="text-2xl font-bold">{metrics.userIntrosBooked.length}</p>
            <p className="text-xs text-muted-foreground">Intros Booked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="w-4 h-4 text-success" />
              <span className="text-xs text-muted-foreground">Showed</span>
            </div>
            <p className="text-2xl font-bold">{metrics.introsShowed.length}</p>
            <p className="text-xs text-muted-foreground">Intros Showed</p>
          </CardContent>
        </Card>
      </div>

      {/* Rates Row */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="w-4 h-4 text-warning" />
              <span className="text-xs text-muted-foreground">Show Rate</span>
            </div>
            <p className="text-2xl font-bold">{metrics.showRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Showed / Booked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-success" />
              <span className="text-xs text-muted-foreground">Closing %</span>
            </div>
            <p className="text-2xl font-bold">{metrics.closingRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Sales / Showed</p>
          </CardContent>
        </Card>
      </div>

      {/* Lead Measures & Quality */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <BarChart3 className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold">{metrics.leadMeasureRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Lead Measures</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Target className="w-4 h-4 text-warning mx-auto mb-1" />
            <p className="text-lg font-bold">{metrics.qualityGoalRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Quality Goal</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <DollarSign className="w-4 h-4 text-success mx-auto mb-1" />
            <p className="text-lg font-bold">{metrics.pricingEngagementRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Pricing Eng.</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Count */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Sales</p>
              <p className="text-3xl font-bold text-primary">{metrics.totalSalesCount}</p>
              <p className="text-xs text-muted-foreground">
                {metrics.introBasedSales.length} intro + {metrics.userSales.length} outside
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Outreach</p>
              <p className="text-2xl font-bold">{metrics.totalActivity}</p>
              <p className="text-xs text-muted-foreground">Total contacts</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Recaps</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.userRecaps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recaps submitted yet
            </p>
          ) : (
            <div className="space-y-3">
              {metrics.userRecaps.slice(0, 5).map((recap) => (
                <div 
                  key={recap.id} 
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">{recap.staff_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(recap.shift_date).toLocaleDateString()} · {recap.shift_type}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {(recap.calls_made || 0) + (recap.texts_sent || 0)} contacts
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dashboard Legend */}
      <Card className="bg-muted/30">
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Booking metrics</strong> = credited to "Booked by" (who scheduled the intro)
            <br />
            <strong>Commission metrics</strong> = credited to "Commission owner" (who ran the first intro)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
