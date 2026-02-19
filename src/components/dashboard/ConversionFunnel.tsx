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

/**
 * Returns a person key for matching runs to the same person.
 * Phone (e164) takes priority, falls back to normalized name.
 */
function personKey(
  phone: string | null | undefined,
  name: string,
): string {
  const p = (phone || '').replace(/\D/g, '');
  if (p.length >= 7) return `phone:${p}`;
  // name fallback: normalize to lowercase no-whitespace
  return `name:${name.toLowerCase().replace(/\s+/g, '')}`;
}

/**
 * Build person key for an IntroRun (uses member_name, no phone field on run).
 * We'll cross-reference against booking phones below.
 */

interface FunnelData {
  booked: number;
  showed: number;
  sold: number;
}

function computeFunnelBothRows(
  introsBooked: IntroBooked[],
  introsRun: IntroRun[],
  dateRange: DateRange | null | undefined,
): { first: FunnelData; second: FunnelData } {
  // ── Step 1: build phone→name lookup from bookings so we can resolve run person keys ──
  // booking id → person key
  const bookingPersonKey = new Map<string, string>();
  // person key → sorted list of run_dates (all runs ever, for counting runs before buy)
  const personRunDates = new Map<string, string[]>();

  introsBooked.forEach(b => {
    const phone = (b as any).phone_e164 as string | null | undefined;
    const key = personKey(phone, b.member_name);
    bookingPersonKey.set(b.id, key);
  });

  // For each run, derive its person key via the linked booking (most reliable),
  // then fall back to member_name on the run itself.
  introsRun.forEach(r => {
    let key: string;
    if (r.linked_intro_booked_id && bookingPersonKey.has(r.linked_intro_booked_id)) {
      key = bookingPersonKey.get(r.linked_intro_booked_id)!;
    } else {
      key = personKey(null, r.member_name);
    }
    const existing = personRunDates.get(key) || [];
    const rd = r.run_date || r.created_at.split('T')[0];
    existing.push(rd);
    personRunDates.set(key, existing);
  });

  // ── Step 2: active non-VIP bookings (no status filter issues) ──
  const activeBookings = introsBooked.filter(b => {
    const status = ((b as any).booking_status || '').toUpperCase();
    if (status.includes('DUPLICATE') || status.includes('DELETED') || status.includes('DEAD')) return false;
    if ((b as any).ignore_from_metrics) return false;
    if ((b as any).is_vip === true) return false;
    return true;
  });

  // person key → sorted booking class_dates (to detect 1st vs 2nd booking)
  const personBookingDates = new Map<string, string[]>();
  activeBookings.forEach(b => {
    const key = bookingPersonKey.get(b.id)!;
    const existing = personBookingDates.get(key) || [];
    existing.push(b.class_date);
    personBookingDates.set(key, existing.sort());
  });

  // Is this booking the person's FIRST booking (1st intro)?
  const isFirstBooking = (b: IntroBooked): boolean => {
    if ((b as any).originating_booking_id) return false;
    const key = bookingPersonKey.get(b.id)!;
    const dates = personBookingDates.get(key) || [];
    return dates[0] === b.class_date;
  };

  // ── Step 3: Booked + Showed counts (booking-anchored, same as before) ──
  const firstBookings = activeBookings.filter(b =>
    isFirstBooking(b) && isInRange(b.class_date, dateRange || null)
  );
  const secondBookings = activeBookings.filter(b =>
    !isFirstBooking(b) && isInRange(b.class_date, dateRange || null)
  );

  let firstShowed = 0;
  firstBookings.forEach(b => {
    const runs = introsRun.filter(r => r.linked_intro_booked_id === b.id);
    if (runs.some(r => r.result !== 'No-show' && isRunInRange(r, dateRange || null))) firstShowed++;
  });

  let secondShowed = 0;
  secondBookings.forEach(b => {
    const runs = introsRun.filter(r => r.linked_intro_booked_id === b.id);
    if (runs.some(r => r.result !== 'No-show' && isRunInRange(r, dateRange || null))) secondShowed++;
  });

  // ── Step 4: Sold counts — classified by run count BEFORE buy_date ──
  // The correct rule: count runs for this person with run_date <= buy_date.
  // If >= 2 runs before purchase → 2nd intro sale. If 1 → 1st intro sale.
  const activeBookingIds = new Set(activeBookings.map(b => b.id));

  let firstSold = 0;
  let secondSold = 0;

  introsRun.forEach(r => {
    // Must be a membership sale in the date range
    if (!isSaleInRange(r, dateRange || null)) return;
    // Must be linked to an active booking
    if (!r.linked_intro_booked_id || !activeBookingIds.has(r.linked_intro_booked_id)) return;

    // Determine this person's key
    let key: string;
    if (bookingPersonKey.has(r.linked_intro_booked_id)) {
      key = bookingPersonKey.get(r.linked_intro_booked_id)!;
    } else {
      key = personKey(null, r.member_name);
    }

    const buyDate = r.buy_date || r.run_date || r.created_at.split('T')[0];

    // Count all runs for this person where run_date <= buy_date
    const allRunDates = (personRunDates.get(key) || []).sort();
    const runsBeforePurchase = allRunDates.filter(rd => rd <= buyDate).length;

    if (runsBeforePurchase >= 2) {
      secondSold++;
    } else {
      firstSold++;
    }
  });

  return {
    first: { booked: firstBookings.length, showed: firstShowed, sold: firstSold },
    second: { booked: secondBookings.length, showed: secondShowed, sold: secondSold },
  };
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
    const { first, second } = computeFunnelBothRows(introsBooked, introsRun, dateRange);
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
