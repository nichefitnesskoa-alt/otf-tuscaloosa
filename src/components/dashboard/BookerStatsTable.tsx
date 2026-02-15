import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarPlus, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BookerMetrics {
  saName: string;
  introsBooked: number;
  introsShowed: number;
  showRate: number;
  pipelineValue: number; // kept for interface compat but not displayed
}

interface BookerStatsTableProps {
  data: BookerMetrics[];
}

type SortColumn = 'saName' | 'introsBooked' | 'introsShowed' | 'showRate';
type SortDirection = 'asc' | 'desc';

export function BookerStatsTable({ data }: BookerStatsTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('introsBooked');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    return sortDirection === 'asc' 
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number);
  });

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1" />
      : <ArrowDown className="w-3 h-3 ml-1" />;
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

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarPlus className="w-4 h-4 text-primary" />
            Booker Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No booking data for this period.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarPlus className="w-4 h-4 text-primary" />
          Booker Stats
        </CardTitle>
        <p className="text-xs text-muted-foreground">Credit for getting intros in the door (booked_by)</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="saName" className="text-left">SA</SortableHeader>
                <SortableHeader column="introsBooked">Booked</SortableHeader>
                <SortableHeader column="introsShowed">Showed</SortableHeader>
                <SortableHeader column="showRate">Show %</SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((row) => (
                <TableRow key={row.saName}>
                  <TableCell className="font-medium text-sm whitespace-nowrap">{row.saName}</TableCell>
                  <TableCell className="text-center text-sm">{row.introsBooked}</TableCell>
                  <TableCell className="text-center text-sm">{row.introsShowed}</TableCell>
                  <TableCell className="text-center text-sm">
                    <span className={cn(
                      row.showRate >= 70 ? 'text-success' : 
                      row.showRate >= 50 ? 'text-warning' : 'text-destructive'
                    )}>
                      {row.showRate.toFixed(0)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
