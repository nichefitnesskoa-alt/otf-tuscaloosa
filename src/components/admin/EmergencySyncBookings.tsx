import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SyncResult {
  success: boolean;
  synced?: number;
  updated?: number;
  errors?: number;
  total?: number;
  message?: string;
}

interface EmergencySyncBookingsProps {
  spreadsheetId: string;
  onSyncComplete?: () => void;
}

export default function EmergencySyncBookings({ spreadsheetId, onSyncComplete }: EmergencySyncBookingsProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const handleSync = async () => {
    if (!spreadsheetId) {
      toast.error('No spreadsheet ID configured');
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('sync-sheets', {
        body: {
          action: 'sync_all_bookings',
          spreadsheetId,
        },
      });

      if (error) throw error;

      setSyncResult(data);
      
      if (data.success) {
        toast.success('Bookings synced!', {
          description: data.message || `${data.synced} synced, ${data.updated} updated`,
        });
        onSyncComplete?.();
      } else {
        toast.error('Sync failed', {
          description: data.error || 'Unknown error',
        });
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync bookings');
      setSyncResult({ success: false, message: String(error) });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card className="border-warning/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          Emergency: Sync All Bookings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This will sync all bookings from the database to Google Sheets. 
          Use this to backfill bookings that weren't synced automatically.
        </p>

        <Button 
          onClick={handleSync} 
          disabled={isSyncing || !spreadsheetId}
          variant="outline"
          className="w-full"
        >
          {isSyncing ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync All Missing Bookings
            </>
          )}
        </Button>

        {syncResult && (
          <div className={`p-3 rounded-lg ${syncResult.success ? 'bg-success/10' : 'bg-destructive/10'}`}>
            <div className="flex items-center gap-2 mb-2">
              {syncResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-success" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-destructive" />
              )}
              <span className="font-medium">
                {syncResult.success ? 'Sync Complete' : 'Sync Failed'}
              </span>
            </div>
            
            {syncResult.success && (
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="outline">{syncResult.synced || 0} new</Badge>
                <Badge variant="outline">{syncResult.updated || 0} updated</Badge>
                {syncResult.errors !== undefined && syncResult.errors > 0 && (
                  <Badge variant="destructive">{syncResult.errors} errors</Badge>
                )}
                <Badge variant="secondary">{syncResult.total || 0} total</Badge>
              </div>
            )}
            
            {syncResult.message && (
              <p className="text-xs text-muted-foreground mt-2">{syncResult.message}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
