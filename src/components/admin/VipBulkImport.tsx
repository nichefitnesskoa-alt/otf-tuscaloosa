import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Upload, Star, CheckCircle, AlertTriangle, Link, Copy } from 'lucide-react';

interface ParsedRow {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthday?: string;
  weightLbs?: number;
  error?: string;
}

export default function VipBulkImport() {
  const [rawText, setRawText] = useState('');
  const [vipClassName, setVipClassName] = useState('');
  const [urlClassName, setUrlClassName] = useState('');

  const generatedUrl = urlClassName.trim()
    ? `${window.location.origin}/vip-register?class=${encodeURIComponent(urlClassName.trim())}`
    : '';

  const copyUrl = () => {
    if (generatedUrl) {
      navigator.clipboard.writeText(generatedUrl);
      toast.success('Link copied!');
    }
  };
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; skipped: number; errors: number } | null>(null);

  const parseInput = () => {
    const lines = rawText.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) {
      toast.error('No data to import');
      return;
    }

    const rows: ParsedRow[] = lines.map(line => {
      // Support tab-separated or comma-separated
      const parts = line.includes('\t') ? line.split('\t') : line.split(',');
      const trimmed = parts.map(p => p.trim());

      if (trimmed.length < 3) {
        return { firstName: trimmed[0] || '', lastName: trimmed[1] || '', phone: '', email: '', error: 'Need at least: First Name, Last Name, Phone' };
      }

      const row: ParsedRow = {
        firstName: trimmed[0],
        lastName: trimmed[1],
        phone: trimmed[2],
        email: trimmed[3] || '',
      };

      // Optional: birthday (index 4), weight (index 5)
      if (trimmed[4]) row.birthday = trimmed[4];
      if (trimmed[5]) row.weightLbs = parseInt(trimmed[5]) || undefined;

      if (!row.firstName || !row.lastName) {
        row.error = 'Missing name';
      }
      if (!row.phone) {
        row.error = 'Missing phone number';
      }

      return row;
    });

    setParsed(rows);
    setShowPreview(true);
    setImportResult(null);
  };

  const handleImport = async () => {
    const validRows = parsed.filter(r => !r.error);
    if (validRows.length === 0) {
      toast.error('No valid rows to import');
      return;
    }

    setImporting(true);
    let success = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of validRows) {
      try {
        const memberName = `${row.firstName} ${row.lastName}`;
        const memberKey = memberName.toLowerCase().replace(/\s+/g, '');

        // Check for existing booking with same name + VIP Class
        const { data: existing } = await supabase
          .from('intros_booked')
          .select('id')
          .eq('lead_source', 'VIP Class')
          .ilike('member_name', memberName)
          .limit(1);

        if (existing && existing.length > 0) {
          skipped++;
          continue;
        }

        const today = new Date().toISOString().split('T')[0];

        // Create booking
        const { data: booking, error: bookingError } = await supabase
          .from('intros_booked')
          .insert({
            member_name: memberName,
            class_date: today,
            coach_name: 'TBD',
            sa_working_shift: 'VIP Registration',
            lead_source: 'VIP Class',
            booked_by: 'Bulk Import',
            booking_status: 'Active',
            vip_class_name: vipClassName || null,
          } as any)
          .select('id')
          .single();

        if (bookingError) throw bookingError;

        // Create vip_registration
        await supabase
          .from('vip_registrations')
          .insert({
            first_name: row.firstName,
            last_name: row.lastName,
            email: row.email || null,
            phone: row.phone,
            birthday: row.birthday || null,
            weight_lbs: row.weightLbs || null,
            booking_id: booking.id,
            vip_class_name: vipClassName || null,
          } as any);

        success++;
      } catch (err) {
        console.error('Import error for row:', row, err);
        errors++;
      }
    }

    setImportResult({ success, skipped, errors });
    setImporting(false);
    if (success > 0) toast.success(`Imported ${success} VIP client(s)`);
  };

  return (
    <div className="space-y-4">
      {/* URL Generator */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Link className="w-4 h-4 text-primary" />
            VIP Registration Link Generator
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Type a class name to generate a shareable registration link
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="e.g. Miss Alabama"
            value={urlClassName}
            onChange={e => setUrlClassName(e.target.value)}
            className="text-sm"
          />
          {generatedUrl && (
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md truncate">{generatedUrl}</code>
              <Button onClick={copyUrl} size="sm" variant="outline" className="shrink-0">
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Import */}
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="w-4 h-4 text-purple-600" />
          VIP Bulk Import
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Paste spreadsheet data to bulk-add VIP clients. Columns: First Name, Last Name, Phone, Email (optional: Birthday, Weight)
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="vipClassName" className="text-xs font-medium">VIP Class Name</Label>
          <Input
            id="vipClassName"
            placeholder="e.g. Miss Alabama, Chamber of Commerce"
            value={vipClassName}
            onChange={e => setVipClassName(e.target.value)}
            className="text-sm"
          />
          <p className="text-[10px] text-muted-foreground">Applied to all imported rows. Leave blank if ungrouped.</p>
        </div>
        <Textarea
          placeholder={`John\tDoe\t555-123-4567\tjohn@email.com\t1990-01-15\t180\nJane\tSmith\t555-987-6543\tjane@email.com`}
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          rows={6}
          className="font-mono text-xs"
        />

        <div className="flex gap-2">
          <Button onClick={parseInput} variant="outline" size="sm" disabled={!rawText.trim()}>
            Preview Import
          </Button>
          {showPreview && parsed.filter(r => !r.error).length > 0 && (
            <Button onClick={handleImport} size="sm" disabled={importing} className="bg-purple-600 hover:bg-purple-700">
              {importing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
              Import {parsed.filter(r => !r.error).length} Client(s)
            </Button>
          )}
        </div>

        {importResult && (
          <div className="flex gap-3 text-sm">
            {importResult.success > 0 && (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                <CheckCircle className="w-3 h-3 mr-1" />
                {importResult.success} imported
              </Badge>
            )}
            {importResult.skipped > 0 && (
              <Badge variant="secondary">
                {importResult.skipped} skipped (duplicate)
              </Badge>
            )}
            {importResult.errors > 0 && (
              <Badge variant="destructive">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {importResult.errors} error(s)
              </Badge>
            )}
          </div>
        )}

        {showPreview && parsed.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Phone</TableHead>
                  <TableHead className="text-xs">Email</TableHead>
                  <TableHead className="text-xs">Birthday</TableHead>
                  <TableHead className="text-xs">Weight</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.map((row, i) => (
                  <TableRow key={i} className={row.error ? 'bg-destructive/10' : ''}>
                    <TableCell className="text-xs">{row.firstName} {row.lastName}</TableCell>
                    <TableCell className="text-xs">{row.phone}</TableCell>
                    <TableCell className="text-xs">{row.email}</TableCell>
                    <TableCell className="text-xs">{row.birthday || '-'}</TableCell>
                    <TableCell className="text-xs">{row.weightLbs || '-'}</TableCell>
                    <TableCell className="text-xs">
                      {row.error ? (
                        <span className="text-destructive">{row.error}</span>
                      ) : (
                        <span className="text-emerald-600">Ready</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
