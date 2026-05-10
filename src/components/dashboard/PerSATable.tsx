import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { isSaleInRange, isMembershipSale } from '@/lib/sales-detection';
import { isCloseResult, labelForRun } from '@/lib/intros/resultLabels';
import { didIntroActuallyRun } from '@/lib/canon/introRules';
import { isBookingExcludedFromMetrics } from '@/lib/intros/excludedBookings';
import { PersonListDrillDown, DrillNumber, PersonRow } from './PersonListDrillDown';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import type { DateRange } from '@/lib/pay-period';

export interface PerSAMetrics {
  saName: string;
  introsBooked: number; // effective ran (pull-forward)
  sales: number;
  closingRate: number;
  commission?: number;
}

interface PerSATableProps {
  data: PerSAMetrics[];
  dateRange?: DateRange | null;
}

type SortColumn = 'saName' | 'introsBooked' | 'sales' | 'closingRate';
type SortDirection = 'asc' | 'desc';

export function PerSATable({ data, dateRange }: PerSATableProps) {
  const { introsBooked, introsRun } = useData();
  const [sortColumn, setSortColumn] = useState<SortColumn>('sales');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [drill, setDrill] = useState<{ sa: string; metric: 'ran' | 'sales' } | null>(null);

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

  // Build people lists for the active drill
  const drillRows: PersonRow[] = useMemo(() => {
    if (!drill) return [];
    const sa = drill.sa;
    const inRange = (dateStr?: string | null) => {
      if (!dateRange || !dateStr) return true;
      try { const d = parseLocalDate(dateStr); return d >= dateRange.start && d <= dateRange.end; } catch { return false; }
    };
    // First-intro bookings owned by this SA
    const firstByOwner = (introsBooked || []).filter((b: any) => {
      if (isBookingExcludedFromMetrics(b)) return false;
      if ((b as any).originating_booking_id && !(b as any).referred_by_member_name) return false;
      const owner = (b as any).intro_owner || (b as any).booked_by || b.sa_working_shift;
      return owner === sa;
    });

    // Map booking → its runs
    const runsByBooking = new Map<string, any[]>();
    (introsRun || []).forEach((r: any) => {
      if (!r.linked_intro_booked_id) return;
      const arr = runsByBooking.get(r.linked_intro_booked_id) || [];
      arr.push(r); runsByBooking.set(r.linked_intro_booked_id, arr);
    });
    // 2nd-intro children: originating → child id
    const childrenByOrigin = new Map<string, string[]>();
    (introsBooked || []).forEach((b: any) => {
      const o = (b as any).originating_booking_id;
      if (o) { const arr = childrenByOrigin.get(o) || []; arr.push(b.id); childrenByOrigin.set(o, arr); }
    });

    const rows: PersonRow[] = [];
    firstByOwner.forEach((b: any) => {
      const runs = runsByBooking.get(b.id) || [];
      const ranInRange = runs.some(r => {
        if (!didIntroActuallyRun(r)) return false;
        const rd = r.run_date || b.class_date;
        return inRange(rd);
      });
      const directSale = runs.find(r => isCloseResult(r) && (isSaleInRange(r, dateRange ?? null) || inRange(r.run_date)));
      // Use canonical chain walker for 2nd-intro sale lookup.
      const chain = walkJourneyChain(b.id, introsBooked as any[], introsRun as any[]);
      const journeySale = !directSale
        ? chain.runs.find(r =>
            r.linked_intro_booked_id !== b.id &&
            isCloseResult(r) &&
            (isSaleInRange(r as any, dateRange ?? null) || inRange((r as any).run_date)),
          )
        : undefined;
      const sale = directSale || journeySale;
      const include = drill.metric === 'sales' ? !!sale : (ranInRange || !!sale);
      if (!include) return;
      const lastRun = runs[runs.length - 1];
      const label = sale ? 'SALE' : labelForRun(lastRun);
      rows.push({
        id: b.id,
        name: b.member_name || 'Unknown',
        subtitle: `${b.class_date ? format(parseLocalDate(b.class_date), 'MMM d') : '—'}${b.lead_source ? ' · ' + b.lead_source : ''}${journeySale && !directSale ? ' · via 2nd intro' : ''}`,
        rightLabel: label,
        rightTone: sale ? 'success' : label === 'No Show' ? 'muted' : label === 'Follow-Up' ? 'warning' : 'primary',
      });
    });
    return rows.sort((a, b) => (a.subtitle || '').localeCompare(b.subtitle || ''));
  }, [drill, introsBooked, introsRun, dateRange]);

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
          <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Per-SA Performance</CardTitle>
        </CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">No intro data for this period.</p></CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Per-SA Performance</CardTitle>
          <p className="text-xs text-muted-foreground">Total Journey · 1st ran → any sale · tap any number</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <SortableHeader column="saName" className="text-left">SA</SortableHeader>
                <SortableHeader column="introsBooked">Ran</SortableHeader>
                <SortableHeader column="sales">Sales</SortableHeader>
                <SortableHeader column="closingRate">Close%</SortableHeader>
              </TableRow></TableHeader>
              <TableBody>
                {sortedData.map(row => (
                  <TableRow key={row.saName}>
                    <TableCell className="font-medium text-sm whitespace-nowrap">{row.saName}</TableCell>
                    <TableCell className="text-center p-0">
                      <DrillNumber value={row.introsBooked} onClick={() => setDrill({ sa: row.saName, metric: 'ran' })} ariaLabel={`View ${row.introsBooked} ran intros for ${row.saName}`} />
                    </TableCell>
                    <TableCell className="text-center p-0">
                      <DrillNumber value={row.sales} onClick={() => setDrill({ sa: row.saName, metric: 'sales' })} ariaLabel={`View ${row.sales} sales for ${row.saName}`} tone="success" />
                    </TableCell>
                    <TableCell className="text-center p-0">
                      <DrillNumber
                        value={`${row.closingRate.toFixed(0)}%`}
                        onClick={() => setDrill({ sa: row.saName, metric: 'sales' })}
                        ariaLabel={`View sales for ${row.saName}`}
                        tone={row.closingRate >= 50 ? 'success' : row.closingRate >= 30 ? 'warning' : 'destructive'}
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
        title={drill ? `${drill.sa} · ${drill.metric === 'ran' ? 'Ran intros' : 'Sales (Total Journey)'}` : ''}
        scopeBadge="Studio tab"
        rows={drillRows}
        emptyText="No intros in this bucket."
      />
    </>
  );
}
