import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw, Loader2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getDateRangeForPreset, DateRange, DatePreset } from '@/lib/pay-period';
import { isMembershipSale, getSaleDate } from '@/lib/sales-detection';
import { capitalizeName, parseLocalDate } from '@/lib/utils';

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'pay_period', label: 'Current Pay Period' },
  { value: 'last_pay_period', label: 'Last Pay Period' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year', label: 'This Year' },
];

interface MembershipPurchase {
  id: string;
  member_name: string;
  purchase_date: string;
  membership_type: string;
  commission_amount: number;
  intro_owner: string | null;
  booked_by: string | null;
  lead_source: string | null;
  coach: string | null;
  source: 'intro_run' | 'outside_intro';
}

export default function MembershipPurchasesPanel() {
  const [purchases, setPurchases] = useState<MembershipPurchase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<DatePreset>('pay_period');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  useEffect(() => {
    const range = getDateRangeForPreset(selectedPeriod);
    setDateRange(range);
  }, [selectedPeriod]);

  const fetchPurchases = async () => {
    if (!dateRange) return;
    
    setIsLoading(true);
    try {
      const startDate = dateRange.start.toISOString().split('T')[0];
      const endDate = dateRange.end.toISOString().split('T')[0];

      // Fetch intro runs with membership sales
      const { data: runs } = await supabase
        .from('intros_run')
        .select(`
          id,
          member_name,
          run_date,
          buy_date,
          created_at,
          result,
          commission_amount,
          intro_owner,
          ran_by,
          sa_name,
          lead_source,
          linked_intro_booked_id
        `)
        .gt('commission_amount', 0);

      // Fetch outside intro sales
      const { data: outsideSales } = await supabase
        .from('sales_outside_intro')
        .select(`
          id,
          member_name,
          date_closed,
          created_at,
          membership_type,
          commission_amount,
          intro_owner,
          lead_source
        `);

      // Fetch bookings for booked_by, lead_source, and coach info
      const { data: bookings } = await supabase
        .from('intros_booked')
        .select('id, sa_working_shift, booked_by, lead_source, coach_name');

      const bookingMap = new Map(
        (bookings || []).map(b => [b.id, { 
          bookedBy: b.sa_working_shift || b.booked_by || null,
          leadSource: b.lead_source || null,
          coach: b.coach_name || null
        }])
      );

      const allPurchases: MembershipPurchase[] = [];

      // Process intro runs
      (runs || []).forEach(run => {
        if (!isMembershipSale(run.result)) return;
        
        const purchaseDate = getSaleDate(run.buy_date, run.run_date, null, run.created_at);
        if (purchaseDate < startDate || purchaseDate > endDate) return;

        const bookingInfo = run.linked_intro_booked_id ? bookingMap.get(run.linked_intro_booked_id) : null;

        allPurchases.push({
          id: run.id,
          member_name: capitalizeName(run.member_name) || run.member_name,
          purchase_date: purchaseDate,
          membership_type: run.result,
          commission_amount: run.commission_amount || 0,
          intro_owner: capitalizeName(run.intro_owner || run.ran_by || run.sa_name),
          booked_by: capitalizeName(bookingInfo?.bookedBy || null),
          lead_source: run.lead_source || bookingInfo?.leadSource || null,
          coach: capitalizeName(bookingInfo?.coach || null),
          source: 'intro_run',
        });
      });

      // Process outside sales
      (outsideSales || []).forEach(sale => {
        const purchaseDate = getSaleDate(null, null, sale.date_closed, sale.created_at);
        if (purchaseDate < startDate || purchaseDate > endDate) return;

        allPurchases.push({
          id: sale.id,
          member_name: capitalizeName(sale.member_name) || sale.member_name,
          purchase_date: purchaseDate,
          membership_type: sale.membership_type,
          commission_amount: sale.commission_amount || 0,
          intro_owner: capitalizeName(sale.intro_owner),
          booked_by: null,
          lead_source: sale.lead_source,
          coach: null,
          source: 'outside_intro',
        });
      });

      // Sort by date descending
      allPurchases.sort((a, b) => b.purchase_date.localeCompare(a.purchase_date));

      setPurchases(allPurchases);
    } catch (error) {
      console.error('Error fetching purchases:', error);
      toast.error('Failed to load membership purchases');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (dateRange) {
      fetchPurchases();
    }
  }, [dateRange]);

  const stats = useMemo(() => {
    const total = purchases.reduce((sum, p) => sum + p.commission_amount, 0);
    const premierCount = purchases.filter(p => 
      p.membership_type.toLowerCase().includes('premier')
    ).length;
    const eliteCount = purchases.filter(p => 
      p.membership_type.toLowerCase().includes('elite')
    ).length;
    const basicCount = purchases.filter(p => 
      p.membership_type.toLowerCase().includes('basic')
    ).length;
    const withOtbeat = purchases.filter(p => 
      p.membership_type.toLowerCase().includes('+ otbeat')
    ).length;

    return { total, premierCount, eliteCount, basicCount, withOtbeat };
  }, [purchases]);

  const getMembershipBadgeVariant = (type: string) => {
    const lower = type.toLowerCase();
    if (lower.includes('premier')) return 'default';
    if (lower.includes('elite')) return 'secondary';
    return 'outline';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Members Who Bought
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as DatePreset)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map(preset => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={fetchPurchases} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          <div className="bg-muted/50 p-2 rounded text-center">
            <p className="text-lg font-bold text-success">${stats.total.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Total Commission</p>
          </div>
          <div className="bg-muted/50 p-2 rounded text-center">
            <p className="text-lg font-bold">{purchases.length}</p>
            <p className="text-xs text-muted-foreground">Total Sales</p>
          </div>
          <div className="bg-muted/50 p-2 rounded text-center">
            <p className="text-lg font-bold">{stats.premierCount}</p>
            <p className="text-xs text-muted-foreground">Premier</p>
          </div>
          <div className="bg-muted/50 p-2 rounded text-center">
            <p className="text-lg font-bold">{stats.eliteCount}</p>
            <p className="text-xs text-muted-foreground">Elite</p>
          </div>
          <div className="bg-muted/50 p-2 rounded text-center">
            <p className="text-lg font-bold">{stats.withOtbeat}</p>
            <p className="text-xs text-muted-foreground">+ OTBeat</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No membership purchases in this period
          </p>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Ran By</TableHead>
                  <TableHead>Coach</TableHead>
                  <TableHead>Lead Source</TableHead>
                  <TableHead>Booked By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map(purchase => (
                  <TableRow key={purchase.id}>
                    <TableCell className="font-medium">
                      {purchase.member_name}
                      {purchase.source === 'outside_intro' && (
                        <Badge variant="outline" className="ml-1 text-xs">Outside</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {parseLocalDate(purchase.purchase_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getMembershipBadgeVariant(purchase.membership_type)}>
                        {purchase.membership_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-success">
                      ${purchase.commission_amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {purchase.intro_owner || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {purchase.coach || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {purchase.lead_source || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {purchase.booked_by || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
