import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { StudioScoreboard } from '@/components/dashboard/StudioScoreboard';
import { BookingCreditTable } from '@/components/dashboard/BookingCreditTable';
import { ConversionCreditTable } from '@/components/dashboard/ConversionCreditTable';
import { IndividualActivityTable } from '@/components/dashboard/IndividualActivityTable';
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

  // Filter booking credit and conversion credit based on selected employee
  const filteredBookingCredit = useMemo(() => {
    if (!effectiveEmployee) return metrics.bookingCredit;
    return metrics.bookingCredit.filter(m => m.saName === effectiveEmployee);
  }, [metrics.bookingCredit, effectiveEmployee]);

  const filteredConversionCredit = useMemo(() => {
    if (!effectiveEmployee) return metrics.conversionCredit;
    return metrics.conversionCredit.filter(m => m.saName === effectiveEmployee);
  }, [metrics.conversionCredit, effectiveEmployee]);

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

      {/* Studio Scoreboard - visible to all (always shows studio totals) */}
      <StudioScoreboard
        introsBooked={metrics.studio.introsBooked}
        introsShowed={metrics.studio.introsShowed}
        showRate={metrics.studio.showRate}
        introSales={metrics.studio.introSales}
        closingRate={metrics.studio.closingRate}
        totalCommission={metrics.studio.totalCommission}
      />

      {/* Individual Activity Table - NEW */}
      <IndividualActivityTable data={filteredIndividualActivity} />

      {/* Booking Credit Table - filtered */}
      <BookingCreditTable data={filteredBookingCredit} />

      {/* Conversion Credit Table - filtered */}
      <ConversionCreditTable data={filteredConversionCredit} />

      {/* Legend Card */}
      <Card className="bg-muted/30">
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Individual Activity</strong> = outreach efforts (calls, texts, DMs, emails) from shift recaps
            <br />
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
