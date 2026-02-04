import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Download, Copy, Calendar, TrendingUp, Trophy } from 'lucide-react';
import { StudioScoreboard } from '@/components/dashboard/StudioScoreboard';
import { PerSATable } from '@/components/dashboard/PerSATable';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { 
  DateRange, 
  getCurrentPayPeriod,
} from '@/lib/pay-period';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths } from 'date-fns';

type RecapPreset = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';

function getRecapDateRange(preset: RecapPreset): DateRange {
  const today = new Date();
  
  switch (preset) {
    case 'this_week':
      return {
        start: startOfWeek(today, { weekStartsOn: 1 }),
        end: endOfWeek(today, { weekStartsOn: 1 }),
      };
    case 'last_week':
      const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
      return {
        start: lastWeekStart,
        end: endOfWeek(lastWeekStart, { weekStartsOn: 1 }),
      };
    case 'this_month':
      return {
        start: startOfMonth(today),
        end: endOfMonth(today),
      };
    case 'last_month':
      const lastMonth = subMonths(today, 1);
      return {
        start: startOfMonth(lastMonth),
        end: endOfMonth(lastMonth),
      };
    default:
      return getCurrentPayPeriod();
  }
}

function getRecapLabel(preset: RecapPreset): string {
  switch (preset) {
    case 'this_week': return 'This Week';
    case 'last_week': return 'Last Week';
    case 'this_month': return 'This Month';
    case 'last_month': return 'Last Month';
    case 'custom': return 'Custom Range';
    default: return preset;
  }
}

export default function Recaps() {
  const { user } = useAuth();
  const { introsBooked, introsRun, sales, isLoading } = useData();

  const [recapPreset, setRecapPreset] = useState<RecapPreset>('this_week');
  
  const dateRange = useMemo(() => getRecapDateRange(recapPreset), [recapPreset]);
  const metrics = useDashboardMetrics(introsBooked, introsRun, sales, dateRange);

  // Use leaderboard data from metrics
  const { topBookers, topCommission, topClosing, topShowRate } = metrics.leaderboards;

  const generateSummaryText = () => {
    const rangeText = `${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d, yyyy')}`;
    
    let text = `📊 Studio Recap: ${getRecapLabel(recapPreset)} (${rangeText})\n\n`;
    
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

    if (topCommission.length > 0) {
      text += `💵 Top Commission:\n`;
      topCommission.forEach((m, i) => {
        text += `${i + 1}. ${m.name}: $${m.value.toFixed(0)}\n`;
      });
    }

    return text;
  };

  const handleCopySummary = () => {
    const text = generateSummaryText();
    navigator.clipboard.writeText(text);
    toast.success('Summary copied to clipboard!');
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
    a.download = `studio_recap_${rangeText}.csv`;
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
        <h1 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Recaps
        </h1>
        <p className="text-sm text-muted-foreground mb-3">
          Weekly and monthly performance summaries
        </p>
        
        {/* Preset Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={recapPreset} onValueChange={(v) => setRecapPreset(v as RecapPreset)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="last_week">Last Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
            </SelectContent>
          </Select>
          
          <Badge variant="outline" className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {format(dateRange.start, 'MMM d')} - {format(dateRange.end, 'MMM d, yyyy')}
          </Badge>
        </div>
      </div>

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

      {/* Top Performers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            Top Performers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {/* Top Bookers */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Top Bookers</p>
              {topBookers.length === 0 ? (
                <p className="text-xs text-muted-foreground">No data</p>
              ) : (
                topBookers.map((m, i) => (
                  <div key={m.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      {i === 0 && '🥇'}
                      {i === 1 && '🥈'}
                      {i === 2 && '🥉'}
                      {m.name}
                    </span>
                    <Badge variant="secondary" className="text-xs">{m.value}</Badge>
                  </div>
                ))
              )}
            </div>

            {/* Top Show Rate */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Best Show Rate</p>
              {topShowRate.length === 0 ? (
                <p className="text-xs text-muted-foreground">Min 3 booked</p>
              ) : (
                topShowRate.map((m, i) => (
                  <div key={m.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      {i === 0 && '🥇'}
                      {i === 1 && '🥈'}
                      {i === 2 && '🥉'}
                      {m.name}
                    </span>
                    <Badge variant="secondary" className="text-xs">{m.value.toFixed(0)}%</Badge>
                  </div>
                ))
              )}
            </div>

            {/* Top Closers */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Best Close Rate</p>
              {topClosing.length === 0 ? (
                <p className="text-xs text-muted-foreground">Min 3 ran</p>
              ) : (
                topClosing.map((m, i) => (
                  <div key={m.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      {i === 0 && '🥇'}
                      {i === 1 && '🥈'}
                      {i === 2 && '🥉'}
                      {m.name}
                    </span>
                    <Badge variant="secondary" className="text-xs">{m.value.toFixed(0)}%</Badge>
                  </div>
                ))
              )}
            </div>

            {/* Top Commission */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Top Commission</p>
              {topCommission.length === 0 ? (
                <p className="text-xs text-muted-foreground">No data</p>
              ) : (
                topCommission.map((m, i) => (
                  <div key={m.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      {i === 0 && '🥇'}
                      {i === 1 && '🥈'}
                      {i === 2 && '🥉'}
                      {m.name}
                    </span>
                    <Badge variant="secondary" className="text-xs">${m.value.toFixed(0)}</Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-SA Performance */}
      <PerSATable data={metrics.perSA} />

      {/* Export Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Button onClick={handleCopySummary} variant="outline" className="flex-1">
              <Copy className="w-4 h-4 mr-2" />
              Copy for GroupMe
            </Button>
            <Button onClick={handleDownloadCSV} variant="outline" className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Download CSV
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
