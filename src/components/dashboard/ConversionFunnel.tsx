import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDown, Users, UserCheck, Target, Filter, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useData, IntroBooked, IntroRun } from '@/context/DataContext';
import { DateRange } from '@/lib/pay-period';
import { isMembershipSale, isSaleInRange, isRunInRange } from '@/lib/sales-detection';
import { isWithinInterval } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ConversionFunnelProps {
  dateRange?: DateRange | null;
  className?: string;
}

function isInRange(dateStr: string | null | undefined, range: DateRange | null): boolean {
  if (!range || !dateStr) return !range;
  try {
    return isWithinInterval(parseLocalDate(dateStr), { start: range.start, end: range.end });
  } catch { return false; }
}

type IntroOrder = '1st' | '2nd';

function computeFunnel(
  order: IntroOrder,
  introsBooked: IntroBooked[],
  introsRun: IntroRun[],
  dateRange: DateRange | null | undefined,
) {
  // Build phone → sorted booking dates for 2nd-intro detection
  const memberBookings = new Map<string, string[]>();
  introsBooked.forEach(b => {
    const phone = (b as any).phone_e164 as string | null | undefined;
    const key = (phone || b.member_name).toLowerCase();
    const existing = memberBookings.get(key) || [];
    existing.push(b.class_date);
    memberBookings.set(key, existing.sort());
  });

  const isFirstIntro = (b: IntroBooked): boolean => {
    // Also honour originating_booking_id — explicit 2nd intro marker
    if ((b as any).originating_booking_id) return false;
    const phone = (b as any).phone_e164 as string | null | undefined;
    const key = (phone || b.member_name).toLowerCase();
    const allDates = memberBookings.get(key) || [];
    return allDates.indexOf(b.class_date) === 0;
  };

  // Active, non-VIP bookings matching the 1st/2nd filter
  const typeFilteredBookingIds = new Set(
    introsBooked
      .filter(b => {
        const status = ((b as any).booking_status || '').toUpperCase();
        if (status.includes('DUPLICATE') || status.includes('DELETED') || status.includes('DEAD')) return false;
        if ((b as any).ignore_from_metrics) return false;
        if ((b as any).is_vip === true) return false;
        return order === '1st' ? isFirstIntro(b) : !isFirstIntro(b);
      })
      .map(b => b.id)
  );

  // Booked: bookings in the date range (class_date anchored)
  const activeBookings = introsBooked.filter(b =>
    typeFilteredBookingIds.has(b.id) &&
    isInRange(b.class_date, dateRange || null)
  );
  const booked = activeBookings.length;

  // Showed: counted per active booking (run-date anchored)
  let showed = 0;
  activeBookings.forEach(b => {
    const runs = introsRun.filter(r => r.linked_intro_booked_id === b.id);
    if (runs.some(r => r.result !== 'No-show' && isRunInRange(r, dateRange || null))) showed++;
  });

  // Sold: sale-date anchored (matches Scoreboard)
  const sold = introsRun.filter(
    r =>
      r.linked_intro_booked_id &&
      typeFilteredBookingIds.has(r.linked_intro_booked_id) &&
      isSaleInRange(r, dateRange || null)
  ).length;

  return { booked, showed, sold };
}

interface FunnelRowProps {
  label: string;
  data: { booked: number; showed: number; sold: number };
  highlight?: boolean;
}

function FunnelRow({ label, data, highlight }: FunnelRowProps) {
  const showRate = data.booked > 0 ? (data.showed / data.booked) * 100 : 0;
  const closeRate = data.showed > 0 ? (data.sold / data.showed) * 100 : 0;
  const bookingToSale = data.booked > 0 ? (data.sold / data.booked) * 100 : 0;

  const rateColor = (rate: number) =>
    rate >= 75 ? 'text-success' : rate >= 50 ? 'text-warning' : 'text-destructive';

  return (
    <div className={cn('rounded-lg border p-3 space-y-2', highlight && 'bg-primary/5 border-primary/30')}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={cn('text-[11px] font-medium', rateColor(bookingToSale))}>
          {bookingToSale.toFixed(0)}% book→sale
        </span>
      </div>
      <div className="flex items-center gap-1">
        {/* Booked */}
        <div className="flex-1 text-center p-2 rounded bg-info/10 border border-info/20">
          <Users className="w-3.5 h-3.5 mx-auto mb-0.5 text-info" />
          <p className="text-lg font-bold text-info">{data.booked}</p>
          <p className="text-[10px] text-muted-foreground">Booked</p>
        </div>

        {/* Arrow + Show Rate */}
        <div className="flex flex-col items-center gap-0.5">
          <ArrowDown className="w-3 h-3 text-muted-foreground" />
          <span className={cn('text-[10px] font-medium', rateColor(showRate))}>
            {showRate.toFixed(0)}%
          </span>
        </div>

        {/* Showed */}
        <div className="flex-1 text-center p-2 rounded bg-warning/10 border border-warning/20">
          <UserCheck className="w-3.5 h-3.5 mx-auto mb-0.5 text-warning" />
          <p className="text-lg font-bold text-warning">{data.showed}</p>
          <p className="text-[10px] text-muted-foreground">Showed</p>
        </div>

        {/* Arrow + Close Rate */}
        <div className="flex flex-col items-center gap-0.5">
          <ArrowDown className="w-3 h-3 text-muted-foreground" />
          <span className={cn('text-[10px] font-medium', rateColor(closeRate))}>
            {closeRate.toFixed(0)}%
          </span>
        </div>

        {/* Sold */}
        <div className="flex-1 text-center p-2 rounded bg-success/10 border border-success/20">
          <Target className="w-3.5 h-3.5 mx-auto mb-0.5 text-success" />
          <p className="text-lg font-bold text-success">{data.sold}</p>
          <p className="text-[10px] text-muted-foreground">Sold</p>
        </div>
      </div>
    </div>
  );
}

export function ConversionFunnel({ dateRange, className }: ConversionFunnelProps) {
  const { introsBooked, introsRun } = useData();

  const { first, second, total } = useMemo(() => {
    const first = computeFunnel('1st', introsBooked, introsRun, dateRange);
    const second = computeFunnel('2nd', introsBooked, introsRun, dateRange);
    const total = {
      booked: first.booked + second.booked,
      showed: first.showed + second.showed,
      sold: first.sold + second.sold,
    };
    return { first, second, total };
  }, [introsBooked, introsRun, dateRange]);

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" />
          Conversion Funnel
        </CardTitle>
        <p className="text-xs text-muted-foreground">1st and 2nd intro attribution — separate rows</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <FunnelRow label="1st Intro" data={first} />
        <FunnelRow label="2nd Intro" data={second} />

        {/* Totals divider */}
        <div className="border-t pt-2">
          <FunnelRow label="Total (All Intros)" data={total} highlight />
        </div>

        <p className="text-[10px] text-muted-foreground/70 text-center">Excludes VIP events · Sale date anchored</p>
      </CardContent>
    </Card>
  );
}
