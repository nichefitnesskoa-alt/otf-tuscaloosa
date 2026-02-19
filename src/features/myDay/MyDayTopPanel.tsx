/**
 * MyDayTopPanel — Scoreboard, AMC Tracker, and Weekly Schedule
 * with a shared date range picker.
 * Lives above the MyDay tab system; does NOT affect intro cards or follow-ups.
 */
import { useState, useMemo, useEffect } from 'react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { StudioScoreboard } from '@/components/dashboard/StudioScoreboard';
import { AmcTracker } from '@/components/dashboard/AmcTracker';
import { WeeklySchedule } from '@/components/dashboard/WeeklySchedule';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { DatePreset, DateRange, getDateRangeForPreset } from '@/lib/pay-period';
import { IntroBooked } from '@/context/DataContext';
import { ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

function useQAndPrepRates(
  introsBooked: IntroBooked[],
  dateRange: DateRange | null,
) {
  const [qRate, setQRate] = useState<number | undefined>(undefined);
  const [prepRate, setPrepRate] = useState<number | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const firstIntros = introsBooked.filter(b => {
        if ((b as any).is_vip === true || (b as any).originating_booking_id) return false;
        if (!dateRange) return true;
        try {
          const d = new Date(b.class_date);
          return d >= dateRange.start && d <= dateRange.end;
        } catch { return false; }
      });
      if (firstIntros.length === 0) { setQRate(undefined); setPrepRate(undefined); return; }
      const ids = firstIntros.map(b => b.id);
      const [{ data: qs }, { data: preppedBookings }] = await Promise.all([
        supabase.from('intro_questionnaires').select('booking_id, status').in('booking_id', ids.slice(0, 500)),
        supabase.from('intros_booked').select('id').in('id', ids.slice(0, 500)).eq('prepped', true),
      ]);
      const completed = new Set(
        (qs || []).filter(q => q.status === 'completed' || q.status === 'submitted').map(q => q.booking_id)
      );
      setQRate((completed.size / firstIntros.length) * 100);
      setPrepRate(((preppedBookings?.length || 0) / firstIntros.length) * 100);
    })();
  }, [introsBooked, dateRange]);

  return { qRate, prepRate };
}

export function MyDayTopPanel() {
  const { introsBooked, introsRun, sales, shiftRecaps, followUpQueue, followupTouches } = useData();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(true);

  // Shared date range for all 3 panels — default to current pay period
  const [datePreset, setDatePreset] = useState<DatePreset>('pay_period');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const dateRange = useMemo(
    () => getDateRangeForPreset(datePreset, customRange),
    [datePreset, customRange],
  );

  const metrics = useDashboardMetrics(
    introsBooked, introsRun, sales, dateRange, shiftRecaps,
    user?.name, followUpQueue, followupTouches,
  );

  const { qRate, prepRate } = useQAndPrepRates(introsBooked, dateRange);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border-b bg-background/95 backdrop-blur-sm">
        {/* Header row with toggle */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Studio Overview</span>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          {/* Shared date range picker */}
          <div className="px-4 pb-2">
            <DateRangeFilter
              preset={datePreset}
              customRange={customRange}
              onPresetChange={setDatePreset}
              onCustomRangeChange={setCustomRange}
              dateRange={dateRange || { start: new Date(2020, 0, 1), end: new Date() }}
            />
          </div>

          {/* Three panels stacked */}
          <div className="px-4 pb-4 space-y-3">
            <StudioScoreboard
              introsRun={metrics.studio.introsRun}
              introSales={metrics.studio.introSales}
              closingRate={metrics.studio.closingRate}
              qCompletionRate={qRate}
              prepRate={prepRate}
              introsBooked={metrics.pipeline.booked}
              introsShowed={metrics.pipeline.showed}
            />
            <WeeklySchedule />
            <AmcTracker />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
