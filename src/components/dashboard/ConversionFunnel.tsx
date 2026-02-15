import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowDown, Users, UserCheck, Target, Filter, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useData, IntroBooked, IntroRun } from '@/context/DataContext';
import { DateRange } from '@/lib/pay-period';
import { isMembershipSale } from '@/lib/sales-detection';
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

type IntroFilter = 'all' | '1st' | '2nd';

function isInRange(dateStr: string | null | undefined, range: DateRange | null): boolean {
  if (!range || !dateStr) return !range;
  try {
    return isWithinInterval(parseLocalDate(dateStr), { start: range.start, end: range.end });
  } catch { return false; }
}

export function ConversionFunnel({ dateRange, className }: ConversionFunnelProps) {
  const { introsBooked, introsRun } = useData();
  const [introFilter, setIntroFilter] = useState<IntroFilter>('all');

  // Determine 1st vs 2nd intro by checking if member has prior bookings
  const { funnelData, comparisonData } = useMemo(() => {
    // Build member history: map member_name (lowered) to sorted booking dates
    const memberBookings = new Map<string, string[]>();
    introsBooked.forEach(b => {
      const key = b.member_name.toLowerCase();
      const existing = memberBookings.get(key) || [];
      existing.push(b.class_date);
      memberBookings.set(key, existing);
    });
    // Sort each member's bookings
    memberBookings.forEach((dates, key) => {
      memberBookings.set(key, dates.sort());
    });

    const isFirstIntro = (b: IntroBooked): boolean => {
      const key = b.member_name.toLowerCase();
      const allDates = memberBookings.get(key) || [];
      return allDates.indexOf(b.class_date) === 0;
    };

    const computeFunnel = (filter: IntroFilter) => {
      const activeBookings = introsBooked.filter(b => {
        const status = ((b as any).booking_status || '').toUpperCase();
        if (status.includes('DUPLICATE') || status.includes('DELETED') || status.includes('DEAD')) return false;
        if ((b as any).ignore_from_metrics) return false;
        if ((b as any).is_vip === true) return false; // Exclude VIP events
        if (!isInRange(b.class_date, dateRange || null)) return false;
        
        if (filter === '1st') return isFirstIntro(b);
        if (filter === '2nd') return !isFirstIntro(b);
        return true;
      });

      let booked = activeBookings.length;
      let showed = 0;
      let sold = 0;

      activeBookings.forEach(b => {
        const runs = introsRun.filter(r => r.linked_intro_booked_id === b.id && r.result !== 'No-show');
        if (runs.length > 0) {
          showed++;
          if (runs.some(r => isMembershipSale(r.result))) sold++;
        }
      });

      return { booked, showed, sold };
    };

    const current = computeFunnel(introFilter);
    
    // Compute comparison (the other type)
    let comparison = null;
    if (introFilter === '1st') {
      const other = computeFunnel('2nd');
      comparison = { label: '2nd Intro', closeRate: other.showed > 0 ? (other.sold / other.showed) * 100 : 0 };
    } else if (introFilter === '2nd') {
      const other = computeFunnel('1st');
      comparison = { label: '1st Intro', closeRate: other.showed > 0 ? (other.sold / other.showed) * 100 : 0 };
    }

    return { funnelData: current, comparisonData: comparison };
  }, [introsBooked, introsRun, dateRange, introFilter]);

  const showRate = funnelData.booked > 0 ? (funnelData.showed / funnelData.booked) * 100 : 0;
  const closeRate = funnelData.showed > 0 ? (funnelData.sold / funnelData.showed) * 100 : 0;
  const bookingToSaleRate = funnelData.booked > 0 ? (funnelData.sold / funnelData.booked) * 100 : 0;

  const stages = [
    { label: 'Booked', value: funnelData.booked, icon: Users, color: 'bg-info/20 text-info border-info/30', rate: null as number | null, rateLabel: '' },
    { label: 'Showed', value: funnelData.showed, icon: UserCheck, color: 'bg-warning/20 text-warning border-warning/30', rate: showRate, rateLabel: 'Show Rate' },
    { label: 'Sold', value: funnelData.sold, icon: Target, color: 'bg-success/20 text-success border-success/30', rate: closeRate, rateLabel: 'Close Rate (showed)' },
  ];

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            Conversion Funnel
          </CardTitle>
        </div>
        {/* Toggle pills */}
        <div className="flex gap-1 mt-2">
          {(['all', '1st', '2nd'] as const).map(f => (
            <Button
              key={f}
              variant={introFilter === f ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-7 px-3"
              onClick={() => setIntroFilter(f)}
            >
              {f === 'all' ? 'All Intros' : f === '1st' ? '1st Intro' : '2nd Intro'}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex flex-col items-center gap-1">
          {stages.map((stage, index) => (
            <div key={stage.label} className="w-full">
              <div
                className={cn('relative flex items-center justify-between p-3 rounded-lg border transition-all', stage.color)}
                style={{ width: `${100 - index * 10}%`, marginLeft: 'auto', marginRight: 'auto' }}
              >
                <div className="flex items-center gap-2">
                  <stage.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{stage.label}</span>
                </div>
                <span className="text-lg font-bold">{stage.value}</span>
              </div>
              {index < stages.length - 1 && (
                <div className="flex items-center justify-center my-1">
                  <ArrowDown className="w-4 h-4 text-muted-foreground" />
                  {stages[index + 1].rate !== null && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={cn(
                            'ml-2 text-xs font-medium cursor-help',
                            (stages[index + 1].rate ?? 0) >= 75 ? 'text-success' :
                            (stages[index + 1].rate ?? 0) >= 50 ? 'text-warning' : 'text-destructive'
                          )}>
                            {(stages[index + 1].rate ?? 0).toFixed(0)}% {stages[index + 1].rateLabel}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px]">
                          {stages[index + 1].rateLabel === 'Show Rate' ? (
                            <p>Showed ÷ Booked. Measures booking-to-attendance conversion.</p>
                          ) : (
                            <p>Sales ÷ intros who showed up. Measures selling effectiveness. Same as Scoreboard close rate.</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="mt-4 pt-3 border-t space-y-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center items-center gap-1 text-xs text-muted-foreground cursor-help">
                  <span>Booking-to-Sale Rate: <span className="font-medium text-foreground">{bookingToSaleRate.toFixed(0)}%</span></span>
                  <Info className="w-3 h-3 opacity-60" />
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-[240px]">
                <p>Sales ÷ total booked intros (including no-shows). Measures full pipeline efficiency from booking to purchase.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <p className="text-[10px] text-muted-foreground/70 text-center">Excludes VIP events</p>
        </div>

        {/* Comparison card */}
        {comparisonData && (
          <div className="mt-3 p-3 rounded-lg border bg-muted/30 text-xs">
            <span className="font-medium">Close rate: {closeRate.toFixed(0)}%</span>
            <span className="text-muted-foreground"> (vs {comparisonData.closeRate.toFixed(0)}% for {comparisonData.label})</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
