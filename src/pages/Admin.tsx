import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Settings, Users, CheckCircle, Clock, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { getSpreadsheetId, setSpreadsheetId, syncAllUnsynced } from '@/lib/sheets-sync';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import HistoricalDataImport from '@/components/HistoricalDataImport';
import PayPeriodCommission from '@/components/PayPeriodCommission';

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
  const { shiftRecaps, igLeads, refreshData } = useData();
  const [spreadsheetIdInput, setSpreadsheetIdInput] = useState(getSpreadsheetId() || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

  useEffect(() => {
    // Fetch sync logs
    const fetchLogs = async () => {
      const { data } = await supabase
        .from('sheets_sync_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setSyncLogs(data as SyncLog[]);
    };
    fetchLogs();
  }, []);

  // Only admin can access
  if (user?.role !== 'Admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSaveSpreadsheetId = () => {
    setSpreadsheetId(spreadsheetIdInput);
    toast.success('Spreadsheet ID saved!');
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const result = await syncAllUnsynced();
      if (result.success) {
        toast.success(`Synced ${result.recordsSynced} records to Google Sheets!`);
        await refreshData();
      } else {
        toast.error('Sync failed. Check the logs for details.');
      }
    } catch (error) {
      toast.error('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  // Calculate stats per staff member
  const staffStats = ALL_STAFF.map(name => {
    const recaps = shiftRecaps.filter(r => r.staff_name === name);
    const leads = igLeads.filter(l => l.sa_name === name);
    
    return {
      name,
      totalRecaps: recaps.length,
      totalLeads: leads.length,
      commission: 0, // Would need intros_run data for actual commission
    };
  }).filter(s => s.totalRecaps > 0 || s.totalLeads > 0);

  const unsyncedCount = shiftRecaps.filter(r => !r.synced_to_sheets).length + 
                        igLeads.filter(l => !l.synced_to_sheets).length;

  return (
    <div className="p-4 space-y-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Admin Panel
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage integrations and view team stats
        </p>
      </div>

      {/* Google Sheets Integration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-success" />
            Google Sheets Sync
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm">Spreadsheet ID</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Find this in your Google Sheets URL: docs.google.com/spreadsheets/d/<strong>SPREADSHEET_ID</strong>/edit
            </p>
            <div className="flex gap-2">
              <Input
                value={spreadsheetIdInput}
                onChange={(e) => setSpreadsheetIdInput(e.target.value)}
                placeholder="Enter spreadsheet ID..."
                className="flex-1"
              />
              <Button onClick={handleSaveSpreadsheetId} variant="outline">
                Save
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <p className="font-medium">Connection Status</p>
              <p className="text-xs text-muted-foreground">
                {spreadsheetIdInput ? 'Spreadsheet ID configured' : 'Not configured'}
              </p>
            </div>
            <Badge variant={spreadsheetIdInput ? 'default' : 'secondary'}>
              {spreadsheetIdInput ? 'Connected' : 'Not Connected'}
            </Badge>
          </div>

          {spreadsheetIdInput && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{unsyncedCount} unsynced records</p>
                <p className="text-xs text-muted-foreground">
                  Click sync to push to Google Sheets
                </p>
              </div>
              <Button onClick={handleSyncAll} disabled={isSyncing || unsyncedCount === 0}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>
          )}

          {syncLogs.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Recent Sync Activity</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {syncLogs.map((log) => (
                  <div 
                    key={log.id}
                    className={`text-xs p-2 rounded ${
                      log.status === 'success' ? 'bg-success/10' : 'bg-destructive/10'
                    }`}
                  >
                    <div className="flex justify-between">
                      <span>{log.sync_type}</span>
                      <span>{log.records_synced} records</span>
                    </div>
                    <div className="text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                    {log.error_message && (
                      <div className="text-destructive mt-1">{log.error_message}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historical Data Import - Show when spreadsheet is configured */}
      {spreadsheetIdInput && (
        <HistoricalDataImport 
          spreadsheetId={spreadsheetIdInput}
          onImportComplete={refreshData}
        />
      )}

      {/* Pay Period Commission Dashboard */}
      <PayPeriodCommission />

      {/* Team Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Team Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {staffStats.length === 0 ? (
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
                      <span>{staff.totalRecaps} recaps</span>
                      <span>{staff.totalLeads} leads</span>
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

      {/* Pending Claims Placeholder */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-warning" />
            Pending Claims
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-success mx-auto mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">
              No pending claims
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
