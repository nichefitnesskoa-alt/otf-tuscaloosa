import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PerSAMetrics {
  saName: string;
  introsRun: number;
  sales: number;
  closingRate: number;
  goalWhyRate: number;
  relationshipRate: number;
  madeAFriendRate: number;
  commission: number;
}

interface PerSATableProps {
  data: PerSAMetrics[];
}

type SortColumn = 'saName' | 'introsRun' | 'sales' | 'closingRate' | 'goalWhyRate' | 'relationshipRate' | 'madeAFriendRate';
type SortDirection = 'asc' | 'desc';

export function PerSATable({ data }: PerSATableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('sales');
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
            <Users className="w-4 h-4 text-primary" />
            Per-SA Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No intro data for this period.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Per-SA Performance
        </CardTitle>
        <p className="text-xs text-muted-foreground">All metrics credited to intro_owner (first intro runner)</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="saName" className="text-left">SA</SortableHeader>
                <SortableHeader column="introsRun">Run</SortableHeader>
                <SortableHeader column="sales">Sales</SortableHeader>
                <SortableHeader column="closingRate">Close%</SortableHeader>
                <SortableHeader column="goalWhyRate">Goal</SortableHeader>
                <SortableHeader column="relationshipRate">Peak</SortableHeader>
                <SortableHeader column="madeAFriendRate">Friend</SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((row) => (
                <TableRow key={row.saName}>
                  <TableCell className="font-medium text-sm whitespace-nowrap">{row.saName}</TableCell>
                  <TableCell className="text-center text-sm">{row.introsRun}</TableCell>
                  <TableCell className="text-center text-sm font-medium text-success">{row.sales}</TableCell>
                  <TableCell className="text-center text-sm">
                    <span className={row.closingRate >= 50 ? 'text-success' : row.closingRate >= 30 ? 'text-warning' : 'text-destructive'}>
                      {row.closingRate.toFixed(0)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-sm">{row.goalWhyRate.toFixed(0)}%</TableCell>
                  <TableCell className="text-center text-sm">{row.relationshipRate.toFixed(0)}%</TableCell>
                  <TableCell className="text-center text-sm">{row.madeAFriendRate.toFixed(0)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
