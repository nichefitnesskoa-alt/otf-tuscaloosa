import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, Users, Download, Loader2, ChevronRight, CalendarDays } from 'lucide-react';
import { capitalizeName } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { parseLocalDate } from '@/lib/utils';
import { getSaleDate, isDateInRange } from '@/lib/sales-detection';
import { DateRange, formatDateRange } from '@/lib/pay-period';

// Pay period anchor: January 26, 2026 (biweekly)
const PAY_PERIOD_ANCHOR = new Date(2026, 0, 26); // January 26, 2026

function generatePayPeriods(): { label: string; start: Date; end: Date }[] {
  const periods: { label: string; start: Date; end: Date }[] = [];
  const anchor = PAY_PERIOD_ANCHOR.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const periodMs = 14 * dayMs;
  
  // Generate periods from anchor going forward and backward
  for (let i = -10; i <= 10; i++) {
    const start = new Date(anchor + (i * periodMs));
    const end = addDays(start, 13);
    periods.push({
      label: `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`,
      start,
      end,
    });
  }
  
  // Sort by date descending
  return periods.sort((a, b) => b.start.getTime() - a.start.getTime());
}

interface SaleDetail {
  memberName: string;
  amount: number;
  date: string;
  type: 'intro' | 'outside';
  membershipType?: string;
  leadSource?: string | null;
  coach?: string | null;
  bookedBy?: string | null;
}

interface PayrollEntry {
  name: string;
  total: number;
  sales: number;
  details: SaleDetail[];
}

interface ShowRateEntry {
  saName: string;
  booked: number;
  showed: number;
  showRate: number;
}

interface PayPeriodCommissionProps {
  dateRange?: DateRange | null;
}

export default function PayPeriodCommission({ dateRange: externalDateRange }: PayPeriodCommissionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [payroll, setPayroll] = useState<PayrollEntry[]>([]);
  const [showRateStats, setShowRateStats] = useState<ShowRateEntry[]>([]);
  const [totalCommission, setTotalCommission] = useState(0);
  const [showRateSort, setShowRateSort] = useState<{
    column: 'saName' | 'booked' | 'showed' | 'showRate';
    direction: 'asc' | 'desc';
  }>({ column: 'showRate', direction: 'desc' });

  const payPeriods = useMemo(() => generatePayPeriods(), []);
  
  // If external date range is provided, use it; otherwise use pay period selector
  const useExternalRange = externalDateRange !== undefined;

  // Auto-select current period on mount (only if not using external range)
  useEffect(() => {
    if (useExternalRange) return;
    
    const now = new Date();
    const current = payPeriods.find(p => now >= p.start && now <= p.end);
    if (current) {
      setSelectedPeriod(current.label);
    } else if (payPeriods.length > 0) {
      setSelectedPeriod(payPeriods[0].label);
    }
  }, [payPeriods, useExternalRange]);

  // Fetch payroll data when period or external range changes
  useEffect(() => {
    // Determine date range to use
    let startDate: string;
    let endDate: string;
    
    if (useExternalRange && externalDateRange) {
      startDate = format(externalDateRange.start, 'yyyy-MM-dd');
      endDate = format(externalDateRange.end, 'yyyy-MM-dd');
    } else if (!useExternalRange && selectedPeriod) {
      const period = payPeriods.find(p => p.label === selectedPeriod);
      if (!period) return;
      startDate = format(period.start, 'yyyy-MM-dd');
      endDate = format(period.end, 'yyyy-MM-dd');
    } else if (useExternalRange && externalDateRange === null) {
      // All time - no date filtering
      startDate = '1900-01-01';
      endDate = '2100-12-31';
    } else {
      return;
    }

    const fetchPayroll = async () => {
      setIsLoading(true);
      try {
        // Fetch intro runs with commission - fetch all, filter in JS
        const { data: runs, error: runsError } = await supabase
          .from('intros_run')
          .select('intro_owner, sa_name, commission_amount, run_date, buy_date, created_at, member_name, result, lead_source, linked_intro_booked_id')
          .gt('commission_amount', 0);

        if (runsError) throw runsError;

        // Fetch sales outside intro - fetch all with commission, filter in JS
        const { data: sales, error: salesError } = await supabase
          .from('sales_outside_intro')
          .select('intro_owner, commission_amount, date_closed, created_at, member_name, membership_type, lead_source')
          .gt('commission_amount', 0);

        if (salesError) throw salesError;
        
        // Fetch all bookings for show rate calculation and for attribution lookup
        const { data: allBookings, error: allBookingsError } = await supabase
          .from('intros_booked')
          .select('id, booked_by, sa_working_shift, class_date, lead_source, booking_status, originating_booking_id, coach_name');
          
        if (allBookingsError) throw allBookingsError;
        
        // Filter bookings for show rate (exclude Online Intro Offer and 2nd intros)
        const bookingsForShowRate = (allBookings || []).filter(b => 
          b.lead_source !== 'Online Intro Offer (self-booked)' && !b.originating_booking_id
        );
        
        // Create booking lookup for attribution (coach, booked_by)
        const bookingMap = new Map<string, { coach: string | null; bookedBy: string | null; leadSource: string | null }>(
          (allBookings || []).map(b => [b.id, {
            coach: b.coach_name,
            bookedBy: b.booked_by || b.sa_working_shift || null,
            leadSource: b.lead_source,
          }])
        );
        
        // Fetch runs for show rate (to check if bookings showed)
        const { data: allRuns, error: allRunsError } = await supabase
          .from('intros_run')
          .select('linked_intro_booked_id, result');
          
        if (allRunsError) throw allRunsError;

        // Filter runs by date range using proper date logic (buy_date || run_date)
        const filteredRuns = (runs || []).filter(run => {
          const saleDate = getSaleDate(run.buy_date, run.run_date, null, run.created_at);
          return isDateInRange(saleDate, startDate, endDate);
        });

        // Filter sales by date range using proper date logic (date_closed || created_at)
        const filteredSales = (sales || []).filter(sale => {
          const saleDate = getSaleDate(null, null, sale.date_closed, sale.created_at);
          return isDateInRange(saleDate, startDate, endDate);
        });
        
        // Filter bookings for show rate by class_date within range
        const filteredBookings = bookingsForShowRate.filter(b => 
          isDateInRange(b.class_date, startDate, endDate)
        );
        
        // Create run lookup for show rate
        const runsByBookingId = new Map<string, typeof allRuns>();
        (allRuns || []).forEach(run => {
          if (run.linked_intro_booked_id) {
            const existing = runsByBookingId.get(run.linked_intro_booked_id) || [];
            existing.push(run);
            runsByBookingId.set(run.linked_intro_booked_id, existing);
          }
        });

        // Aggregate by intro_owner
        const payrollMap: Record<string, PayrollEntry> = {};

        // Process runs - use intro_owner, fallback to sa_name
        for (const run of filteredRuns) {
          const owner = run.intro_owner || run.sa_name || 'Unassigned';
          if (!payrollMap[owner]) {
            payrollMap[owner] = { name: owner, total: 0, sales: 0, details: [] };
          }
          payrollMap[owner].total += run.commission_amount || 0;
          payrollMap[owner].sales++;
          
          // Get attribution info from linked booking
          const bookingInfo = run.linked_intro_booked_id ? bookingMap.get(run.linked_intro_booked_id) : null;
          
          payrollMap[owner].details.push({
            memberName: run.member_name,
            amount: run.commission_amount || 0,
            date: getSaleDate(run.buy_date, run.run_date, null, run.created_at),
            type: 'intro',
            membershipType: run.result,
            leadSource: run.lead_source || bookingInfo?.leadSource || null,
            coach: bookingInfo?.coach || null,
            bookedBy: bookingInfo?.bookedBy || null,
          });
        }

        // Process sales
        for (const sale of filteredSales) {
          const owner = sale.intro_owner || 'Unassigned';
          if (!payrollMap[owner]) {
            payrollMap[owner] = { name: owner, total: 0, sales: 0, details: [] };
          }
          payrollMap[owner].total += sale.commission_amount || 0;
          payrollMap[owner].sales++;
          payrollMap[owner].details.push({
            memberName: sale.member_name,
            amount: sale.commission_amount || 0,
            date: getSaleDate(null, null, sale.date_closed, sale.created_at),
            type: 'outside',
            membershipType: sale.membership_type,
            leadSource: sale.lead_source || null,
            coach: null,
            bookedBy: null,
          });
        }

        // Sort details by date within each owner
        for (const owner of Object.keys(payrollMap)) {
          payrollMap[owner].details.sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
          );
        }

        const payrollList = Object.values(payrollMap).sort((a, b) => b.total - a.total);
        setPayroll(payrollList);
        setTotalCommission(payrollList.reduce((sum, p) => sum + p.total, 0));
        
        // Calculate show rate stats by booked_by
        const EXCLUDED_NAMES = ['TBD', 'Unknown', '', 'N/A', 'Self Booked', 'Self-Booked', 'self booked', 'Self-booked', 'Run-first entry'];
        const bookerMap = new Map<string, { booked: number; showed: number }>();
        
        filteredBookings.forEach(b => {
          const bookedBy = b.booked_by;
          if (!bookedBy || EXCLUDED_NAMES.includes(bookedBy)) return;
          
          const existing = bookerMap.get(bookedBy) || { booked: 0, showed: 0 };
          existing.booked++;
          
          // Check if showed (has non-no-show run)
          const runs = runsByBookingId.get(b.id) || [];
          if (runs.some(r => r.result !== 'No-show')) {
            existing.showed++;
          }
          
          bookerMap.set(bookedBy, existing);
        });
        
        const showRateList: ShowRateEntry[] = Array.from(bookerMap.entries())
          .map(([saName, counts]) => ({
            saName,
            booked: counts.booked,
            showed: counts.showed,
            showRate: counts.booked > 0 ? (counts.showed / counts.booked) * 100 : 0,
          }))
          .filter(e => e.booked > 0)
          .sort((a, b) => b.showRate - a.showRate);
        
        setShowRateStats(showRateList);
      } catch (error) {
        console.error('Error fetching payroll:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayroll();
  }, [selectedPeriod, payPeriods, useExternalRange, externalDateRange]);

  const sortedShowRateStats = useMemo(() => {
    return [...showRateStats].sort((a, b) => {
      const aVal = a[showRateSort.column];
      const bVal = b[showRateSort.column];
      const cmp = typeof aVal === 'string' 
        ? aVal.localeCompare(bVal as string) 
        : (aVal as number) - (bVal as number);
      return showRateSort.direction === 'asc' ? cmp : -cmp;
    });
  }, [showRateStats, showRateSort]);

  const handleShowRateSort = (column: typeof showRateSort.column) => {
    setShowRateSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleExport = async () => {
    // Export payroll data
    const period = payPeriods.find(p => p.label === selectedPeriod);
    if (!period) return;

    // Create CSV content
    let csv = 'Name,Commission,Sales Count\n';
    for (const entry of payroll) {
      csv += `"${entry.name}",${entry.total.toFixed(2)},${entry.sales}\n`;
    }
    csv += `\nTotal,${totalCommission.toFixed(2)},${payroll.reduce((sum, p) => sum + p.sales, 0)}\n`;

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll_${format(period.start, 'yyyy-MM-dd')}_to_${format(period.end, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-success" />
          Pay Period Commission
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Period Selection - only show if not using external range */}
        {!useExternalRange && (
          <div>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger>
                <SelectValue placeholder="Select pay period..." />
              </SelectTrigger>
              <SelectContent>
                {payPeriods.map((period) => (
                  <SelectItem key={period.label} value={period.label}>
                    {period.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Biweekly periods anchored to Jan 26, 2026
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="p-4 bg-success/10 rounded-lg border border-success/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Commission</p>
                  <p className="text-3xl font-black text-success">
                    ${totalCommission.toFixed(2)}
                  </p>
                </div>
                <Button onClick={handleExport} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-1" />
                  Export CSV
                </Button>
              </div>
            </div>

            {/* Staff Breakdown */}
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <Users className="w-4 h-4" />
                By Intro Owner
              </p>
              
              {payroll.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No commission data for this period
                </p>
              ) : (
                <div className="space-y-2">
                  {payroll.map((entry) => (
                    <Collapsible key={entry.name}>
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
                          <div className="flex items-center gap-2">
                            <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                            <div className="text-left">
                              <p className="font-medium">{entry.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {entry.sales} sale{entry.sales !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <p className="font-bold text-success text-lg">
                            ${entry.total.toFixed(2)}
                          </p>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-6 mt-1 space-y-1">
                          {entry.details.map((detail, idx) => (
                            <div 
                              key={idx}
                              className="flex items-center justify-between p-2 bg-background rounded border text-sm"
                            >
                              <div>
                                <p className="font-medium">{detail.memberName}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                  <span>{format(parseLocalDate(detail.date), 'MMM d')}</span>
                                  <Badge variant={detail.type === 'intro' ? 'default' : 'secondary'} className="text-[10px] px-1 py-0">
                                    {detail.membershipType || (detail.type === 'intro' ? 'Intro' : 'Outside')}
                                  </Badge>
                                  {detail.leadSource && (
                                    <span>📍 {detail.leadSource}</span>
                                  )}
                                  {detail.coach && (
                                    <span>🏋️ {capitalizeName(detail.coach)}</span>
                                  )}
                                  {detail.bookedBy && (
                                    <span>📅 {capitalizeName(detail.bookedBy)}</span>
                                  )}
                                </div>
                              </div>
                              <p className="font-medium text-success">
                                ${detail.amount.toFixed(2)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              )}
            </div>
            
            {/* Booking Show Rates Section */}
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-3 flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                Booking Show Rates by SA
              </p>
              
              {showRateStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No booking data for this period
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleShowRateSort('saName')}
                      >
                        SA Name {showRateSort.column === 'saName' && (showRateSort.direction === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead 
                        className="text-center cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleShowRateSort('booked')}
                      >
                        Booked {showRateSort.column === 'booked' && (showRateSort.direction === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead 
                        className="text-center cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleShowRateSort('showed')}
                      >
                        Showed {showRateSort.column === 'showed' && (showRateSort.direction === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead 
                        className="text-center cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleShowRateSort('showRate')}
                      >
                        Show % {showRateSort.column === 'showRate' && (showRateSort.direction === 'asc' ? '↑' : '↓')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedShowRateStats.map(entry => (
                      <TableRow key={entry.saName}>
                        <TableCell className="font-medium">{entry.saName}</TableCell>
                        <TableCell className="text-center">{entry.booked}</TableCell>
                        <TableCell className="text-center">{entry.showed}</TableCell>
                        <TableCell className="text-center font-medium">
                          <Badge variant={entry.showRate >= 70 ? 'default' : entry.showRate >= 50 ? 'secondary' : 'outline'}>
                            {entry.showRate.toFixed(0)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Excludes "Online Intro Offer" and "Run-first entry" bookings
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
