import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users } from 'lucide-react';

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

export function PerSATable({ data }: PerSATableProps) {
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
                <TableHead className="text-xs whitespace-nowrap">SA</TableHead>
                <TableHead className="text-xs text-center whitespace-nowrap">Run</TableHead>
                <TableHead className="text-xs text-center whitespace-nowrap">Sales</TableHead>
                <TableHead className="text-xs text-center whitespace-nowrap">Close%</TableHead>
                <TableHead className="text-xs text-center whitespace-nowrap">Goal</TableHead>
                <TableHead className="text-xs text-center whitespace-nowrap">Rel.</TableHead>
                <TableHead className="text-xs text-center whitespace-nowrap">Friend</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap">Comm.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
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
                  <TableCell className="text-right text-sm font-medium text-success">${row.commission.toFixed(0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
