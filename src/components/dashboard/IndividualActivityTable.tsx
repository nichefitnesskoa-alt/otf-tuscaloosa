import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Activity, HelpCircle } from 'lucide-react';

interface IndividualActivityRow {
  saName: string;
  calls: number;
  texts: number;
  dms: number;
  emails: number;
  totalContacts: number;
  shiftsWorked: number;
  showRate: number | null;
}

interface IndividualActivityTableProps {
  data: IndividualActivityRow[];
}

function getShowRateColor(rate: number | null): string {
  if (rate === null) return '';
  if (rate >= 75) return 'text-green-600 dark:text-green-400 font-medium';
  if (rate >= 50) return 'text-yellow-600 dark:text-yellow-400 font-medium';
  return 'text-red-600 dark:text-red-400 font-medium';
}

export function IndividualActivityTable({ data }: IndividualActivityTableProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Individual Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No activity data available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Individual Activity
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Outreach activity metrics per SA. Sorted by total contacts.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">SA</TableHead>
                <TableHead className="text-xs text-center">Calls</TableHead>
                <TableHead className="text-xs text-center">Texts</TableHead>
                <TableHead className="text-xs text-center">DMs</TableHead>
                <TableHead className="text-xs text-center">Emails</TableHead>
                <TableHead className="text-xs text-center">Total</TableHead>
                <TableHead className="text-xs text-center">Shifts</TableHead>
                <TableHead className="text-xs text-center">Show %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.saName}>
                  <TableCell className="font-medium text-sm py-2">
                    {row.saName}
                  </TableCell>
                  <TableCell className="text-center text-sm py-2">
                    {row.calls}
                  </TableCell>
                  <TableCell className="text-center text-sm py-2">
                    {row.texts}
                  </TableCell>
                  <TableCell className="text-center text-sm py-2">
                    {row.dms}
                  </TableCell>
                  <TableCell className="text-center text-sm py-2">
                    {row.emails}
                  </TableCell>
                  <TableCell className="text-center text-sm py-2 font-medium">
                    {row.totalContacts}
                  </TableCell>
                  <TableCell className="text-center text-sm py-2">
                    {row.shiftsWorked}
                  </TableCell>
                  <TableCell className={`text-center text-sm py-2 ${getShowRateColor(row.showRate)}`}>
                    {row.showRate !== null ? `${row.showRate.toFixed(1)}%` : '—'}
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
