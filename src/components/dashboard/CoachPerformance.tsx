import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Dumbbell, TrendingUp, Users, Target } from 'lucide-react';
import { IntroBooked, IntroRun } from '@/context/DataContext';
import { DateRange } from '@/lib/pay-period';
import { isWithinInterval, parseISO } from 'date-fns';

interface CoachStats {
  coachName: string;
  introsCoached: number;
  sales: number;
  closingRate: number;
  commission: number;
}

interface CoachPerformanceProps {
  introsBooked: IntroBooked[];
  introsRun: IntroRun[];
  dateRange: DateRange | null;
}

function isDateInRange(dateStr: string | null | undefined, range: DateRange | null): boolean {
  if (!range) return true;
  if (!dateStr) return false;
  try {
    const date = parseISO(dateStr);
    return isWithinInterval(date, { start: range.start, end: range.end });
  } catch {
    return false;
  }
}

const isMembershipSale = (result: string): boolean => {
  const lower = (result || '').toLowerCase();
  return ['premier', 'elite', 'basic'].some(m => lower.includes(m));
};

export function CoachPerformance({ introsBooked, introsRun, dateRange }: CoachPerformanceProps) {
  const coachStats = useMemo(() => {
    const EXCLUDED_STATUSES = ['Duplicate', 'Deleted (soft)', 'DEAD'];
    
    // FIX: Include self-booked clients for coach metrics - coaches still coach these clients
    // Self-booked exclusion only applies to BOOKER credit, not coach performance
    const activeBookings = introsBooked.filter(b => {
      const status = ((b as any).booking_status || '').toUpperCase();
      const isExcludedStatus = EXCLUDED_STATUSES.some(s => status.includes(s.toUpperCase()));
      const isIgnored = (b as any).ignore_from_metrics === true;
      return !isExcludedStatus && !isIgnored;
    });

    // Filter active runs
    const activeRuns = introsRun.filter(r => {
      const isIgnored = (r as any).ignore_from_metrics === true;
      return !isIgnored;
    });

    // Create a map of booking_id to runs
    const bookingToRuns = new Map<string, IntroRun[]>();
    activeRuns.forEach(run => {
      const bookingId = run.linked_intro_booked_id;
      if (bookingId) {
        const existing = bookingToRuns.get(bookingId) || [];
        existing.push(run);
        bookingToRuns.set(bookingId, existing);
      }
    });

    // Get first intro bookings only (for accurate metrics)
    const firstIntroBookings = activeBookings.filter(b => {
      const originatingId = (b as any).originating_booking_id;
      const isFirstIntro = originatingId === null || originatingId === undefined;
      const isInDateRange = isDateInRange(b.class_date, dateRange);
      return isFirstIntro && isInDateRange;
    });

    // Aggregate by coach
    const coachMap = new Map<string, { intros: number; sales: number; commission: number }>();

    firstIntroBookings.forEach(booking => {
      const coachName = booking.coach_name || 'Unknown';
      if (!coachName || coachName === 'TBD' || coachName === 'Unknown') return;

      const existing = coachMap.get(coachName) || { intros: 0, sales: 0, commission: 0 };
      
      // Get runs for this booking
      const runs = bookingToRuns.get(booking.id) || [];
      const nonNoShowRun = runs.find(r => r.result !== 'No-show');
      
      if (nonNoShowRun) {
        existing.intros++;
        
        // FIX: Check if ANY run for this booking has a membership sale result
        const saleRun = runs.find(r => isMembershipSale(r.result));
        if (saleRun) {
          existing.sales++;
          existing.commission += saleRun.commission_amount || 0;
        }
      }

      coachMap.set(coachName, existing);
    });

    // Convert to array and calculate closing rate
    const stats: CoachStats[] = Array.from(coachMap.entries())
      .map(([coachName, data]) => ({
        coachName,
        introsCoached: data.intros,
        sales: data.sales,
        closingRate: data.intros > 0 ? (data.sales / data.intros) * 100 : 0,
        commission: data.commission,
      }))
      .filter(s => s.introsCoached > 0)
      .sort((a, b) => b.closingRate - a.closingRate);

    return stats;
  }, [introsBooked, introsRun, dateRange]);

  // Calculate studio average for comparison
  const studioAverage = useMemo(() => {
    if (coachStats.length === 0) return 0;
    const totalIntros = coachStats.reduce((sum, s) => sum + s.introsCoached, 0);
    const totalSales = coachStats.reduce((sum, s) => sum + s.sales, 0);
    return totalIntros > 0 ? (totalSales / totalIntros) * 100 : 0;
  }, [coachStats]);

  if (coachStats.length === 0) {
    return null;
  }

  const getPerformanceBadge = (closingRate: number, studioAvg: number) => {
    const diff = closingRate - studioAvg;
    if (diff >= 10) return <Badge className="bg-success text-success-foreground">+{diff.toFixed(0)}%</Badge>;
    if (diff >= 0) return <Badge variant="outline" className="text-success">+{diff.toFixed(0)}%</Badge>;
    if (diff >= -10) return <Badge variant="outline" className="text-muted-foreground">{diff.toFixed(0)}%</Badge>;
    return <Badge variant="destructive">{diff.toFixed(0)}%</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Dumbbell className="w-4 h-4" />
            Coach Impact on Closing
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs">
                  Studio Avg: {studioAverage.toFixed(0)}%
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Average closing rate across all coaches</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-xs text-muted-foreground">
          How coaches influence intro conversion rates
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Coach</TableHead>
              <TableHead className="text-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1 justify-center">
                      <Users className="w-3 h-3" />
                      Intros
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Number of intros coached (client showed up)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableHead>
              <TableHead className="text-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1 justify-center">
                      <TrendingUp className="w-3 h-3" />
                      Sales
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Membership sales from coached intros</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableHead>
              <TableHead className="text-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1 justify-center">
                      <Target className="w-3 h-3" />
                      Close %
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Closing rate for intros with this coach</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableHead>
              <TableHead className="text-center">vs Avg</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coachStats.map(coach => (
              <TableRow key={coach.coachName}>
                <TableCell className="font-medium">{coach.coachName}</TableCell>
                <TableCell className="text-center">{coach.introsCoached}</TableCell>
                <TableCell className="text-center text-success font-medium">{coach.sales}</TableCell>
                <TableCell className="text-center font-medium">{coach.closingRate.toFixed(0)}%</TableCell>
                <TableCell className="text-center">
                  {getPerformanceBadge(coach.closingRate, studioAverage)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Insight:</strong> Coach performance shows correlation between the workout experience 
            and conversion. High-performing coaches create memorable experiences that help close sales.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
