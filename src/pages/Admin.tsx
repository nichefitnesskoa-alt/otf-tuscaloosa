import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, RefreshCw, FileSpreadsheet, Database, Users, BarChart3, Megaphone } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { getSpreadsheetId, setSpreadsheetId } from '@/lib/sheets-sync';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import PayPeriodCommission from '@/components/PayPeriodCommission';
import ShiftRecapsEditor from '@/components/admin/ShiftRecapsEditor';

import MembershipPurchasesPanel from '@/components/admin/MembershipPurchasesPanel';
import ClientJourneyPanel from '@/components/admin/ClientJourneyPanel';
// CoachPerformance removed from Overview - available in Coaching tab and Studio
import ReferralTracker from '@/components/admin/ReferralTracker';
import ReferralTree from '@/components/admin/ReferralTree';
import VipBulkImport from '@/components/admin/VipBulkImport';
import CoachingView from '@/components/admin/CoachingView';
import CampaignsPanel from '@/components/admin/CampaignsPanel';
import AmcLogForm from '@/components/admin/AmcLogForm';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { getDateRangeForPreset, DatePreset, DateRange } from '@/lib/pay-period';

const ALL_STAFF = ['Bre', 'Elizabeth', 'James', 'Nathan', 'Kaitlyn H', 'Natalya', 'Bri', 'Grace', 'Katie', 'Kailey', 'Kayla', 'Koa', 'Lauren', 'Nora', 'Sophie'];

interface SyncLog {
  id: string;
  sync_type: string;
  records_synced: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

export default function Admin() {
  const { user } = useAuth();
  const { introsBooked, introsRun, refreshData } = useData();
  const [spreadsheetIdInput, setSpreadsheetIdInput] = useState(getSpreadsheetId() || '');
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Global date filter state for Overview tab
  const [datePreset, setDatePreset] = useState<DatePreset>('pay_period');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  
  // Computed date range based on preset/custom selection
  const dateRange = useMemo(() => {
    return getDateRangeForPreset(datePreset, customRange);
  }, [datePreset, customRange]);
  

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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="gap-1">
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-1">
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">Data</span>
          </TabsTrigger>
          <TabsTrigger value="coaching" className="gap-1">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Coaching</span>
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1">
            <Megaphone className="w-4 h-4" />
            <span className="hidden sm:inline">Campaigns</span>
          </TabsTrigger>
          <TabsTrigger value="referrals" className="gap-1">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Referrals</span>
          </TabsTrigger>
        </TabsList>

        {/* Coaching Tab */}
        <TabsContent value="coaching" className="space-y-4">
          <CoachingView />
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-4">
          <CampaignsPanel />
        </TabsContent>

        {/* Referrals Tab */}
        <TabsContent value="referrals" className="space-y-4">
          <ReferralTracker />
          <ReferralTree />
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Global Date Filter */}
          <DateRangeFilter
            preset={datePreset}
            customRange={customRange}
            onPresetChange={setDatePreset}
            onCustomRangeChange={setCustomRange}
            dateRange={dateRange || { start: new Date(), end: new Date() }}
          />

          {/* AMC Log */}
          <AmcLogForm />

          {/* Pay Period Commission */}
          <PayPeriodCommission dateRange={dateRange} />
        </TabsContent>

        {/* Data Management Tab */}
        <TabsContent value="data" className="space-y-4">
          {/* Unified Client Journey View - Primary data management */}
          <ClientJourneyPanel />
          
          <VipBulkImport />
          <MembershipPurchasesPanel />
          <ShiftRecapsEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
