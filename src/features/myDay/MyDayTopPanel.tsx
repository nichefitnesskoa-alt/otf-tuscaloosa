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
      const now = new Date();
      const firstIntros = introsBooked.filter(b => {
        if ((b as any).is_vip === true || (b as any).originating_booking_id) return false;
        if (!dateRange) return true;
        try {
          const d = new Date(b.class_date);
          if (d < dateRange.start || d > dateRange.end) return false;
          // Exclude future bookings today
          const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          if (b.class_date === todayYMD) {
            const timeParts = ((b as any).intro_time || '').match(/(\d+):(\d+)/);
            if (timeParts) {
              const bookingTime = new Date(now);
              bookingTime.setHours(Number(timeParts[1]), Number(timeParts[2]), 0, 0);
              if (bookingTime > now) return false;
            }
          }
          return true;
        } catch { return false; }
      });
      if (firstIntros.length === 0) { setQRate(undefined); setPrepRate(undefined); return; }
      const ids = firstIntros.map(b => b.id);
      const chunkSize = 500;
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += chunkSize) {
        chunks.push(ids.slice(i, i + chunkSize));
      }
      const allQs: any[] = [];
      const allPrepped: any[] = [];
      const showedBookingIds = new Set<string>();
      await Promise.all(chunks.map(async (chunk) => {
        const [{ data: qs }, { data: preppedBookings }, { data: runRows }] = await Promise.all([
          supabase.from('intro_questionnaires').select('booking_id, status').in('booking_id', chunk),
          supabase.from('intros_booked').select('id').in('id', chunk).eq('prepped', true),
          supabase.from('intros_run').select('linked_intro_booked_id, result').in('linked_intro_booked_id', chunk),
        ]);
        if (qs) allQs.push(...qs);
        if (preppedBookings) allPrepped.push(...preppedBookings);
        if (runRows) runRows.forEach(r => {
          const res = (r.result || '').toLowerCase();
          if (res !== 'no-show' && res !== 'no show' && r.linked_intro_booked_id) {
            showedBookingIds.add(r.linked_intro_booked_id);
          }
        });
      }));
      const qDenominator = firstIntros.filter(b => showedBookingIds.has(b.id));
      const completed = new Set(
        allQs.filter(q => q.status === 'completed' || q.status === 'submitted').map(q => q.booking_id)
      );
      const preppedIds = new Set(allPrepped.map(p => p.id));
      const preppedAndShowed = firstIntros.filter(b => showedBookingIds.has(b.id) && preppedIds.has(b.id));
      setQRate(qDenominator.length > 0 ? (completed.size / qDenominator.length) * 100 : undefined);
      setPrepRate(qDenominator.length > 0 ? (preppedAndShowed.length / qDenominator.length) * 100 : undefined);
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
            />
            <WeeklySchedule />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
