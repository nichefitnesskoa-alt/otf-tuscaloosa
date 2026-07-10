/**
 * Admin-only "Export buddy card leads to CSV" button.
 * Pulls every lead with is_buddy_card = true and downloads as .csv.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

function csvEscape(v: any): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function BuddyCardExportButton() {
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('created_at, first_name, last_name, phone, email, source, referred_by_member_name, referring_member_contact, stage, booked_intro_id, sourced_by_sa, notes')
        .eq('is_buddy_card', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = data || [];
      if (rows.length === 0) {
        toast.info('No buddy card leads yet');
        return;
      }
      const headers = [
        'Created', 'First Name', 'Last Name', 'Phone', 'Email',
        'Source', 'Referred By', 'Referring Contact', 'Stage',
        'Booking Linked', 'Sourced By', 'Notes',
      ];
      const lines = [headers.join(',')];
      rows.forEach((r: any) => {
        lines.push([
          r.created_at, r.first_name, r.last_name, r.phone, r.email,
          r.source, r.referred_by_member_name, r.referring_member_contact, r.stage,
          r.booked_intro_id ? 'yes' : 'no', r.sourced_by_sa, r.notes,
        ].map(csvEscape).join(','));
      });
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `buddy-card-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} buddy card leads`);
    } catch (e: any) {
      toast.error(`Export failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleExport} disabled={busy}>
      <Download className="w-4 h-4 mr-1" /> {busy ? 'Exporting…' : 'Export buddy cards (CSV)'}
    </Button>
  );
}
