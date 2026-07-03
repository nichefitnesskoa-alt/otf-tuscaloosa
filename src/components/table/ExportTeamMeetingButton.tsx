import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Copy, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useActiveOwners, useOwnerEntries } from '@/hooks/useTheTable';
import { buildOwnItExport, ownItExportFilename } from '@/lib/table/exportOwnIt';
import { fetchReferralsExportData, type ReferralsExportData } from '@/lib/table/exportReferrals';

interface Props {
  meetingId: string;
  meetingDate: string;
}

export function ExportTeamMeetingButton({ meetingId, meetingDate }: Props) {
  const { data: owners = [] } = useActiveOwners();
  const { data: entries = [] } = useOwnerEntries(meetingId);
  const [open, setOpen] = useState(false);
  const [referrals, setReferrals] = useState<ReferralsExportData | undefined>();

  useEffect(() => {
    let cancelled = false;
    fetchReferralsExportData(meetingDate)
      .then(d => { if (!cancelled) setReferrals(d); })
      .catch(() => { /* non-fatal */ });
    return () => { cancelled = true; };
  }, [meetingDate]);

  const submittedCount = useMemo(() => {
    const ownerIds = new Set(owners.filter(o => !o.is_architect).map(o => o.id));
    return entries.filter(e => e.submitted_at && ownerIds.has(e.owner_id)).length;
  }, [owners, entries]);

  const text = useMemo(
    () => buildOwnItExport({ meetingDate, owners, entries, referrals }),
    [meetingDate, owners, entries, referrals]
  );

  const disabled = submittedCount === 0;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Copy failed');
    }
  };

  const onDownload = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = ownItExportFilename(meetingDate);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Downloaded');
  };

  if (!open) {
    return (
      <Button
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="bg-[#E8540A] hover:bg-[#E8540A]/90 text-primary-foreground h-11 gap-2"
      >
        <FileText className="w-4 h-4" />
        {disabled ? (
          'No submissions yet'
        ) : (
          <>
            Export Team Meeting
            <span className="ml-1 inline-flex items-center rounded-full bg-[#A03A05] px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
              {submittedCount} submitted
            </span>
          </>
        )}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        onClick={onCopy}
        className="bg-[#E8540A] hover:bg-[#E8540A]/90 text-primary-foreground h-11 gap-2"
      >
        <Copy className="w-4 h-4" /> Copy to clipboard
      </Button>
      <Button
        size="sm"
        onClick={onDownload}
        className="bg-[#E8540A] hover:bg-[#E8540A]/90 text-primary-foreground h-11 gap-2"
      >
        <Download className="w-4 h-4" /> Download .txt
      </Button>
      <Button size="sm" variant="ghost" className="h-11" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}
