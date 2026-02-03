import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileSpreadsheet, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SheetsSyncTestProps {
  spreadsheetId: string;
}

export default function SheetsSyncTest({ spreadsheetId }: SheetsSyncTestProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    fetchLastSync();
  }, []);

  const fetchLastSync = async () => {
    const { data } = await supabase
      .from('sheets_sync_log')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (data) {
      setLastSyncTime(data.created_at);
    }
  };

  const handleTestWrite = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-sheets', {
        body: {
          action: 'test_write',
          spreadsheetId,
        },
      });

      if (error) throw error;
      
      if (data?.success) {
        setTestResult('success');
        toast.success('Sheet write test passed!');
        await fetchLastSync();
      } else {
        throw new Error(data?.error || 'Test failed');
      }
    } catch (error) {
      console.error('Test write error:', error);
      setTestResult('error');
      toast.error('Sheet write test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-success" />
          Sheets Sync Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Last Sync Time */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">Last Sheet Sync</span>
          </div>
          <Badge variant="outline">
            {lastSyncTime ? formatTimestamp(lastSyncTime) : 'Never'}
          </Badge>
        </div>

        {/* Connection Status */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <span className="text-sm">Connection Status</span>
          <Badge variant={spreadsheetId ? 'default' : 'secondary'}>
            {spreadsheetId ? 'Connected' : 'Not Connected'}
          </Badge>
        </div>

        {/* Test Write Button */}
        <Button 
          onClick={handleTestWrite}
          disabled={isTesting || !spreadsheetId}
          variant="outline"
          className="w-full"
        >
          {isTesting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Test Write to Sheets
            </>
          )}
        </Button>

        {/* Test Result */}
        {testResult && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            testResult === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
          }`}>
            {testResult === 'success' ? (
              <>
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Write test passed!</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5" />
                <span className="font-medium">Write test failed</span>
              </>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Writes a test row to verify sheet connection
        </p>
      </CardContent>
    </Card>
  );
}
