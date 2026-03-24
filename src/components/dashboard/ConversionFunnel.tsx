import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDown, Users, UserCheck, Target, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useData, IntroBooked, IntroRun } from '@/context/DataContext';
import { DateRange } from '@/lib/pay-period';
import { isMembershipSale, isSaleInRange, isRunInRange } from '@/lib/sales-detection';
import { isWithinInterval } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { FunnelDrillSheet, DrillPerson } from './FunnelDrillSheet';

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

function personKey(
  phone: string | null | undefined,
  name: string,
): string {
  const p = (phone || '').replace(/\D/g, '');
  if (p.length >= 7) return `phone:${p}`;
  return `name:${name.toLowerCase().replace(/\s+/g, '')}`;
}

interface FunnelData {
  booked: number;
  showed: number;
  sold: number;
  bookedPeople: DrillPerson[];
  showedPeople: DrillPerson[];
  soldPeople: DrillPerson[];
}

function computeFunnelBothRows(
  introsBooked: IntroBooked[],
  introsRun: IntroRun[],
  dateRange: DateRange | null | undefined,
): { first: FunnelData; second: FunnelData } {
  const bookingPersonKey = new Map<string, string>();
  const nameToPersonKey = new Map<string, string>();
  const bookingIsSecond = new Map<string, boolean>();
  const personHasSecondBooking = new Map<string, boolean>();

  introsBooked.forEach(b => {
    const phone = (b as any).phone_e164 as string | null | undefined;
    const key = personKey(phone, b.member_name);
    bookingPersonKey.set(b.id, key);
    const hasOrig = !!((b as any).originating_booking_id) && !(b as any).referred_by_member_name;
    bookingIsSecond.set(b.id, hasOrig);
    if (hasOrig) personHasSecondBooking.set(key, true);
    const normName = b.member_name.toLowerCase().replace(/\s+/g, '');
    if (!nameToPersonKey.has(normName)) {
      nameToPersonKey.set(normName, key);
    } else if (key.startsWith('phone:')) {
      nameToPersonKey.set(normName, key);
    }
  });

  const personRunDates = new Map<string, string[]>();

  const resolveRunKey = (r: IntroRun): string => {
    if (r.linked_intro_booked_id && bookingPersonKey.has(r.linked_intro_booked_id)) {
      return bookingPersonKey.get(r.linked_intro_booked_id)!;
    }
    const normName = r.member_name.toLowerCase().replace(/\s+/g, '');
    if (nameToPersonKey.has(normName)) {
      return nameToPersonKey.get(normName)!;
    }
    return personKey(null, r.member_name);
  };

  introsRun.forEach(r => {
    const key = resolveRunKey(r);
    const existing = personRunDates.get(key) || [];
    const rd = r.run_date || r.created_at.split('T')[0];
    existing.push(rd);
    personRunDates.set(key, existing);
  });

  const activeBookings = introsBooked.filter(b => {
    const status = ((b as any).booking_status || '').toUpperCase();
    if (status.includes('DUPLICATE') || status.includes('DELETED') || status.includes('DEAD')) return false;
    if ((b as any).ignore_from_metrics) return false;
    if ((b as any).is_vip === true) return false;
    return true;
  });

  const personBookingDates = new Map<string, string[]>();
  activeBookings.forEach(b => {
    const key = bookingPersonKey.get(b.id)!;
    const existing = personBookingDates.get(key) || [];
    existing.push(b.class_date);
    personBookingDates.set(key, existing.sort());
  });

  const isFirstBooking = (b: IntroBooked): boolean => {
    if ((b as any).originating_booking_id && !(b as any).referred_by_member_name) return false;
    const key = bookingPersonKey.get(b.id)!;
    const dates = personBookingDates.get(key) || [];
    return dates[0] === b.class_date;
  };

  const firstBookings = activeBookings.filter(b =>
    isFirstBooking(b) && isInRange(b.class_date, dateRange || null)
  );
  const secondBookings = activeBookings.filter(b =>
    !isFirstBooking(b) && isInRange(b.class_date, dateRange || null)
  );

  const firstBP: DrillPerson[] = firstBookings.map(b => ({ name: b.member_name, date: b.class_date, detail: b.lead_source }));
  const secondBP: DrillPerson[] = secondBookings.map(b => ({ name: b.member_name, date: b.class_date }));

  let firstShowed = 0;
  const firstSP: DrillPerson[] = [];
  firstBookings.forEach(b => {
    const runs = introsRun.filter(r => r.linked_intro_booked_id === b.id);
    const showedRun = runs.find(r => r.result !== 'No-show' && isRunInRange(r, dateRange || null));
    if (showedRun) {
      firstShowed++;
      firstSP.push({ name: b.member_name, date: b.class_date, detail: showedRun.result || undefined });
    }
  });

  let secondShowed = 0;
  const secondSP: DrillPerson[] = [];
  secondBookings.forEach(b => {
    const runs = introsRun.filter(r => r.linked_intro_booked_id === b.id);
    const showedRun = runs.find(r => r.result !== 'No-show' && isRunInRange(r, dateRange || null));
    if (showedRun) {
      secondShowed++;
      secondSP.push({ name: b.member_name, date: b.class_date, detail: showedRun.result || undefined });
    }
  });

  const activeBookingIds = new Set(activeBookings.map(b => b.id));

  let firstSold = 0;
  let secondSold = 0;
  const firstSoldP: DrillPerson[] = [];
  const secondSoldP: DrillPerson[] = [];

  introsRun.forEach(r => {
    if (!isSaleInRange(r, dateRange || null)) return;
    if (r.linked_intro_booked_id && !activeBookingIds.has(r.linked_intro_booked_id)) return;

    const key = resolveRunKey(r);
    const buyDate = r.buy_date || r.run_date || r.created_at.split('T')[0];
    const allRunDates = (personRunDates.get(key) || []).sort();
    const runsBeforePurchase = allRunDates.filter(rd => rd <= buyDate).length;
    const isSecond = runsBeforePurchase >= 2 || personHasSecondBooking.get(key) === true;

    if (isSecond) {
      secondSold++;
      secondSoldP.push({ name: r.member_name, date: buyDate, detail: r.result || undefined });
    } else {
      firstSold++;
      firstSoldP.push({ name: r.member_name, date: buyDate, detail: r.result || undefined });
    }
  });

  // Pull forward: if sales exist from intros that ran outside the date range,
  // ensure showed count is at least equal to sold count
  const effectiveFirstShowed = Math.max(firstShowed, firstSold);
  const effectiveSecondShowed = Math.max(secondShowed, secondSold);

  return {
    first: { booked: firstBookings.length, showed: effectiveFirstShowed, sold: firstSold, bookedPeople: firstBP, showedPeople: firstSP, soldPeople: firstSoldP },
    second: { booked: secondBookings.length, showed: effectiveSecondShowed, sold: secondSold, bookedPeople: secondBP, showedPeople: secondSP, soldPeople: secondSoldP },
  };
}

interface FunnelRowProps {
  label: string;
  data: { booked: number; showed: number; sold: number };
  highlight?: boolean;
  journey?: boolean;
  bookedLabel?: string;
  showedLabel?: string;
  soldLabel?: string;
  onBoxClick?: (category: 'booked' | 'showed' | 'sold') => void;
}

function FunnelRow({ label, data, highlight, journey, bookedLabel, showedLabel, soldLabel, onBoxClick }: FunnelRowProps) {
  const showRate = data.booked > 0 ? (data.showed / data.booked) * 100 : 0;
  const closeRate = data.showed > 0 ? (data.sold / data.showed) * 100 : 0;
  const bookingToSale = data.booked > 0 ? (data.sold / data.booked) * 100 : 0;

  const rateColor = (rate: number) =>
    rate >= 75 ? 'text-success' : rate >= 50 ? 'text-warning' : 'text-destructive';

  const clickable = !!onBoxClick;

  return (
    <div className={cn(
      'rounded-lg border p-3 space-y-2',
      highlight && 'bg-primary/5 border-primary/30',
      journey && 'bg-accent/10 border-accent ring-1 ring-accent/30',
    )}>
      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-semibold uppercase tracking-wide', journey ? 'text-accent-foreground' : 'text-muted-foreground')}>{label}</span>
        <span className={cn('text-[11px] font-medium', rateColor(bookingToSale))}>
          {bookingToSale.toFixed(0)}% book→sale
        </span>
      </div>
      <div className="flex items-center gap-1">
        <div
          className={cn('flex-1 text-center p-2 rounded bg-info/10 border border-info/20', clickable && 'cursor-pointer hover:ring-1 hover:ring-info/40 active:scale-95 transition-all')}
          onClick={() => onBoxClick?.('booked')}
        >
          <Users className="w-3.5 h-3.5 mx-auto mb-0.5 text-info" />
          <p className="text-lg font-bold text-info">{data.booked}</p>
          <p className="text-[10px] text-muted-foreground">{bookedLabel || 'Booked'}</p>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <ArrowDown className="w-3 h-3 text-muted-foreground" />
          <span className={cn('text-[10px] font-medium', rateColor(showRate))}>{showRate.toFixed(0)}%</span>
        </div>
        <div
          className={cn('flex-1 text-center p-2 rounded bg-warning/10 border border-warning/20', clickable && 'cursor-pointer hover:ring-1 hover:ring-warning/40 active:scale-95 transition-all')}
          onClick={() => onBoxClick?.('showed')}
        >
          <UserCheck className="w-3.5 h-3.5 mx-auto mb-0.5 text-warning" />
          <p className="text-lg font-bold text-warning">{data.showed}</p>
          <p className="text-[10px] text-muted-foreground">{showedLabel || 'Showed'}</p>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <ArrowDown className="w-3 h-3 text-muted-foreground" />
          <span className={cn('text-[10px] font-medium', rateColor(closeRate))}>{closeRate.toFixed(0)}%</span>
        </div>
        <div
          className={cn('flex-1 text-center p-2 rounded bg-success/10 border border-success/20', clickable && 'cursor-pointer hover:ring-1 hover:ring-success/40 active:scale-95 transition-all')}
          onClick={() => onBoxClick?.('sold')}
        >
          <Target className="w-3.5 h-3.5 mx-auto mb-0.5 text-success" />
          <p className="text-lg font-bold text-success">{data.sold}</p>
          <p className="text-[10px] text-muted-foreground leading-tight">{soldLabel || 'Sold'}</p>
        </div>
      </div>
    </div>
  );
}

export function ConversionFunnel({ dateRange, className }: ConversionFunnelProps) {
  const { introsBooked, introsRun } = useData();
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillTitle, setDrillTitle] = useState('');
  const [drillPeople, setDrillPeople] = useState<DrillPerson[]>([]);

  const { first, second, total } = useMemo(() => {
    const { first, second } = computeFunnelBothRows(introsBooked, introsRun, dateRange);
    const total: FunnelData = {
      booked: first.booked + second.booked,
      showed: first.showed + second.showed,
      sold: first.sold + second.sold,
      bookedPeople: [...first.bookedPeople, ...second.bookedPeople],
      showedPeople: [...first.showedPeople, ...second.showedPeople],
      soldPeople: [...first.soldPeople, ...second.soldPeople],
    };
    return { first, second, total };
  }, [introsBooked, introsRun, dateRange]);

  const journey: FunnelData = {
    booked: first.booked,
    showed: first.showed,
    sold: total.sold,
    bookedPeople: first.bookedPeople,
    showedPeople: first.showedPeople,
    soldPeople: total.soldPeople,
  };

  const openDrill = (label: string, category: 'booked' | 'showed' | 'sold', funnelData: FunnelData) => {
    const catLabel = { booked: 'Booked', showed: 'Showed', sold: 'Sold' };
    setDrillTitle(`${label} — ${catLabel[category]}`);
    setDrillPeople(category === 'booked' ? funnelData.bookedPeople : category === 'showed' ? funnelData.showedPeople : funnelData.soldPeople);
    setDrillOpen(true);
  };

  return (
    <>
      <Card className={cn(className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            Conversion Funnel
          </CardTitle>
          <p className="text-xs text-muted-foreground">1st and 2nd intro attribution — separate rows · Tap a number to see people</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <FunnelRow label="1st Intro" data={first} onBoxClick={(cat) => openDrill('1st Intro', cat, first)} />
          <FunnelRow label="2nd Intro" data={second} onBoxClick={(cat) => openDrill('2nd Intro', cat, second)} />

          <div className="border-t pt-2">
            <FunnelRow label="Total (All Intros)" data={total} highlight onBoxClick={(cat) => openDrill('Total', cat, total)} />
          </div>

          <div className="border-t-2 border-dashed border-accent/40 pt-3">
            <FunnelRow
              label="Total Journey (1st Intro → Any Sale)"
              data={{ booked: first.booked, showed: first.showed, sold: total.sold }}
              journey
              bookedLabel="1st Booked"
              showedLabel="1st Showed"
              soldLabel="Total Sold (1st + 2nd intros)"
              onBoxClick={(cat) => openDrill('Total Journey', cat, journey)}
            />
          </div>

          <p className="text-[10px] text-muted-foreground/70 text-center">Excludes VIP events · Sale date anchored</p>
        </CardContent>
      </Card>

      <FunnelDrillSheet
        open={drillOpen}
        onOpenChange={setDrillOpen}
        title={drillTitle}
        people={drillPeople}
      />
    </>
  );
}
