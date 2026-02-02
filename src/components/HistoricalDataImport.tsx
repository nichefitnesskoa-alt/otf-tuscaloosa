import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Download, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PreviewData {
  headers: string[];
  rowCount: number;
  sampleRows: string[][];
}

interface ImportResults {
  shiftRecaps: { imported: number; skipped: number; errors: number };
  igLeads: { imported: number; skipped: number; errors: number };
  introsBooked?: { imported: number; skipped: number; errors: number };
  introsRun?: { imported: number; skipped: number; errors: number };
  errorLog: string[];
}

interface HistoricalDataImportProps {
  spreadsheetId: string;
  onImportComplete: () => void;
}

export default function HistoricalDataImport({ spreadsheetId, onImportComplete }: HistoricalDataImportProps) {
  const [step, setStep] = useState<'initial' | 'preview' | 'importing' | 'complete'>('initial');
  const [preview, setPreview] = useState<Record<string, PreviewData>>({});
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorLog, setShowErrorLog] = useState(false);

  const fetchPreview = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-sheets', {
        body: {
          action: 'read_sheets_preview',
          spreadsheetId,
        },
      });

      if (error) throw error;
      
      if (data?.preview) {
        setPreview(data.preview);
        setStep('preview');
      } else {
        toast.error('No data found in the spreadsheet');
      }
    } catch (error) {
      console.error('Error fetching preview:', error);
      toast.error('Failed to fetch spreadsheet data. Check the spreadsheet ID and permissions.');
    } finally {
      setIsLoading(false);
    }
  };

  const startImport = async () => {
    setStep('importing');
    try {
      const { data, error } = await supabase.functions.invoke('sync-sheets', {
        body: {
          action: 'import_historical_data',
          spreadsheetId,
        },
      });

      if (error) throw error;
      
      if (data?.importResults) {
        setImportResults(data.importResults);
        setStep('complete');
        toast.success('Import complete!');
        onImportComplete();
      }
    } catch (error) {
      console.error('Error importing:', error);
      toast.error('Import failed. Please check the error log.');
      setStep('preview');
    }
  };

  const totalToImport = Object.values(preview).reduce((sum, p) => sum + p.rowCount, 0);
  const totalImported = importResults 
    ? importResults.shiftRecaps.imported + importResults.igLeads.imported + (importResults.introsBooked?.imported || 0) + (importResults.introsRun?.imported || 0)
    : 0;
  const totalErrors = importResults
    ? importResults.shiftRecaps.errors + importResults.igLeads.errors + (importResults.introsBooked?.errors || 0) + (importResults.introsRun?.errors || 0)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Download className="w-4 h-4 text-primary" />
          Import Historical Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'initial' && (
          <div className="text-center py-4">
            <FileSpreadsheet className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Import existing data from your Google Sheet to populate the app with historical records.
            </p>
            <Button onClick={fetchPreview} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Import Historical Data
                </>
              )}
            </Button>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <p className="text-sm font-medium">Preview: Data to import</p>
            
            {Object.entries(preview).map(([tabName, data]) => (
              <div key={tabName} className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{tabName}</span>
                  <Badge variant="secondary">{data.rowCount} rows</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  <p className="mb-1">Columns: {data.headers.slice(0, 5).join(', ')}{data.headers.length > 5 ? '...' : ''}</p>
                </div>
              </div>
            ))}

            <div className="p-3 bg-primary/10 rounded-lg border border-primary/30">
              <p className="text-sm font-medium">Ready to import {totalToImport} records</p>
              <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                <li>• Duplicates will be automatically skipped</li>
                <li>• Original timestamps will be preserved</li>
                <li>• Data will be available in all dashboards</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button onClick={startImport} className="flex-1">
                <CheckCircle className="w-4 h-4 mr-2" />
                Start Import
              </Button>
              <Button variant="outline" onClick={() => setStep('initial')}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="text-center py-6">
            <Loader2 className="w-12 h-12 text-primary mx-auto mb-3 animate-spin" />
            <p className="font-medium">Importing data...</p>
            <p className="text-sm text-muted-foreground mt-1">
              This may take a few moments
            </p>
            <Progress value={50} className="mt-4" />
          </div>
        )}

        {step === 'complete' && importResults && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-primary mx-auto mb-3" />
              <p className="font-medium">Import Complete!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Historical data is now available in the app.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-2xl font-bold text-primary">{importResults.shiftRecaps.imported}</p>
                <p className="text-xs text-muted-foreground">Shift Recaps</p>
                {importResults.shiftRecaps.skipped > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ({importResults.shiftRecaps.skipped} skipped)
                  </p>
                )}
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-2xl font-bold text-primary">{importResults.igLeads.imported}</p>
                <p className="text-xs text-muted-foreground">IG Leads</p>
                {importResults.igLeads.skipped > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ({importResults.igLeads.skipped} skipped)
                  </p>
                )}
              </div>
              {importResults.introsBooked && (
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-primary">{importResults.introsBooked.imported}</p>
                  <p className="text-xs text-muted-foreground">Intros Booked</p>
                  {importResults.introsBooked.skipped > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ({importResults.introsBooked.skipped} skipped)
                    </p>
                  )}
                </div>
              )}
              {importResults.introsRun && (
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-primary">{importResults.introsRun.imported}</p>
                  <p className="text-xs text-muted-foreground">Intros Run</p>
                  {importResults.introsRun.skipped > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ({importResults.introsRun.skipped} skipped)
                    </p>
                  )}
                </div>
              )}
            </div>

            {totalErrors > 0 && (
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                <button
                  className="flex items-center justify-between w-full"
                  onClick={() => setShowErrorLog(!showErrorLog)}
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    <span className="text-sm font-medium">
                      {totalErrors} errors
                    </span>
                  </div>
                  {showErrorLog ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {showErrorLog && importResults.errorLog.length > 0 && (
                  <div className="mt-2 max-h-32 overflow-y-auto">
                    {importResults.errorLog.map((error, i) => (
                      <p key={i} className="text-xs text-destructive py-1">{error}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setStep('initial')}
            >
              Done
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
