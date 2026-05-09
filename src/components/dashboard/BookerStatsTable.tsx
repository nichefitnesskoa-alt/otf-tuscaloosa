import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarPlus, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { PersonListDrillDown, DrillNumber, PersonRow } from './PersonListDrillDown';
import { isBookingExcludedFromMetrics } from '@/lib/intros/excludedBookings';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import type { DateRange } from '@/lib/pay-period';

export interface BookerMetrics {
  saName: string;
  introsBooked: number;
  introsShowed: number;
  showRate: number;
  pipelineValue: number;
}

interface BookerStatsTableProps {
  data: BookerMetrics[];
  dateRange?: DateRange | null;
}

type SortColumn = 'saName' | 'introsBooked' | 'introsShowed' | 'showRate';
type SortDirection = 'asc' | 'desc';

export function BookerStatsTable({ data, dateRange }: BookerStatsTableProps) {
  const { introsBooked } = useData();
  const [sortColumn, setSortColumn] = useState<SortColumn>('introsBooked');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [drill, setDrill] = useState<{ sa: string; metric: 'booked' | 'showed' } | null>(null);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(column); setSortDirection('desc'); }
  };

  const sortedData = [...data].sort((a, b) => {
    const aV = a[sortColumn], bV = b[sortColumn];
    if (typeof aV === 'string' && typeof bV === 'string') {
      return sortDirection === 'asc' ? aV.localeCompare(bV) : bV.localeCompare(aV);
    }
    return sortDirection === 'asc' ? (aV as number) - (bV as number) : (bV as number) - (aV as number);
  });

  const drillRows: PersonRow[] = useMemo(() => {
    if (!drill) return [];
    const inRange = (dateStr?: string | null) => {
      if (!dateRange || !dateStr) return true;
      try { const d = parseLocalDate(dateStr); return d >= dateRange.start && d <= dateRange.end; } catch { return false; }
    };
    return (introsBooked || [])
      .filter((b: any) => {
        if (isBookingExcludedFromMetrics(b)) return false;
        if (b.originating_booking_id && !b.referred_by_member_name) return false;
        if (((b as any).booked_by || b.sa_working_shift) !== drill.sa) return false;
        if (!inRange(b.class_date)) return false;
        if (drill.metric === 'showed') return (b.booking_status_canon || '').toUpperCase() === 'SHOWED';
        return true;
      })
      .map((b: any) => ({
        id: b.id,
        name: b.member_name || 'Unknown',
        subtitle: `${b.class_date ? format(parseLocalDate(b.class_date), 'MMM d') : '—'}${b.lead_source ? ' · ' + b.lead_source : ''}`,
        rightLabel: (b.booking_status_canon || 'BOOKED').replace('_', ' '),
        rightTone: (b.booking_status_canon === 'SHOWED' ? 'success' : b.booking_status_canon === 'NO_SHOW' ? 'destructive' : 'muted') as PersonRow['rightTone'],
      }))
      .sort((a, b) => (a.subtitle || '').localeCompare(b.subtitle || ''));
  }, [drill, introsBooked, dateRange]);

  const SortIcon = ({ column }: { column: SortColumn }) =>
    sortColumn !== column ? <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" /> :
    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  const SortableHeader = ({ column, children, className }: { column: SortColumn; children: React.ReactNode; className?: string }) => (
    <TableHead className={cn("text-xs whitespace-nowrap cursor-pointer hover:bg-muted/50 select-none", className)} onClick={() => handleSort(column)}>
      <div className="flex items-center justify-center">{children}<SortIcon column={column} /></div>
    </TableHead>
  );

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><CalendarPlus className="w-4 h-4 text-primary" />Booker Stats</CardTitle>
        </CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">No booking data for this period.</p></CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><CalendarPlus className="w-4 h-4 text-primary" />Booker Stats</CardTitle>
          <p className="text-xs text-muted-foreground">Credit for getting intros in the door · tap any number</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <SortableHeader column="saName" className="text-left">SA</SortableHeader>
                <SortableHeader column="introsBooked">Booked</SortableHeader>
                <SortableHeader column="introsShowed">Showed</SortableHeader>
                <SortableHeader column="showRate">Show %</SortableHeader>
              </TableRow></TableHeader>
              <TableBody>
                {sortedData.map(row => (
                  <TableRow key={row.saName}>
                    <TableCell className="font-medium text-sm whitespace-nowrap">{row.saName}</TableCell>
                    <TableCell className="text-center p-0">
                      <DrillNumber value={row.introsBooked} onClick={() => setDrill({ sa: row.saName, metric: 'booked' })} ariaLabel={`View ${row.introsBooked} booked by ${row.saName}`} />
                    </TableCell>
                    <TableCell className="text-center p-0">
                      <DrillNumber value={row.introsShowed} onClick={() => setDrill({ sa: row.saName, metric: 'showed' })} ariaLabel={`View ${row.introsShowed} showed for ${row.saName}`} tone="success" />
                    </TableCell>
                    <TableCell className="text-center p-0">
                      <DrillNumber
                        value={`${row.showRate.toFixed(0)}%`}
                        onClick={() => setDrill({ sa: row.saName, metric: 'showed' })}
                        ariaLabel={`View show rate for ${row.saName}`}
                        tone={row.showRate >= 70 ? 'success' : row.showRate >= 50 ? 'warning' : 'destructive'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <PersonListDrillDown
        open={!!drill}
        onOpenChange={(o) => { if (!o) setDrill(null); }}
        title={drill ? `${drill.sa} · ${drill.metric === 'booked' ? 'Booked intros' : 'Showed intros'}` : ''}
        scopeBadge="Studio tab"
        rows={drillRows}
        emptyText="No bookings in this bucket."
      />
    </>
  );
}
