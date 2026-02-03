import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileSpreadsheet, 
  Download, 
  Loader2,
  Calendar,
  DollarSign
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getCurrentPayPeriod, formatDate, getLastPayPeriod } from '@/lib/pay-period';

interface SaleRow {
  id: string;
  sale_id: string | null;
  member_name: string;
  date_closed: string | null;
  membership_type: string;
  commission_amount: number | null;
  sale_type: string | null;
  intro_owner: string | null;
  lead_source: string;
}

interface IntroRunRow {
  id: string;
  run_id: string | null;
  member_name: string;
  buy_date: string | null;
  result: string;
  commission_amount: number | null;
  intro_owner: string | null;
}

interface PayrollData {
  saName: string;
  totalCommission: number;
  sales: Array<{
    memberName: string;
    dateClosed: string;
    membershipType: string;
    commissionAmount: number;
    saleType: string;
    introOwner: string;
  }>;
}

export default function PayrollExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [payrollData, setPayrollData] = useState<PayrollData[] | null>(null);
  const [payPeriodLabel, setPayPeriodLabel] = useState<string>('');

  const fetchPayrollData = async (useCurrent: boolean) => {
    setIsExporting(true);
    setPayrollData(null);
    
    try {
      // Get the pay period dates
      const payPeriod = useCurrent ? getCurrentPayPeriod() : getLastPayPeriod();
      const startDate = formatDate(payPeriod.start);
      const endDate = formatDate(payPeriod.end);
      setPayPeriodLabel(`${startDate} to ${endDate}`);

      // Fetch sales from sales_outside_intro where date_closed is in pay period
      const { data: salesData, error: salesError } = await supabase
        .from('sales_outside_intro')
        .select('id, sale_id, member_name, date_closed, membership_type, commission_amount, sale_type, intro_owner, lead_source')
        .gte('date_closed', startDate)
        .lte('date_closed', endDate);

      if (salesError) throw salesError;

      // Fetch intro-based sales from intros_run where buy_date is in pay period
      const { data: introRunData, error: introError } = await supabase
        .from('intros_run')
        .select('id, run_id, member_name, buy_date, result, commission_amount, intro_owner')
        .gte('buy_date', startDate)
        .lte('buy_date', endDate)
        .gt('commission_amount', 0);

      if (introError) throw introError;

      // Combine and group by intro_owner
      const commissionBySA = new Map<string, PayrollData>();

      // Process outside-intro sales
      (salesData as SaleRow[] || []).forEach((sale) => {
        const owner = sale.intro_owner || 'Unassigned';
        if (!commissionBySA.has(owner)) {
          commissionBySA.set(owner, { saName: owner, totalCommission: 0, sales: [] });
        }
        const data = commissionBySA.get(owner)!;
        const commission = sale.commission_amount || 0;
        data.totalCommission += commission;
        data.sales.push({
          memberName: sale.member_name,
          dateClosed: sale.date_closed || '',
          membershipType: sale.membership_type,
          commissionAmount: commission,
          saleType: sale.sale_type || 'Outside Intro',
          introOwner: owner,
        });
      });

      // Process intro-based sales
      (introRunData as IntroRunRow[] || []).forEach((run) => {
        const owner = run.intro_owner || 'Unassigned';
        if (!commissionBySA.has(owner)) {
          commissionBySA.set(owner, { saName: owner, totalCommission: 0, sales: [] });
        }
        const data = commissionBySA.get(owner)!;
        const commission = run.commission_amount || 0;
        data.totalCommission += commission;
        data.sales.push({
          memberName: run.member_name,
          dateClosed: run.buy_date || '',
          membershipType: run.result,
          commissionAmount: commission,
          saleType: 'Intro',
          introOwner: owner,
        });
      });

      // Convert to array and sort by total commission
      const result = Array.from(commissionBySA.values())
        .filter(d => d.totalCommission > 0)
        .sort((a, b) => b.totalCommission - a.totalCommission);

      setPayrollData(result);
      toast.success(`Payroll data loaded for ${startDate} to ${endDate}`);
    } catch (error) {
      console.error('Payroll export error:', error);
      toast.error('Failed to fetch payroll data');
    } finally {
      setIsExporting(false);
    }
  };

  const downloadCSV = () => {
    if (!payrollData) return;

    // Create CSV content
    const headers = ['SA Name', 'Member Name', 'Date Closed', 'Membership Type', 'Commission Amount', 'Sale Type'];
    const rows: string[][] = [];

    payrollData.forEach(sa => {
      sa.sales.forEach(sale => {
        rows.push([
          sa.saName,
          sale.memberName,
          sale.dateClosed,
          sale.membershipType,
          sale.commissionAmount.toFixed(2),
          sale.saleType,
        ]);
      });
    });

    // Add summary rows
    rows.push([]);
    rows.push(['SUMMARY']);
    payrollData.forEach(sa => {
      rows.push([sa.saName, '', '', '', sa.totalCommission.toFixed(2), 'Total']);
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll_${payPeriodLabel.replace(/ to /g, '_').replace(/-/g, '')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('CSV downloaded!');
  };

  const totalCommission = payrollData?.reduce((sum, d) => sum + d.totalCommission, 0) || 0;
  const totalSales = payrollData?.reduce((sum, d) => sum + d.sales.length, 0) || 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          Payroll Export
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={() => fetchPayrollData(true)} 
            disabled={isExporting}
            className="flex-1"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4 mr-2" />
                Current Pay Period
              </>
            )}
          </Button>
          <Button 
            onClick={() => fetchPayrollData(false)} 
            disabled={isExporting}
            variant="outline"
            className="flex-1"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Last Pay Period
          </Button>
        </div>

        {payrollData && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{payPeriodLabel}</Badge>
                <Badge variant="secondary">{totalSales} sales</Badge>
              </div>
              <Button onClick={downloadCSV} size="sm" variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download CSV
              </Button>
            </div>

            <div className="p-3 bg-success/10 rounded-lg border border-success/30 text-center">
              <DollarSign className="w-6 h-6 text-success mx-auto mb-1" />
              <p className="text-2xl font-bold text-success">${totalCommission.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Total Commission</p>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {payrollData.map(sa => (
                <div key={sa.saName} className="p-2 bg-muted/50 rounded flex justify-between items-center">
                  <div>
                    <p className="font-medium text-sm">{sa.saName}</p>
                    <p className="text-xs text-muted-foreground">{sa.sales.length} sales</p>
                  </div>
                  <p className="font-bold text-success">${sa.totalCommission.toFixed(2)}</p>
                </div>
              ))}
            </div>

            {payrollData.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No commission data found for this pay period.
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Commission is based on date_closed (actual purchase date), not booking or intro date.
        </p>
      </CardContent>
    </Card>
  );
}
