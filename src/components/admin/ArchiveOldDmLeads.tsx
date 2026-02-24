/**
 * Admin Data Tool: Archive old DM leads.
 * Sets stage='archived' on DM/IG leads older than 30 days that haven't converted.
 */
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Instagram } from 'lucide-react';
import { toast } from 'sonner';

const PROTECTED_STAGES = ['booked', 'won', 'already_in_system'];
const DM_PATTERNS = ['Instagram DM', 'DM', 'Direct Message', 'instagram', 'ig dm'];

export default function ArchiveOldDmLeads() {
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const getMatchingLeads = async () => {
    // Fetch all leads that could match — filter DM sources client-side
    const { data, error } = await supabase
      .from('leads')
      .select('id, source, stage, created_at')
      .lt('created_at', cutoffDate)
      .not('stage', 'in', `(${PROTECTED_STAGES.join(',')})`)
      .neq('stage', 'archived');

    if (error) throw error;

    return (data || []).filter(l =>
      DM_PATTERNS.some(p => (l.source || '').toLowerCase().includes(p.toLowerCase()))
    );
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setResult(null);
    try {
      const matches = await getMatchingLeads();
      setPreviewCount(matches.length);
    } catch (err: any) {
      toast.error(err?.message || 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const handleArchive = async () => {
    setRunning(true);
    try {
      const matches = await getMatchingLeads();
      if (matches.length === 0) {
        toast.success('No leads to archive');
        setResult(0);
        setRunning(false);
        return;
      }
      const ids = matches.map(m => m.id);

      // Batch update in chunks of 100
      let archived = 0;
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const { error } = await supabase
          .from('leads')
          .update({ stage: 'archived' })
          .in('id', chunk);
        if (error) throw error;
        archived += chunk.length;
      }

      setResult(archived);
      setPreviewCount(null);
      toast.success(`Archived ${archived} leads. Lead source history preserved.`);
    } catch (err: any) {
      toast.error(err?.message || 'Archive failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Instagram className="w-4 h-4" />
          Archive Old DM Leads
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Sets stage to "archived" on all Instagram DM / social media leads older than 30 days. Converted leads (booked, won, already in system) are excluded. Archived leads remain in the database for historical reporting.
        </p>

        {previewCount === null ? (
          <Button size="sm" onClick={handlePreview} disabled={previewing} variant="outline">
            {previewing ? 'Checking…' : 'Preview — see how many would be archived'}
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              This will archive <span className="text-primary font-bold">{previewCount}</span> lead{previewCount !== 1 ? 's' : ''}. Converted leads are excluded.
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleArchive} disabled={running || previewCount === 0} variant="default">
                {running ? 'Archiving…' : 'Confirm Archive'}
              </Button>
              <Button size="sm" onClick={() => setPreviewCount(null)} variant="outline" disabled={running}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {result !== null && (
          <p className="text-sm text-muted-foreground">
            Archived {result} leads. Lead source history preserved.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
