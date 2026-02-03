import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Download, 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
  Database,
  DollarSign,
  FileSpreadsheet
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImportStats {
  shifts: { imported: number; skipped: number; updated: number; errors: number };
  bookings: { imported: number; skipped: number; updated: number; errors: number };
  runs: { imported: number; skipped: number; updated: number; errors: number };
  sales: { imported: number; skipped: number; updated: number; errors: number };
  errorLog: string[];
  commissionSummary?: {
    totalSales: number;
    withCommissionPresent: number;
    commissionComputed: number;
    earliestDateClosed: string | null;
    latestDateClosed: string | null;
  };
}

interface SyncLogEntry {
  id: string;
  sync_type: string;
  records_synced: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface DataSyncPanelProps {
  spreadsheetId: string;
  onSyncComplete: () => void;
}

export default function DataSyncPanel({ spreadsheetId, onSyncComplete }: DataSyncPanelProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [showErrorLog, setShowErrorLog] = useState(false);
  const [lastSyncLog, setLastSyncLog] = useState<SyncLogEntry | null>(null);
  const [dbCounts, setDbCounts] = useState({
    shifts: 0,
    bookings: 0,
    runs: 0,
    sales: 0,
  });

  useEffect(() => {
    fetchDbCounts();
    fetchLastSyncLog();
  }, []);

  const fetchDbCounts = async () => {
    const [shiftsRes, bookingsRes, runsRes, salesRes] = await Promise.all([
      supabase.from('shift_recaps').select('id', { count: 'exact', head: true }),
      supabase.from('intros_booked').select('id', { count: 'exact', head: true }),
      supabase.from('intros_run').select('id', { count: 'exact', head: true }),
      supabase.from('sales_outside_intro').select('id', { count: 'exact', head: true }),
    ]);

    setDbCounts({
      shifts: shiftsRes.count || 0,
      bookings: bookingsRes.count || 0,
      runs: runsRes.count || 0,
      sales: salesRes.count || 0,
    });
  };

  const fetchLastSyncLog = async () => {
    const { data } = await supabase
      .from('sheets_sync_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (data) {
      setLastSyncLog(data as SyncLogEntry);
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    setImportStats(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-sheets', {
        body: {
          action: 'import_from_sheets',
          spreadsheetId,
        },
      });

      if (error) throw error;
      
      if (data?.success) {
        setImportStats({
          shifts: data.shifts || { imported: 0, skipped: 0, updated: 0, errors: 0 },
          bookings: data.bookings || { imported: 0, skipped: 0, updated: 0, errors: 0 },
          runs: data.runs || { imported: 0, skipped: 0, updated: 0, errors: 0 },
          sales: data.sales || { imported: 0, skipped: 0, updated: 0, errors: 0 },
          errorLog: data.errorLog || [],
          commissionSummary: data.commissionSummary || null,
        });
        toast.success('Historical import complete!');
        await fetchDbCounts();
        await fetchLastSyncLog();
        onSyncComplete();
      } else {
        throw new Error(data?.error || 'Import failed');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Import failed. Check error log.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleResync = async () => {
    setIsResyncing(true);
    setImportStats(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-sheets', {
        body: {
          action: 'resync_from_sheets',
          spreadsheetId,
        },
      });

      if (error) throw error;
      
      if (data?.success) {
        setImportStats({
          shifts: data.shifts || { imported: 0, skipped: 0, updated: 0, errors: 0 },
          bookings: data.bookings || { imported: 0, skipped: 0, updated: 0, errors: 0 },
          runs: data.runs || { imported: 0, skipped: 0, updated: 0, errors: 0 },
          sales: data.sales || { imported: 0, skipped: 0, updated: 0, errors: 0 },
          errorLog: data.errorLog || [],
          commissionSummary: data.commissionSummary || null,
        });
        toast.success('Re-sync complete!');
        await fetchDbCounts();
        await fetchLastSyncLog();
        onSyncComplete();
      } else {
        throw new Error(data?.error || 'Re-sync failed');
      }
    } catch (error) {
      console.error('Re-sync error:', error);
      toast.error('Re-sync failed. Check error log.');
    } finally {
      setIsResyncing(false);
    }
  };

  const handleForceReimport = async () => {
    setIsClearing(true);
    setImportStats(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-sheets', {
        body: {
          action: 'force_reimport',
          spreadsheetId,
        },
      });

      if (error) throw error;
      
      if (data?.success) {
        setImportStats({
          shifts: data.shifts || { imported: 0, skipped: 0, updated: 0, errors: 0 },
          bookings: data.bookings || { imported: 0, skipped: 0, updated: 0, errors: 0 },
          runs: data.runs || { imported: 0, skipped: 0, updated: 0, errors: 0 },
          sales: data.sales || { imported: 0, skipped: 0, updated: 0, errors: 0 },
          errorLog: data.errorLog || [],
          commissionSummary: data.commissionSummary || null,
        });
        toast.success('Force re-import complete!');
        await fetchDbCounts();
        await fetchLastSyncLog();
        onSyncComplete();
      } else {
        throw new Error(data?.error || 'Force re-import failed');
      }
    } catch (error) {
      console.error('Force re-import error:', error);
      toast.error('Force re-import failed.');
    } finally {
      setIsClearing(false);
    }
  };

  const totalImported = importStats
    ? importStats.shifts.imported + importStats.bookings.imported + 
      importStats.runs.imported + importStats.sales.imported
    : 0;
  const totalUpdated = importStats
    ? (importStats.shifts.updated || 0) + (importStats.bookings.updated || 0) + 
      (importStats.runs.updated || 0) + (importStats.sales.updated || 0)
    : 0;
  const totalSkipped = importStats
    ? importStats.shifts.skipped + importStats.bookings.skipped + 
      importStats.runs.skipped + importStats.sales.skipped
    : 0;
  const totalErrors = importStats
    ? importStats.shifts.errors + importStats.bookings.errors + 
      importStats.runs.errors + importStats.sales.errors
    : 0;
  const totalDbRecords = dbCounts.shifts + dbCounts.bookings + dbCounts.runs + dbCounts.sales;

  const isLoading = isImporting || isResyncing || isClearing;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          Data Sync Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Database Stats */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Current Database Records</p>
            <Badge variant="outline">{totalDbRecords} total</Badge>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div>
              <p className="font-bold text-primary">{dbCounts.shifts}</p>
              <p className="text-muted-foreground">Shifts</p>
            </div>
            <div>
              <p className="font-bold text-primary">{dbCounts.bookings}</p>
              <p className="text-muted-foreground">Bookings</p>
            </div>
            <div>
              <p className="font-bold text-primary">{dbCounts.runs}</p>
              <p className="text-muted-foreground">Runs</p>
            </div>
            <div>
              <p className="font-bold text-primary">{dbCounts.sales}</p>
              <p className="text-muted-foreground">Sales</p>
            </div>
          </div>
        </div>

        {/* Last Sync Info */}
        {lastSyncLog && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Last sync: {new Date(lastSyncLog.created_at).toLocaleString()}</span>
            <Badge variant={lastSyncLog.status === 'success' ? 'default' : 'destructive'} className="text-xs">
              {lastSyncLog.records_synced} records
            </Badge>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button 
            onClick={handleImport} 
            disabled={isLoading}
            className="w-full"
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Import Historical Data
              </>
            )}
          </Button>

          <Button 
            onClick={handleResync} 
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            {isResyncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Re-syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Re-sync from Sheets (Update by ID)
              </>
            )}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                disabled={isLoading}
                className="w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Force Full Re-import
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will DELETE all existing records from the database and re-import everything from Google Sheets.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleForceReimport}>
                  Yes, Clear and Re-import
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Progress Indicator */}
        {isLoading && (
          <div className="text-center py-4">
            <Progress value={50} className="mb-2" />
            <p className="text-xs text-muted-foreground">Processing sheets data...</p>
          </div>
        )}

        {/* Import Results */}
        {importStats && (
          <div className="space-y-3">
            <div className="text-center py-3">
              <CheckCircle className="w-10 h-10 text-success mx-auto mb-2" />
              <p className="font-medium">Sync Complete!</p>
              <div className="flex gap-4 justify-center mt-2 text-sm">
                <span className="text-success">{totalImported} imported</span>
                {totalUpdated > 0 && <span className="text-primary">{totalUpdated} updated</span>}
                <span className="text-muted-foreground">{totalSkipped} skipped</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {['shifts', 'bookings', 'runs', 'sales'].map((table) => {
                const stats = importStats[table as keyof ImportStats] as { imported: number; skipped: number; updated: number; errors: number };
                return (
                  <div key={table} className="p-2 bg-muted/50 rounded text-center">
                    <p className="text-lg font-bold text-primary">{stats.imported}</p>
                    <p className="text-xs text-muted-foreground capitalize">{table}</p>
                    {(stats.updated || 0) > 0 && (
                      <p className="text-xs text-primary">+{stats.updated} updated</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Commission Summary */}
            {importStats.commissionSummary && (
              <div className="p-3 bg-success/10 rounded-lg border border-success/30">
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-success" />
                  Commission Summary
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Total Sales:</span>
                    <span className="ml-1 font-medium">{importStats.commissionSummary.totalSales}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">With Commission:</span>
                    <span className="ml-1 font-medium">{importStats.commissionSummary.withCommissionPresent}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Computed:</span>
                    <span className="ml-1 font-medium text-success">{importStats.commissionSummary.commissionComputed}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date Range:</span>
                    <span className="ml-1 font-medium">
                      {importStats.commissionSummary.earliestDateClosed || 'N/A'} - {importStats.commissionSummary.latestDateClosed || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Error Log */}
            {totalErrors > 0 && (
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                <button
                  className="flex items-center justify-between w-full"
                  onClick={() => setShowErrorLog(!showErrorLog)}
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    <span className="text-sm font-medium">{totalErrors} errors</span>
                  </div>
                  {showErrorLog ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {showErrorLog && importStats.errorLog.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto">
                    {importStats.errorLog.slice(0, 20).map((error, i) => (
                      <p key={i} className="text-xs text-destructive py-1 border-b border-destructive/10 last:border-0">
                        {error}
                      </p>
                    ))}
                    {importStats.errorLog.length > 20 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        ... and {importStats.errorLog.length - 20} more errors
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Imports from: app_shifts, app_intro_bookings, app_intro_runs, app_sales
        </p>
      </CardContent>
    </Card>
  );
}
