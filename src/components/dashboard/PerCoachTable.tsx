import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { supabase } from '@/integrations/supabase/client';
import { DateRange } from '@/lib/pay-period';
import { isWithinInterval, format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { isMembershipSale } from '@/lib/sales-detection';
import { CoachAttributionDrillDown, type CoachAttribution, type AttribIntro } from './CoachAttributionDrillDown';

interface PerCoachTableProps {
  dateRange?: DateRange | null;
}

interface CoachRow {
  coachName: string;
  introsCoached: number;
  closes: number;
  closeRate: number;
}

type SortColumn = 'coachName' | 'introsCoached' | 'closes' | 'closeRate';
type SortDirection = 'asc' | 'desc';

function labelFor(r: any): string {
  const rc = (r?.result_canon || '').toUpperCase();
  if (rc === 'SALE' || isMembershipSale(r?.result)) return 'SALE';
  if (rc === 'NO_SHOW') return 'No Show';
  if (rc === 'PLANNING_2ND' || rc === 'PLANNING_2ND_INTRO') return 'Planning 2nd';
  if (rc === 'VIP_CLASS_INTRO') return 'VIP Intro';
  if (rc === 'UNRESOLVED') return 'Unresolved';
  if (rc === 'FOLLOW_UP') return 'Follow-Up';
  return '—';
}

export function PerCoachTable({ dateRange }: PerCoachTableProps) {
  const { introsRun, introsBooked } = useData();
  const [sortColumn, setSortColumn] = useState<SortColumn>('introsCoached');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [vipCoachByVipSession, setVipCoachByVipSession] = useState<Map<string, string>>(new Map());
  const [drill, setDrill] = useState<{ coach: string; metric: 'coached' | 'closes' } | null>(null);

  // Pre-fetch vip_sessions.coach_name for VIP Class attribution
  useEffect(() => {
    const vipIds = Array.from(new Set(
      (introsBooked as any[])
        .filter(b => (b.lead_source || '').startsWith('VIP Class') && b.vip_session_id)
        .map(b => b.vip_session_id as string)
    ));
    if (vipIds.length === 0) { setVipCoachByVipSession(new Map()); return; }
    (async () => {
      const { data } = await (supabase as any)
        .from('vip_sessions')
        .select('id, coach_name')
        .in('id', vipIds);
      const m = new Map<string, string>();
      for (const v of (data || [])) {
        if (v.coach_name) m.set(v.id, v.coach_name);
      }
      setVipCoachByVipSession(m);
    })();
  }, [introsBooked]);

  const { rows, attribution } = useMemo(() => {
    const originatingMap = new Map<string, boolean>();
    const bookingById = new Map<string, any>();
    introsBooked.forEach((b: any) => {
      originatingMap.set(b.id, !!b.originating_booking_id);
      bookingById.set(b.id, b);
    });

    const resolveCoach = (b: any, fallback: string | null): string | null => {
      if (b && (b.lead_source || '').startsWith('VIP Class') && b.vip_session_id) {
        const vc = vipCoachByVipSession.get(b.vip_session_id);
        if (vc) return vc;
      }
      return fallback;
    };

    // First intros only
    const firstIntroRuns = introsRun.filter(r => {
      if (!r.linked_intro_booked_id) return true;
      return !originatingMap.get(r.linked_intro_booked_id);
    });

    const filtered = firstIntroRuns.filter(r => {
      const rd = (r as any).run_date || (r.created_at || '').split('T')[0];
      if (!rd || !dateRange) return !dateRange;
      try {
        return isWithinInterval(parseLocalDate(rd), { start: dateRange.start, end: dateRange.end });
      } catch { return false; }
    });

    const coachMap = new Map<string, { coached: number; closes: number }>();
    const attribMap = new Map<string, CoachAttribution>();
    const ensureAttrib = (n: string) => {
      let a = attribMap.get(n);
      if (!a) { a = { coached: [], closes: [], excluded: [] }; attribMap.set(n, a); }
      return a;
    };

    filtered.forEach(r => {
      const linkedBooking = r.linked_intro_booked_id ? bookingById.get(r.linked_intro_booked_id) : null;
      const name = resolveCoach(linkedBooking, (r as any).coach_name);
      if (!name) return;

      const intro: AttribIntro = {
        bookingId: r.linked_intro_booked_id || r.id,
        member: linkedBooking?.member_name || (r as any).member_name || 'Unknown',
        classDate: linkedBooking?.class_date || (r as any).run_date || null,
        source: linkedBooking?.lead_source || null,
        resultLabel: labelFor(r),
      };

      // VIP Class Intro is excluded from Coached & Closes math
      if ((r as any).result_canon === 'VIP_CLASS_INTRO') {
        ensureAttrib(name).excluded.push(intro);
        return;
      }

      const ex = coachMap.get(name) || { coached: 0, closes: 0 };
      ex.coached++;
      const a = ensureAttrib(name);
      a.coached.push(intro);

      if ((r as any).result_canon === 'SALE' || isMembershipSale(r.result)) {
        ex.closes++;
        a.closes.push({ ...intro, via: 'direct', resultLabel: 'SALE' });
      } else if (r.linked_intro_booked_id) {
        const secondSale = introsRun.some(r2 => {
          if (r2.id === r.id) return false;
          const booking = introsBooked.find((b: any) => b.id === r2.linked_intro_booked_id);
          if (!booking) return false;
          if ((booking as any).originating_booking_id !== r.linked_intro_booked_id) return false;
          return (r2 as any).result_canon === 'SALE' || isMembershipSale(r2.result);
        });
        if (secondSale) {
          ex.closes++;
          a.closes.push({ ...intro, via: '2nd_intro', resultLabel: 'SALE' });
        }
      }
      coachMap.set(name, ex);
    });

    const rows = Array.from(coachMap.entries()).map(([name, d]) => ({
      coachName: name,
      introsCoached: d.coached,
      closes: d.closes,
      closeRate: d.coached > 0 ? (d.closes / d.coached) * 100 : 0,
    }));
    return { rows, attribution: attribMap };
  }, [introsRun, introsBooked, dateRange, vipCoachByVipSession]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedData = [...rows].sort((a, b) => {
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }
    return sortDirection === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
  });

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const SortableHeader = ({ column, children, className }: { column: SortColumn; children: React.ReactNode; className?: string }) => (
    <TableHead
      className={cn("text-xs whitespace-nowrap cursor-pointer hover:bg-muted/50 select-none", className)}
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center justify-center">
        {children}
        <SortIcon column={column} />
      </div>
    </TableHead>
  );

  const rangeLabel = dateRange
    ? `${format(dateRange.start, 'MMM d')} – ${format(dateRange.end, 'MMM d, yyyy')}`
    : 'All time';

  const drillAttribution = drill ? attribution.get(drill.coach) || null : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Per-Coach Performance
        </CardTitle>
        <p className="text-xs text-muted-foreground">Total Journey · 1st coached → any sale · tap a number to see who</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="coachName" className="text-left">Coach</SortableHeader>
                <SortableHeader column="introsCoached">Coached</SortableHeader>
                <SortableHeader column="closes">Closes</SortableHeader>
                <SortableHeader column="closeRate">Close%</SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-4">No coach data for this period.</TableCell>
                </TableRow>
              ) : (
                sortedData.map(row => (
                  <TableRow key={row.coachName}>
                    <TableCell className="font-medium text-sm whitespace-nowrap">{row.coachName}</TableCell>
                    <TableCell className="text-center text-sm p-0">
                      <button
                        type="button"
                        disabled={row.introsCoached === 0}
                        onClick={() => setDrill({ coach: row.coachName, metric: 'coached' })}
                        className="w-full min-h-[44px] px-3 cursor-pointer hover:bg-muted/40 hover:underline disabled:cursor-default disabled:hover:bg-transparent disabled:hover:no-underline"
                      >
                        {row.introsCoached}
                      </button>
                    </TableCell>
                    <TableCell className="text-center text-sm font-medium text-success p-0">
                      <button
                        type="button"
                        disabled={row.closes === 0}
                        onClick={() => setDrill({ coach: row.coachName, metric: 'closes' })}
                        className="w-full min-h-[44px] px-3 cursor-pointer hover:bg-muted/40 hover:underline disabled:cursor-default disabled:hover:bg-transparent disabled:hover:no-underline"
                      >
                        {row.closes}
                      </button>
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      <span className={row.closeRate >= 50 ? 'text-success' : row.closeRate >= 30 ? 'text-warning' : 'text-destructive'}>
                        {row.closeRate.toFixed(0)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <CoachAttributionDrillDown
        open={!!drill}
        onOpenChange={(o) => { if (!o) setDrill(null); }}
        coach={drill?.coach || null}
        metric={drill?.metric || 'coached'}
        source="studio"
        rangeLabel={rangeLabel}
        attribution={drillAttribution}
      />
    </Card>
  );
}
