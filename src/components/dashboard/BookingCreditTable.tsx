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
import { Calendar, HelpCircle } from 'lucide-react';

interface BookingCreditRow {
  saName: string;
  introsBooked: number;
  introsShowed: number;
  showRate: number;
  leadMeasureRate: number;
  qualityGoalRate: number;
  pricingEngagementRate: number;
}

interface BookingCreditTableProps {
  data: BookingCreditRow[];
}

export function BookingCreditTable({ data }: BookingCreditTableProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Booking Credit (Booked by)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No booking data available
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
            <Calendar className="w-4 h-4" />
            Booking Credit (Booked by)
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Pipeline effort metrics. Credited to who booked the intro, regardless of who ran it.</p>
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
                <TableHead className="text-xs text-center">Booked</TableHead>
                <TableHead className="text-xs text-center">Showed</TableHead>
                <TableHead className="text-xs text-center">Show %</TableHead>
                <TableHead className="text-xs text-center">Lead M.</TableHead>
                <TableHead className="text-xs text-center">Goal Q.</TableHead>
                <TableHead className="text-xs text-center">Pricing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.saName}>
                  <TableCell className="font-medium text-sm py-2">
                    {row.saName}
                  </TableCell>
                  <TableCell className="text-center text-sm py-2">
                    {row.introsBooked}
                  </TableCell>
                  <TableCell className="text-center text-sm py-2">
                    {row.introsShowed}
                  </TableCell>
                  <TableCell className="text-center text-sm py-2">
                    <span className={row.showRate >= 70 ? 'text-success font-medium' : ''}>
                      {row.showRate.toFixed(0)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-sm py-2">
                    {row.leadMeasureRate.toFixed(0)}%
                  </TableCell>
                  <TableCell className="text-center text-sm py-2">
                    {row.qualityGoalRate.toFixed(0)}%
                  </TableCell>
                  <TableCell className="text-center text-sm py-2">
                    {row.pricingEngagementRate.toFixed(0)}%
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
