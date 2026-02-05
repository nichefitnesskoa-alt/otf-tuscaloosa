import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BookerMetrics {
  saName: string;
  introsBooked: number;
  introsShowed: number;
  showRate: number;
  pipelineValue: number; // potential commission if all converted
}

interface BookerStatsTableProps {
  data: BookerMetrics[];
}

export function BookerStatsTable({ data }: BookerStatsTableProps) {
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
                <TableHead className="text-xs whitespace-nowrap">SA</TableHead>
                <TableHead className="text-xs text-center whitespace-nowrap">Booked</TableHead>
                <TableHead className="text-xs text-center whitespace-nowrap">Showed</TableHead>
                <TableHead className="text-xs text-center whitespace-nowrap">Show %</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap">Pipeline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.saName}>
                  <TableCell className="font-medium text-sm whitespace-nowrap">{row.saName}</TableCell>
                  <TableCell className="text-center text-sm">{row.introsBooked}</TableCell>
                  <TableCell className="text-center text-sm">{row.introsShowed}</TableCell>
                  <TableCell className="text-center text-sm">
                    <span className={cn(
                      row.showRate >= 75 ? 'text-success' : 
                      row.showRate >= 50 ? 'text-warning' : 'text-destructive'
                    )}>
                      {row.showRate.toFixed(0)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    ~${row.pipelineValue.toFixed(0)}
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
