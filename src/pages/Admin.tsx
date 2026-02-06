import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Users, RefreshCw, FileSpreadsheet, Database, HeartPulse, MessageSquare } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { getSpreadsheetId, setSpreadsheetId } from '@/lib/sheets-sync';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import DataSyncPanel from '@/components/admin/DataSyncPanel';
import DataHealthPanel from '@/components/admin/DataHealthPanel';
import SheetsSyncTest from '@/components/admin/SheetsSyncTest';
import PayrollExport from '@/components/admin/PayrollExport';
import PayPeriodCommission from '@/components/PayPeriodCommission';
import ShiftRecapsEditor from '@/components/admin/ShiftRecapsEditor';
import FixBookingAttribution from '@/components/admin/FixBookingAttribution';
import EmergencySyncBookings from '@/components/admin/EmergencySyncBookings';
import EmergencySyncRuns from '@/components/admin/EmergencySyncRuns';
import { GroupMeSettings } from '@/components/admin/GroupMeSettings';
import MembershipPurchasesPanel from '@/components/admin/MembershipPurchasesPanel';
import ClientJourneyPanel from '@/components/admin/ClientJourneyPanel';
import { CoachPerformance } from '@/components/dashboard/CoachPerformance';
import { getDateRangeForPreset } from '@/lib/pay-period';

const ALL_STAFF = ['Bre', 'Elizabeth', 'James', 'Nathan', 'Kaitlyn H', 'Natalya', 'Bri', 'Grace', 'Katie', 'Kailey', 'Kayla', 'Koa', 'Lauren', 'Nora', 'Sophie'];

interface SyncLog {
  id: string;
  sync_type: string;
  records_synced: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface StaffStats {
  name: string;
  totalShifts: number;
  totalIntros: number;
  totalSales: number;
  commission: number;
}

export default function Admin() {
  const { user } = useAuth();
  const { introsBooked, introsRun, refreshData } = useData();
  const [spreadsheetIdInput, setSpreadsheetIdInput] = useState(getSpreadsheetId() || '');
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [staffStats, setStaffStats] = useState<StaffStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Date range for data health (default to all time)
  const dateRange = useMemo(() => getDateRangeForPreset('all_time'), []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch sync logs
        const { data: logs } = await supabase
          .from('sheets_sync_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);
        if (logs) setSyncLogs(logs as SyncLog[]);

        // Fetch staff stats
        const stats: StaffStats[] = [];
        for (const name of ALL_STAFF) {
          const [shiftsResult, introsResult, salesResult] = await Promise.all([
            supabase.from('shift_recaps').select('id', { count: 'exact' }).eq('staff_name', name),
            supabase.from('intros_run').select('commission_amount').eq('intro_owner', name),
            supabase.from('sales_outside_intro').select('commission_amount').eq('intro_owner', name),
          ]);

          const totalShifts = shiftsResult.count || 0;
          const totalIntros = introsResult.data?.length || 0;
          const totalSales = salesResult.data?.length || 0;
          const introCommission = introsResult.data?.reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;
          const saleCommission = salesResult.data?.reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;

          if (totalShifts > 0 || totalIntros > 0 || totalSales > 0) {
            stats.push({
              name,
              totalShifts,
              totalIntros,
              totalSales,
              commission: introCommission + saleCommission,
            });
          }
        }
        
        // Sort by commission
        stats.sort((a, b) => b.commission - a.commission);
        setStaffStats(stats);
      } catch (error) {
        console.error('Error fetching admin data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Only admin can access
  if (user?.role !== 'Admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSaveSpreadsheetId = () => {
    setSpreadsheetId(spreadsheetIdInput);
    toast.success('Spreadsheet ID saved!');
  };

  const handleRefresh = async () => {
    await refreshData();
    toast.success('Data refreshed!');
  };

  const handleSyncComplete = async () => {
    await refreshData();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Admin Panel
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage data sync, edit records, and view team stats
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="gap-1">
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-1">
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">Data</span>
          </TabsTrigger>
          <TabsTrigger value="groupme" className="gap-1">
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">GroupMe</span>
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-1">
            <HeartPulse className="w-4 h-4" />
            <span className="hidden sm:inline">Health</span>
          </TabsTrigger>
        </TabsList>

        {/* GroupMe Tab */}
        <TabsContent value="groupme">
          <GroupMeSettings />
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Payroll Export */}
          <PayrollExport />

          {/* Pay Period Commission */}
          <PayPeriodCommission />

          {/* Coach Performance */}
          <CoachPerformance
            introsBooked={introsBooked}
            introsRun={introsRun}
            dateRange={dateRange}
          />
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Team Performance (All Time)
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={handleRefresh}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Loading...
                </p>
              ) : staffStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No activity yet
                </p>
              ) : (
                <div className="space-y-3">
                  {staffStats.map((staff) => (
                    <div 
                      key={staff.name}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{staff.name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span>{staff.totalShifts} shifts</span>
                          <span>{staff.totalIntros} intros</span>
                          <span>{staff.totalSales} sales</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-success">
                          ${staff.commission.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Management Tab */}
        <TabsContent value="data" className="space-y-4">
          {/* Unified Client Journey View - Primary data management */}
          <ClientJourneyPanel />
          
          <MembershipPurchasesPanel />
          <ShiftRecapsEditor />
        </TabsContent>

        {/* Health Tab */}
        <TabsContent value="health" className="space-y-4">
          <DataHealthPanel 
            dateRange={dateRange}
            onFixComplete={handleSyncComplete}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
