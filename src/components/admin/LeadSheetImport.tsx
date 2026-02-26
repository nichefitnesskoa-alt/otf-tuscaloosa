import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { getSpreadsheetId } from '@/lib/sheets-sync';
import { toast } from 'sonner';
import { FileSpreadsheet, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

interface ImportResult {
  imported: number;
  skipped_duplicate: number;
  skipped_empty: number;
  errors: number;
  details?: string[];
}

export function LeadSheetImport() {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);

  const handleImport = async () => {
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) {
      toast.error('No spreadsheet ID configured. Set it in Data Sync settings first.');
      return;
    }

    setLoading(true);
    setLastResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('import-sheet-leads', {
        body: { spreadsheetId },
      });

      if (error) throw error;

      const result = data as ImportResult;
      setLastResult(result);

      if (result.imported > 0) {
        toast.success(`Imported ${result.imported} new records from sheet`);
      } else if (result.skipped_duplicate > 0) {
        toast.info('No new records — all rows already exist in the system');
      } else {
        toast.info('No records to import');
      }
    } catch (err) {
      console.error('Import failed:', err);
      toast.error('Import failed: ' + String(err));
    } finally {
      setLoading(false);
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
        <Button onClick={handleImport} disabled={loading} size="sm">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
          {loading ? 'Importing…' : 'Import Now'}
        </Button>

        {lastResult && (
          <div className="text-sm space-y-1 p-3 rounded-md bg-muted">
            <div className="flex items-center gap-2">
              {lastResult.errors > 0 ? (
                <AlertTriangle className="w-4 h-4 text-destructive" />
              ) : (
                <CheckCircle className="w-4 h-4 text-green-600" />
              )}
              <span className="font-medium">
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
