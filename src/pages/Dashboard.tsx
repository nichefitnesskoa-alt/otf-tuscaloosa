import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { StudioScoreboard } from '@/components/dashboard/StudioScoreboard';
import { BookingCreditTable } from '@/components/dashboard/BookingCreditTable';
import { ConversionCreditTable } from '@/components/dashboard/ConversionCreditTable';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { DatePreset, DateRange, getDateRangeForPreset } from '@/lib/pay-period';

export default function Dashboard() {
  const { user } = useAuth();
  const { introsBooked, introsRun, sales, isLoading } = useData();

  // Date filter state - default to pay period
  const [datePreset, setDatePreset] = useState<DatePreset>('pay_period');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  // Calculate the current date range based on preset
  const dateRange = useMemo(() => {
    return getDateRangeForPreset(datePreset, customRange);
  }, [datePreset, customRange]);

  // Pass date range to metrics hook
  const metrics = useDashboardMetrics(introsBooked, introsRun, sales, dateRange);

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
        <p className="text-sm text-muted-foreground mb-3">
          Studio performance metrics
        </p>
        
        {/* Global Date Filter */}
        <DateRangeFilter
          preset={datePreset}
          customRange={customRange}
          onPresetChange={setDatePreset}
          onCustomRangeChange={setCustomRange}
          dateRange={dateRange || { start: new Date(2020, 0, 1), end: new Date() }}
        />
      </div>

      {/* Studio Scoreboard - visible to all */}
      <StudioScoreboard
        introsBooked={metrics.studio.introsBooked}
        introsShowed={metrics.studio.introsShowed}
        showRate={metrics.studio.showRate}
        introSales={metrics.studio.introSales}
        closingRate={metrics.studio.closingRate}
      />

      {/* Booking Credit Table */}
      <BookingCreditTable data={metrics.bookingCredit} />

      {/* Conversion Credit Table */}
      <ConversionCreditTable data={metrics.conversionCredit} />

      {/* Legend Card */}
      <Card className="bg-muted/30">
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Booking Credit</strong> = credited to "Booked by" (who scheduled the intro) — filtered by <em>booking date</em>
            <br />
            <strong>Conversion Credit</strong> = credited to "Commission owner" (who ran the first intro) — sales filtered by <em>date closed</em>
            <br />
            <strong>Note:</strong> Second intros are excluded from Booked/Showed/Show Rate metrics.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
