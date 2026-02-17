import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  BarChart3, RefreshCw, Calendar, ChevronRight, TrendingUp, TrendingDown, 
  Target, Users, Clock, AlertTriangle, CheckCircle, Minus
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, subDays, parseISO, differenceInDays } from 'date-fns';
import ShiftRecapDetails from '@/components/admin/ShiftRecapDetails';
import { parseLocalDate } from '@/lib/utils';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { DatePreset, DateRange, getDateRangeForPreset } from '@/lib/pay-period';
import { isMembershipSale } from '@/lib/sales-detection';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

interface ShiftRecap {
  id: string;
  staff_name: string;
  shift_date: string;
  shift_type: string;
  calls_made: number | null;
  texts_sent: number | null;
  emails_sent: number | null;
  dms_sent: number | null;
  other_info: string | null;
  created_at: string;
}

interface FollowUpItem {
  name: string;
  dueDate: string;
  status: 'on_time' | 'due_today' | 'overdue';
  daysOverdue: number;
}

export default function MyPerformance() {
  const { user } = useAuth();
  const { introsBooked, introsRun, sales, shiftRecaps, followUpQueue, followupTouches, lastUpdated: globalLastUpdated } = useData();
  const [recaps, setRecaps] = useState<ShiftRecap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecap, setSelectedRecap] = useState<ShiftRecap | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const hasMountedRef = useRef(false);

  // Date filter
  const [datePreset, setDatePreset] = useState<DatePreset>('pay_period');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const dateRange = useMemo(() => getDateRangeForPreset(datePreset, customRange), [datePreset, customRange]);
  const userName = user?.name || '';
  const metrics = useDashboardMetrics(introsBooked, introsRun, sales, dateRange, shiftRecaps, userName, followUpQueue, followupTouches);

  // Personal metrics
  const personalStats = useMemo(() => {
    const sa = metrics.perSA.find(m => m.saName === userName);
    return sa || null;
  }, [metrics.perSA, userName]);

  // Previous period metrics for comparison
  const prevDateRange = useMemo(() => {
    if (!dateRange) return null;
    const duration = dateRange.end.getTime() - dateRange.start.getTime();
    return {
      start: new Date(dateRange.start.getTime() - duration),
      end: new Date(dateRange.start.getTime()),
    };
  }, [dateRange]);
  
  const prevMetrics = useDashboardMetrics(introsBooked, introsRun, sales, prevDateRange, shiftRecaps, userName, followUpQueue, followupTouches);
  const prevStats = useMemo(() => {
    return prevMetrics.perSA.find(m => m.saName === userName) || null;
  }, [prevMetrics.perSA, userName]);

  // Coaching insights for this SA
  const coachingInsight = useMemo(() => {
    if (!personalStats) return null;
    const { closingRate } = personalStats;
    
    if (closingRate >= 60) {
      return { tip: `Strong ${closingRate.toFixed(0)}% close rate! You're performing above average.`, priority: 'low' as const };
    }
    if (closingRate < 40) {
      return { tip: `Your close rate is ${closingRate.toFixed(0)}% — focus on discovery and building rapport to boost conversions.`, priority: 'high' as const };
    }
    return null;
  }, [personalStats]);

  // Scatter plot data: this SA vs all others
  const scatterData = useMemo(() => {
    return metrics.perSA
      .filter(m => m.introsRun >= 1)
      .map(m => ({
        name: m.saName,
        closeRate: m.closingRate,
        sales: m.sales,
        isMe: m.saName === userName,
      }));
  }, [metrics.perSA, userName]);

  // Follow-up status
  useEffect(() => {
    fetchFollowUps();
  }, [userName]);

  const fetchFollowUps = async () => {
    if (!userName) return;
    const { data: leads } = await supabase
      .from('leads')
      .select('first_name, last_name, follow_up_at, stage')
      .neq('stage', 'lost')
      .neq('stage', 'won')
      .not('follow_up_at', 'is', null);

    if (leads) {
      const now = new Date();
      const items: FollowUpItem[] = leads.map((l: any) => {
        const due = parseISO(l.follow_up_at);
        const diff = differenceInDays(now, due);
        return {
          name: `${l.first_name} ${l.last_name}`,
          dueDate: l.follow_up_at,
          status: diff > 0 ? 'overdue' : diff === 0 ? 'due_today' : 'on_time',
          daysOverdue: Math.max(0, diff),
        };
      });
      setFollowUps(items.sort((a, b) => b.daysOverdue - a.daysOverdue));
    }
  };

  const fetchMyRecaps = async () => {
    if (!user?.name) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('shift_recaps')
        .select('id, staff_name, shift_date, shift_type, calls_made, texts_sent, emails_sent, dms_sent, other_info, created_at')
        .eq('staff_name', user.name)
        .order('shift_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setRecaps(data || []);
    } catch (error) {
      console.error('Error fetching shift recaps:', error);
      toast.error('Failed to load your shifts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyRecaps();
    hasMountedRef.current = true;
  }, [user?.name]);

  useEffect(() => {
    if (hasMountedRef.current && globalLastUpdated) {
      fetchMyRecaps();
    }
  }, [globalLastUpdated]);

  const handleOpenDetails = (recap: ShiftRecap) => {
    setSelectedRecap(recap);
    setViewDialogOpen(true);
  };

  const ComparisonArrow = ({ current, previous }: { current: number; previous: number | undefined }) => {
    if (previous === undefined || previous === 0) return <Minus className="w-3 h-3 text-muted-foreground" />;
    const diff = current - previous;
    if (diff > 0) return <TrendingUp className="w-3 h-3 text-success" />;
    if (diff < 0) return <TrendingDown className="w-3 h-3 text-destructive" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  const overdueCount = followUps.filter(f => f.status === 'overdue').length;
  const dueTodayCount = followUps.filter(f => f.status === 'due_today').length;
  const onTimeCount = followUps.filter(f => f.status === 'on_time').length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            My Performance
          </h1>
          <p className="text-sm text-muted-foreground">
            Your personal stats, coaching insights, and activity
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchMyRecaps} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Date Filter */}
      <DateRangeFilter
        preset={datePreset}
        customRange={customRange}
        onPresetChange={setDatePreset}
        onCustomRangeChange={setCustomRange}
        dateRange={dateRange || { start: new Date(2020, 0, 1), end: new Date() }}
      />

      {/* Section 1: MY STATS */}
      <Card className="bg-foreground text-background">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4" />
            My Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Intros Run"
              value={personalStats?.introsRun ?? 0}
              prev={prevStats?.introsRun}
            />
            <StatCard
              label="Sales"
              value={personalStats?.sales ?? 0}
              prev={prevStats?.sales}
            />
            <StatCard
              label="Close Rate"
              value={`${(personalStats?.closingRate ?? 0).toFixed(0)}%`}
              prev={prevStats ? `${prevStats.closingRate.toFixed(0)}%` : undefined}
              rawCurrent={personalStats?.closingRate ?? 0}
              rawPrev={prevStats?.closingRate}
            />
            <StatCard
              label="Sales"
              value={personalStats?.sales ?? 0}
              prev={prevStats?.sales}
            />
            <StatCard
              label="Commission"
              value={`$${(personalStats?.commission ?? 0).toFixed(0)}`}
              prev={prevStats ? `$${prevStats.commission.toFixed(0)}` : undefined}
              rawCurrent={personalStats?.commission ?? 0}
              rawPrev={prevStats?.commission}
            />
            <StatCard
              label="Close%"
              value={`${(personalStats?.closingRate ?? 0).toFixed(0)}%`}
              prev={prevStats ? `${prevStats.closingRate.toFixed(0)}%` : undefined}
              rawCurrent={personalStats?.closingRate ?? 0}
              rawPrev={prevStats?.closingRate}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: MY COACHING INSIGHTS */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            My Coaching Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {coachingInsight ? (
            <div className={`p-3 rounded-lg text-sm border-l-4 ${
              coachingInsight.priority === 'high' ? 'border-l-destructive bg-destructive/5' :
              coachingInsight.priority === 'low' ? 'border-l-success bg-success/5' :
              'border-l-warning bg-warning/5'
            }`}>
              {coachingInsight.tip}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Run more intros to unlock coaching insights.</p>
          )}

          {/* Scatter: Close Rate vs Goal/Why */}
          {scatterData.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Close Rate vs Sales (you = highlighted)</p>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="sales" type="number" tick={{ fontSize: 10 }} name="Sales" />
                    <YAxis dataKey="closeRate" type="number" domain={[0, 100]} tick={{ fontSize: 10 }} name="Close %" />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => [name === 'sales' ? value : `${value}%`, name === 'sales' ? 'Sales' : 'Close Rate']}
                      labelFormatter={(_, payload: any) => payload?.[0]?.payload?.name || ''}
                    />
                    <Scatter
                      data={scatterData.filter(d => !d.isMe)}
                      fill="hsl(var(--muted-foreground))"
                      opacity={0.4}
                    />
                    <Scatter
                      data={scatterData.filter(d => d.isMe)}
                      fill="hsl(var(--primary))"
                      r={8}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: MY FOLLOW-UP STATUS */}
      {followUps.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              My Follow-Up Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 mb-3">
              <Badge variant="outline" className="text-destructive border-destructive">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {overdueCount} overdue
              </Badge>
              <Badge variant="outline" className="text-warning border-warning">
                <Clock className="w-3 h-3 mr-1" />
                {dueTodayCount} today
              </Badge>
              <Badge variant="outline" className="text-success border-success">
                <CheckCircle className="w-3 h-3 mr-1" />
                {onTimeCount} on time
              </Badge>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {followUps.slice(0, 8).map((fu, i) => (
                <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/50">
                  <span className="font-medium">{fu.name}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      fu.status === 'overdue' ? 'text-destructive border-destructive' :
                      fu.status === 'due_today' ? 'text-warning border-warning' :
                      'text-success border-success'
                    }`}
                  >
                    {fu.status === 'overdue' ? `${fu.daysOverdue}d overdue` :
                     fu.status === 'due_today' ? 'Due today' :
                     format(parseISO(fu.dueDate), 'MMM d')}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 4: MY ACTIVITY LOG */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Recent Shift Recaps
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
          ) : recaps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No shift recaps found. Submit a shift recap to see it here!
            </p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {recaps.map((recap) => (
                <div
                  key={recap.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => handleOpenDetails(recap)}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {format(parseLocalDate(recap.shift_date), 'MMM d, yyyy')}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] h-4">{recap.shift_type}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {(recap.calls_made || 0) + (recap.texts_sent || 0) + (recap.emails_sent || 0) + (recap.dms_sent || 0)} contacts
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Shift Details</DialogTitle>
          </DialogHeader>
          {selectedRecap && (
            <ShiftRecapDetails
              shiftRecapId={selectedRecap.id}
              staffName={selectedRecap.staff_name}
              shiftDate={selectedRecap.shift_date}
              shiftType={selectedRecap.shift_type}
              callsMade={selectedRecap.calls_made || 0}
              textsSent={selectedRecap.texts_sent || 0}
              emailsSent={selectedRecap.emails_sent || 0}
              dmsSent={selectedRecap.dms_sent || 0}
              otherInfo={selectedRecap.other_info}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Stat card component
function StatCard({ 
  label, value, prev, rawCurrent, rawPrev 
}: { 
  label: string; 
  value: number | string; 
  prev?: number | string; 
  rawCurrent?: number;
  rawPrev?: number;
}) {
  const numCurrent = rawCurrent ?? (typeof value === 'number' ? value : 0);
  const numPrev = rawPrev ?? (typeof prev === 'number' ? prev : undefined);
  
  const getDiff = () => {
    if (numPrev === undefined) return null;
    const diff = numCurrent - numPrev;
    if (diff > 0) return <TrendingUp className="w-3 h-3 text-success" />;
    if (diff < 0) return <TrendingDown className="w-3 h-3 text-destructive" />;
    return <Minus className="w-3 h-3 text-muted-foreground/50" />;
  };

  return (
    <div className="text-center p-2 bg-background/10 rounded-lg">
      <div className="flex items-center justify-center gap-1">
        <p className="text-xl font-bold">{value}</p>
        {getDiff()}
      </div>
      <p className="text-[10px] opacity-70">{label}</p>
    </div>
  );
}