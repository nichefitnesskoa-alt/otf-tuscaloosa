import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { getSpreadsheetId } from '@/lib/sheets-sync';
import { toast } from 'sonner';
import { FileSpreadsheet, Loader2, CheckCircle, AlertTriangle, DatabaseBackup, TestTube } from 'lucide-react';

interface ImportResult {
  imported: number;
  skipped_duplicate: number;
  skipped_empty: number;
  errors: number;
  rows_scanned?: number;
  details?: string[];
}

export function LeadSheetImport() {
  const [loading, setLoading] = useState(false);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);
  const [lastMode, setLastMode] = useState<'import' | 'backfill'>('import');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleAction = async (mode: 'import' | 'backfill') => {
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) {
      toast.error('No spreadsheet ID configured. Set it in Data Sync settings first.');
      return;
    }

    const setLoadingFn = mode === 'backfill' ? setBackfillLoading : setLoading;
    setLoadingFn(true);
    setLastResult(null);
    setLastMode(mode);
    setErrorDetail(null);

    try {
      const { data, error } = await supabase.functions.invoke('import-sheet-leads', {
        body: { spreadsheetId, mode },
      });

      if (error) {
        // Extract the full error body
        let fullMessage = error.message || String(error);
        try {
          if ('context' in error && (error as any).context) {
            const ctx = (error as any).context;
            if (ctx instanceof Response) {
              const body = await ctx.text();
              fullMessage = body || fullMessage;
            }
          }
        } catch { /* ignore */ }
        setErrorDetail(fullMessage);
        toast.error(`${mode === 'backfill' ? 'Backfill' : 'Import'} failed`);
        return;
      }

      // Check if the function returned an error in the body
      if (data?.error) {
        setErrorDetail(JSON.stringify(data, null, 2));
        toast.error(`${mode === 'backfill' ? 'Backfill' : 'Import'} failed: ${data.error}`);
        return;
      }

      const result = data as ImportResult;
      setLastResult(result);

      if (result.imported > 0) {
        toast.success(`${mode === 'backfill' ? 'Backfill' : 'Import'}: ${result.imported} new records from sheet`);
      } else if (result.skipped_duplicate > 0) {
        toast.info('No new records — all rows already exist in the system');
      } else {
        toast.info('No records to import');
      }
    } catch (err) {
      console.error(`${mode} failed:`, err);
      setErrorDetail(String(err));
      toast.error(`${mode === 'backfill' ? 'Backfill' : 'Import'} failed`);
    } finally {
      setLoadingFn(false);
    }
  };

  const handleTest = async () => {
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) {
      toast.error('No spreadsheet ID configured.');
      return;
    }

    setTestLoading(true);
    setTestResult(null);
    setErrorDetail(null);

    try {
      const { data, error } = await supabase.functions.invoke('import-sheet-leads', {
        body: { spreadsheetId, mode: 'test' },
      });

      if (error) {
        let fullMessage = error.message || String(error);
        try {
          if ('context' in error && (error as any).context) {
            const ctx = (error as any).context;
            if (ctx instanceof Response) {
              const body = await ctx.text();
              fullMessage = body || fullMessage;
            }
          }
        } catch { /* ignore */ }
        setTestResult(`ERROR:\n${fullMessage}`);
        return;
      }

      setTestResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setTestResult(`EXCEPTION:\n${String(err)}`);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="w-4 h-4" />
          Lead Sheet Import
        </CardTitle>
        <CardDescription>
          Pull leads and bookings from the "OTF Lead Intake" tab. Runs automatically every minute, or trigger manually below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => handleAction('import')} disabled={loading || backfillLoading || testLoading} size="sm">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
            {loading ? 'Importing…' : 'Import Now'}
          </Button>
          <Button onClick={() => handleAction('backfill')} disabled={loading || backfillLoading || testLoading} size="sm" variant="outline">
            {backfillLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DatabaseBackup className="w-4 h-4 mr-2" />}
            {backfillLoading ? 'Scanning…' : 'Audit & Backfill Missing Leads'}
          </Button>
          <Button onClick={handleTest} disabled={loading || backfillLoading || testLoading} size="sm" variant="secondary">
            {testLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TestTube className="w-4 h-4 mr-2" />}
            {testLoading ? 'Testing…' : 'Test Connection'}
          </Button>
        </div>

        {errorDetail && (
          <div className="text-sm p-3 rounded-md bg-destructive/10 border border-destructive/30 space-y-1">
            <div className="flex items-center gap-2 font-medium text-destructive">
              <AlertTriangle className="w-4 h-4" />
              Error Details
            </div>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all max-h-60 overflow-y-auto font-mono">
              {errorDetail}
            </pre>
          </div>
        )}

        {testResult && (
          <div className="text-sm p-3 rounded-md bg-muted border space-y-1">
            <div className="flex items-center gap-2 font-medium">
              <TestTube className="w-4 h-4" />
              Test Connection Result
            </div>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all max-h-80 overflow-y-auto font-mono">
              {testResult}
            </pre>
          </div>
        )}

        {lastResult && (
          <div className="text-sm space-y-1 p-3 rounded-md bg-muted">
            <div className="flex items-center gap-2">
              {lastResult.errors > 0 ? (
                <AlertTriangle className="w-4 h-4 text-destructive" />
              ) : (
                <CheckCircle className="w-4 h-4 text-green-600" />
              )}
              <span className="font-medium">
                {lastMode === 'backfill' && lastResult.rows_scanned != null && (
                  <>{lastResult.rows_scanned} rows scanned · </>
                )}
                {lastResult.imported} imported · {lastResult.skipped_duplicate} duplicates · {lastResult.skipped_empty} empty · {lastResult.errors} errors
              </span>
            </div>
            {lastResult.details && lastResult.details.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-muted-foreground text-xs">Show details ({lastResult.details.length} rows)</summary>
                <ul className="mt-1 text-xs text-muted-foreground space-y-0.5 max-h-40 overflow-y-auto">
                  {lastResult.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
