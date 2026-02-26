/**
 * Bulk actions bar per day group.
 * Phase 1: only questionnaire bulk send remains (confirm + assign removed per spec).
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { UpcomingIntroItem } from './myDayTypes';
import { filterNoQ } from './myDaySelectors';
import { bulkSendQuestionnaires } from './myDayActions';
import type { BulkResult } from './myDayActions';

interface BulkActionsBarProps {
  items: UpcomingIntroItem[];
  userName: string;
  isOnline: boolean;
  onDone: () => void;
}

function showBulkResultToast(action: string, result: BulkResult) {
  if (result.failCount === 0) {
    toast.success(`${action}: ${result.successCount} succeeded`);
  } else {
    const failPreview = result.failures.length > 0 ? ` (${result.failures.join(', ')}${result.failCount > 3 ? '…' : ''})` : '';
    toast.warning(`${action}: ${result.successCount} succeeded, ${result.failCount} failed${failPreview}`);
  }
}

export default function BulkActionsBar({ items, userName, isOnline, onDone }: BulkActionsBarProps) {
  const [loading, setLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ names: string[] } | null>(null);

  const noQItems = filterNoQ(items);

  const guardOnline = (fn: () => void) => () => {
    if (!isOnline) {
      toast.error('You are offline. This action requires network.');
      return;
    }
    fn();
  };

  const handleBulkSendQConfirm = guardOnline(() => {
    setConfirmDialog({ names: noQItems.map(i => i.memberName) });
  });

  const executeSendQ = async () => {
    if (!confirmDialog) return;
    setConfirmDialog(null);

    setLoading(true);
    try {
      const result = await bulkSendQuestionnaires(
        noQItems.map(i => i.bookingId),
        noQItems.map(i => ({ bookingId: i.bookingId, memberName: i.memberName, classDate: i.classDate })),
        userName,
      );
      showBulkResultToast('Send Q', result);
      onDone();
    } catch {
      toast.error('Bulk action failed');
    } finally {
      setLoading(false);
    }
  };

  if (noQItems.length === 0) return null;

  const title = `Send Q to ${confirmDialog?.names.length ?? 0} intro${(confirmDialog?.names.length ?? 0) !== 1 ? 's' : ''}?`;

  return (
    <>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px] gap-1"
          disabled={loading}
          onClick={handleBulkSendQConfirm}
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          Send {noQItems.length} Q{noQItems.length !== 1 ? 's' : ''}
        </Button>
      </div>

      <Dialog open={!!confirmDialog} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">{confirmDialog ? title : ''}</DialogTitle>
          </DialogHeader>
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {confirmDialog?.names.map((name, i) => (
              <p key={i} className="text-xs text-muted-foreground">• {name}</p>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDialog(null)}>Cancel</Button>
            <Button size="sm" onClick={executeSendQ}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
