import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DollarSign, CalendarIcon, Users, TrendingUp, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addDays, subDays, isWithinInterval, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface IntroRun {
  id: string;
  member_name: string;
  result: string;
  commission_amount: number | null;
  is_self_gen: boolean | null;
  buy_date: string | null;
  created_at: string;
  sa_name: string | null;
  shift_recap_id: string | null;
}

interface StaffCommission {
  name: string;
  totalCommission: number;
  introCount: number;
  closedCount: number;
}

// Generate pay periods for the year (every 2 weeks starting Jan 1)
function generatePayPeriods(year: number): { label: string; start: Date; end: Date }[] {
  const periods: { label: string; start: Date; end: Date }[] = [];
  let currentStart = new Date(year, 0, 1); // Jan 1
  let periodNum = 1;

  while (currentStart.getFullYear() === year) {
    const end = addDays(currentStart, 13); // 14 days total
    periods.push({
      label: `Period ${periodNum}: ${format(currentStart, 'MMM d')} - ${format(end, 'MMM d')}`,
      start: currentStart,
      end: end,
    });
    currentStart = addDays(currentStart, 14);
    periodNum++;
  }

  return periods;
}

export default function PayPeriodCommission() {
  const [introsRun, setIntrosRun] = useState<IntroRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [periodType, setPeriodType] = useState<'preset' | 'custom'>('preset');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();

  const currentYear = new Date().getFullYear();
  const payPeriods = useMemo(() => generatePayPeriods(currentYear), [currentYear]);

  // Auto-select current period on mount
  useEffect(() => {
    const today = new Date();
    const currentPeriod = payPeriods.find(p => 
      isWithinInterval(today, { start: p.start, end: p.end })
    );
    if (currentPeriod) {
      setSelectedPeriod(currentPeriod.label);
    }
  }, [payPeriods]);

  useEffect(() => {
    const fetchIntros = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('intros_run')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setIntrosRun(data || []);
      } catch (error) {
        console.error('Error fetching intros:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchIntros();
  }, []);

  // Get the active date range
  const dateRange = useMemo(() => {
    if (periodType === 'custom' && customStartDate && customEndDate) {
      return { start: customStartDate, end: customEndDate };
    }
    const period = payPeriods.find(p => p.label === selectedPeriod);
    return period ? { start: period.start, end: period.end } : null;
  }, [periodType, selectedPeriod, customStartDate, customEndDate, payPeriods]);

  // Filter intros by date range and calculate commissions
  const { filteredIntros, staffCommissions, totalCommission } = useMemo(() => {
    if (!dateRange) {
      return { filteredIntros: [], staffCommissions: [], totalCommission: 0 };
    }

    const filtered = introsRun.filter(intro => {
      const introDate = intro.buy_date 
        ? parseISO(intro.buy_date) 
        : parseISO(intro.created_at);
      return isWithinInterval(introDate, { start: dateRange.start, end: dateRange.end });
    });

    // Group by staff
    const staffMap = new Map<string, StaffCommission>();
    
    filtered.forEach(intro => {
      const staffName = intro.sa_name || 'Unknown';
      const current = staffMap.get(staffName) || {
        name: staffName,
        totalCommission: 0,
        introCount: 0,
        closedCount: 0,
      };

      current.introCount++;
      
      if (intro.is_self_gen && intro.commission_amount) {
        current.totalCommission += intro.commission_amount;
        current.closedCount++;
      }

      staffMap.set(staffName, current);
    });

    const commissions = Array.from(staffMap.values())
      .sort((a, b) => b.totalCommission - a.totalCommission);

    const total = commissions.reduce((sum, s) => sum + s.totalCommission, 0);

    return { filteredIntros: filtered, staffCommissions: commissions, totalCommission: total };
  }, [introsRun, dateRange]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-success" />
          Pay Period Commission
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Period Selection */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={periodType === 'preset' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriodType('preset')}
          >
            Preset Periods
          </Button>
          <Button
            variant={periodType === 'custom' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriodType('custom')}
          >
            Custom Range
          </Button>
        </div>

        {periodType === 'preset' ? (
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
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !customStartDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customStartDate ? format(customStartDate, 'MMM d, yyyy') : 'Start'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customStartDate}
                    onSelect={setCustomStartDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !customEndDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customEndDate ? format(customEndDate, 'MMM d, yyyy') : 'End'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customEndDate}
                    onSelect={setCustomEndDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        {dateRange && (
          <>
            <div className="p-4 bg-success/10 rounded-lg border border-success/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Team Commission</p>
                  <p className="text-3xl font-black text-success">
                    ${totalCommission.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Period Intros</p>
                  <p className="text-2xl font-bold">{filteredIntros.length}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {format(dateRange.start, 'MMM d')} - {format(dateRange.end, 'MMM d, yyyy')}
              </p>
            </div>

            {/* Staff Breakdown */}
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Staff Breakdown
              </p>
              
              {staffCommissions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No commission data for this period
                </p>
              ) : (
                <div className="space-y-2">
                  {staffCommissions.map((staff) => (
                    <div 
                      key={staff.name}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{staff.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>{staff.introCount} intros</span>
                          <span>•</span>
                          <span>{staff.closedCount} self-gen closed</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-success text-lg">
                          ${staff.totalCommission.toFixed(2)}
                        </p>
                        {staff.closedCount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {Math.round((staff.closedCount / staff.introCount) * 100)}% close rate
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Intros in Period */}
            {filteredIntros.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Intros This Period
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {filteredIntros.slice(0, 10).map((intro) => (
                    <div 
                      key={intro.id}
                      className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm"
                    >
                      <div>
                        <p className="font-medium">{intro.member_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {intro.buy_date 
                            ? format(parseISO(intro.buy_date), 'MMM d') 
                            : format(parseISO(intro.created_at), 'MMM d')}
                          {intro.sa_name && ` • ${intro.sa_name}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "font-medium",
                          intro.is_self_gen && intro.commission_amount ? "text-success" : ""
                        )}>
                          {intro.result}
                        </p>
                        {intro.is_self_gen && intro.commission_amount ? (
                          <Badge className="text-xs bg-success">
                            +${intro.commission_amount.toFixed(2)}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {filteredIntros.length > 10 && (
                    <p className="text-xs text-center text-muted-foreground py-2">
                      +{filteredIntros.length - 10} more intros
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
