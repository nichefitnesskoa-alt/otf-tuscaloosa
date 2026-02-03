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
import { DollarSign, HelpCircle } from 'lucide-react';

interface ConversionCreditRow {
  saName: string;
  introsRan: number;
  sales: number;
  closingRate: number;
  commissionEarned: number;
}

interface ConversionCreditTableProps {
  data: ConversionCreditRow[];
}

export function ConversionCreditTable({ data }: ConversionCreditTableProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Conversion Credit (Commission owner)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No conversion data available
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalCommission = data.reduce((sum, row) => sum + row.commissionEarned, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Conversion Credit (Commission owner)
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Sales execution metrics. Credited to who ran the first intro. Commission based on purchase date.</p>
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
                <TableHead className="text-xs text-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="cursor-help">Ran</TooltipTrigger>
                      <TooltipContent>
                        <p>First intros you personally ran</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="text-xs text-center">Sales</TableHead>
                <TableHead className="text-xs text-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="cursor-help">Close %</TooltipTrigger>
                      <TooltipContent>
                        <p>Sales ÷ Intros Ran (conversion performance)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="text-xs text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.saName}>
                  <TableCell className="font-medium text-sm py-2">
                    {row.saName}
                  </TableCell>
                  <TableCell className="text-center text-sm py-2">
                    {row.introsRan}
                  </TableCell>
                  <TableCell className="text-center text-sm py-2">
                    <span className={row.sales > 0 ? 'text-success font-medium' : ''}>
                      {row.sales}
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-sm py-2">
                    <span className={row.closingRate >= 50 ? 'text-success font-medium' : ''}>
                      {row.closingRate.toFixed(0)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm py-2 font-medium text-success">
                    ${row.commissionEarned.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              {/* Total row */}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell className="text-sm py-2">Total</TableCell>
                <TableCell className="text-center text-sm py-2">
                  {data.reduce((sum, r) => sum + r.introsRan, 0)}
                </TableCell>
                <TableCell className="text-center text-sm py-2 text-success">
                  {data.reduce((sum, r) => sum + r.sales, 0)}
                </TableCell>
                <TableCell className="text-center text-sm py-2">—</TableCell>
                <TableCell className="text-right text-sm py-2 text-success">
                  ${totalCommission.toFixed(2)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
