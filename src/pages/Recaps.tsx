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
import { BookingCreditTable } from '@/components/dashboard/BookingCreditTable';
import { ConversionCreditTable } from '@/components/dashboard/ConversionCreditTable';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { 
  DatePreset, 
  DateRange, 
  getDateRangeForPreset, 
  getPresetLabel,
  getCurrentPayPeriod,
  getLastPayPeriod,
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

  // Top 3 performers
  const topBookers = useMemo(() => {
    return [...metrics.bookingCredit]
      .sort((a, b) => b.introsBooked - a.introsBooked)
      .slice(0, 3);
  }, [metrics.bookingCredit]);

  const topShowers = useMemo(() => {
    return [...metrics.bookingCredit]
      .filter(m => m.introsBooked >= 3) // Min 3 booked to qualify
      .sort((a, b) => b.showRate - a.showRate)
      .slice(0, 3);
  }, [metrics.bookingCredit]);

  const topClosers = useMemo(() => {
    return [...metrics.conversionCredit]
      .filter(m => m.introsRan >= 3) // Min 3 ran to qualify
      .sort((a, b) => b.closingRate - a.closingRate)
      .slice(0, 3);
  }, [metrics.conversionCredit]);

  const topCommission = useMemo(() => {
    return [...metrics.conversionCredit]
      .sort((a, b) => b.commissionEarned - a.commissionEarned)
      .slice(0, 3);
  }, [metrics.conversionCredit]);

  const generateSummaryText = () => {
    const rangeText = `${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d, yyyy')}`;
    
    let text = `📊 Studio Recap: ${getRecapLabel(recapPreset)} (${rangeText})\n\n`;
    
    text += `🎯 Studio Totals:\n`;
    text += `• Intros Booked: ${metrics.studio.introsBooked}\n`;
    text += `• Intros Showed: ${metrics.studio.introsShowed} (${metrics.studio.showRate.toFixed(0)}% show rate)\n`;
    text += `• Sales: ${metrics.studio.introSales} (${metrics.studio.closingRate.toFixed(0)}% close rate)\n`;
    text += `• Commission: $${metrics.studio.totalCommission.toFixed(2)}\n\n`;

    if (topBookers.length > 0) {
      text += `🏆 Top Bookers:\n`;
      topBookers.forEach((m, i) => {
        text += `${i + 1}. ${m.saName}: ${m.introsBooked} booked\n`;
      });
      text += `\n`;
    }

    if (topClosers.length > 0) {
      text += `💰 Top Closers:\n`;
      topClosers.forEach((m, i) => {
        text += `${i + 1}. ${m.saName}: ${m.closingRate.toFixed(0)}% (${m.sales}/${m.introsRan})\n`;
      });
      text += `\n`;
    }

    if (topCommission.length > 0) {
      text += `💵 Top Commission:\n`;
      topCommission.forEach((m, i) => {
        text += `${i + 1}. ${m.saName}: $${m.commissionEarned.toFixed(2)}\n`;
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
    csv += `Studio,All,Intros Booked,${metrics.studio.introsBooked}\n`;
    csv += `Studio,All,Intros Showed,${metrics.studio.introsShowed}\n`;
    csv += `Studio,All,Show Rate,${metrics.studio.showRate.toFixed(1)}%\n`;
    csv += `Studio,All,Sales,${metrics.studio.introSales}\n`;
    csv += `Studio,All,Close Rate,${metrics.studio.closingRate.toFixed(1)}%\n`;
    csv += `Studio,All,Commission,$${metrics.studio.totalCommission.toFixed(2)}\n`;
    
    // Booking credit
    metrics.bookingCredit.forEach(m => {
      csv += `Booking Credit,${m.saName},Intros Booked,${m.introsBooked}\n`;
      csv += `Booking Credit,${m.saName},Intros Showed,${m.introsShowed}\n`;
      csv += `Booking Credit,${m.saName},Show Rate,${m.showRate.toFixed(1)}%\n`;
    });
    
    // Conversion credit
    metrics.conversionCredit.forEach(m => {
      csv += `Conversion Credit,${m.saName},Intros Ran,${m.introsRan}\n`;
      csv += `Conversion Credit,${m.saName},Sales,${m.sales}\n`;
      csv += `Conversion Credit,${m.saName},Close Rate,${m.closingRate.toFixed(1)}%\n`;
      csv += `Conversion Credit,${m.saName},Commission,$${m.commissionEarned.toFixed(2)}\n`;
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
        introsBooked={metrics.studio.introsBooked}
        introsShowed={metrics.studio.introsShowed}
        showRate={metrics.studio.showRate}
        introSales={metrics.studio.introSales}
        closingRate={metrics.studio.closingRate}
        totalCommission={metrics.studio.totalCommission}
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
                  <div key={m.saName} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      {i === 0 && '🥇'}
                      {i === 1 && '🥈'}
                      {i === 2 && '🥉'}
                      {m.saName}
                    </span>
                    <Badge variant="secondary" className="text-xs">{m.introsBooked}</Badge>
                  </div>
                ))
              )}
            </div>

            {/* Top Show Rate */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Best Show Rate</p>
              {topShowers.length === 0 ? (
                <p className="text-xs text-muted-foreground">Min 3 booked</p>
              ) : (
                topShowers.map((m, i) => (
                  <div key={m.saName} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      {i === 0 && '🥇'}
                      {i === 1 && '🥈'}
                      {i === 2 && '🥉'}
                      {m.saName}
                    </span>
                    <Badge variant="secondary" className="text-xs">{m.showRate.toFixed(0)}%</Badge>
                  </div>
                ))
              )}
            </div>

            {/* Top Closers */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Best Close Rate</p>
              {topClosers.length === 0 ? (
                <p className="text-xs text-muted-foreground">Min 3 ran</p>
              ) : (
                topClosers.map((m, i) => (
                  <div key={m.saName} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      {i === 0 && '🥇'}
                      {i === 1 && '🥈'}
                      {i === 2 && '🥉'}
                      {m.saName}
                    </span>
                    <Badge variant="secondary" className="text-xs">{m.closingRate.toFixed(0)}%</Badge>
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
                  <div key={m.saName} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      {i === 0 && '🥇'}
                      {i === 1 && '🥈'}
                      {i === 2 && '🥉'}
                      {m.saName}
                    </span>
                    <Badge variant="secondary" className="text-xs">${m.commissionEarned.toFixed(0)}</Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Booking Credit Summary */}
      <BookingCreditTable data={metrics.bookingCredit} />

      {/* Conversion Credit Summary */}
      <ConversionCreditTable data={metrics.conversionCredit} />

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
