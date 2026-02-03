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

interface ImportResults {
  shifts: { imported: number; skipped: number; errors: number };
  bookings: { imported: number; skipped: number; errors: number };
  runs: { imported: number; skipped: number; errors: number };
  sales: { imported: number; skipped: number; errors: number };
  errorLog: string[];
}

interface HistoricalDataImportProps {
  spreadsheetId: string;
  onImportComplete: () => void;
}

export default function HistoricalDataImport({ spreadsheetId, onImportComplete }: HistoricalDataImportProps) {
  const [step, setStep] = useState<'initial' | 'importing' | 'complete'>('initial');
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorLog, setShowErrorLog] = useState(false);

  const startImport = async () => {
    setIsLoading(true);
    setStep('importing');
    try {
      const { data, error } = await supabase.functions.invoke('sync-sheets', {
        body: {
          action: 'import_from_sheets',
          spreadsheetId,
        },
      });

      if (error) throw error;
      
      if (data?.success) {
        setImportResults({
          shifts: data.shifts || { imported: 0, skipped: 0, errors: 0 },
          bookings: data.bookings || { imported: 0, skipped: 0, errors: 0 },
          runs: data.runs || { imported: 0, skipped: 0, errors: 0 },
          sales: data.sales || { imported: 0, skipped: 0, errors: 0 },
          errorLog: data.errorLog || [],
        });
        setStep('complete');
        toast.success('Import complete!');
        onImportComplete();
      } else {
        throw new Error(data?.error || 'Import failed');
      }
    } catch (error) {
      console.error('Error importing:', error);
      toast.error('Import failed. Please check the error log.');
      setStep('initial');
    } finally {
      setIsLoading(false);
    }
  };

  const totalImported = importResults 
    ? importResults.shifts.imported + importResults.bookings.imported + 
      importResults.runs.imported + importResults.sales.imported
    : 0;
  const totalErrors = importResults
    ? importResults.shifts.errors + importResults.bookings.errors + 
      importResults.runs.errors + importResults.sales.errors
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Download className="w-4 h-4 text-primary" />
          Import from Google Sheets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'initial' && (
          <div className="text-center py-4">
            <FileSpreadsheet className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-2">
              Import data from your Google Sheet tabs:
            </p>
            <div className="flex flex-wrap gap-1 justify-center mb-4">
              <Badge variant="secondary">app_shifts</Badge>
              <Badge variant="secondary">app_intro_bookings</Badge>
              <Badge variant="secondary">app_intro_runs</Badge>
              <Badge variant="secondary">app_sales</Badge>
            </div>
            <Button onClick={startImport} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Import Data
                </>
              )}
            </Button>
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
              <CheckCircle className="w-12 h-12 text-success mx-auto mb-3" />
              <p className="font-medium">Import Complete!</p>
              <p className="text-2xl font-bold text-primary mt-1">
                {totalImported} records imported
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-xl font-bold text-primary">{importResults.shifts.imported}</p>
                <p className="text-xs text-muted-foreground">Shifts</p>
                {importResults.shifts.skipped > 0 && (
                  <p className="text-xs text-muted-foreground">
                    ({importResults.shifts.skipped} skipped)
                  </p>
                )}
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-xl font-bold text-primary">{importResults.bookings.imported}</p>
                <p className="text-xs text-muted-foreground">Bookings</p>
                {importResults.bookings.skipped > 0 && (
                  <p className="text-xs text-muted-foreground">
                    ({importResults.bookings.skipped} skipped)
                  </p>
                )}
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-xl font-bold text-primary">{importResults.runs.imported}</p>
                <p className="text-xs text-muted-foreground">Intro Runs</p>
                {importResults.runs.skipped > 0 && (
                  <p className="text-xs text-muted-foreground">
                    ({importResults.runs.skipped} skipped)
                  </p>
                )}
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-xl font-bold text-primary">{importResults.sales.imported}</p>
                <p className="text-xs text-muted-foreground">Sales</p>
                {importResults.sales.skipped > 0 && (
                  <p className="text-xs text-muted-foreground">
                    ({importResults.sales.skipped} skipped)
                  </p>
                )}
              </div>
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
