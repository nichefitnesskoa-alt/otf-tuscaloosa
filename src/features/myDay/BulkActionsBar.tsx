/**
 * Bulk actions bar per day group.
 * Shows confirmation modal with preview counts before executing.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Send, Check, UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ALL_STAFF } from '@/types';
import type { UpcomingIntroItem } from './myDayTypes';
import { filterNoQ, filterMissingOwner } from './myDaySelectors';
import { bulkSendQuestionnaires, bulkConfirmIntros, bulkAssignIntroOwner } from './myDayActions';
import type { BulkResult } from './myDayActions';

interface BulkActionsBarProps {
  items: UpcomingIntroItem[];
  userName: string;
  isOnline: boolean;
  onDone: () => void;
}

type ConfirmAction = 'sendQ' | 'confirm' | 'assign';

function showBulkResultToast(action: string, result: BulkResult) {
  if (result.failCount === 0) {
    toast.success(`${action}: ${result.successCount} succeeded`);
  } else {
    const failPreview = result.failures.length > 0 ? ` (${result.failures.join(', ')}${result.failCount > 3 ? '…' : ''})` : '';
    toast.warning(`${action}: ${result.successCount} succeeded, ${result.failCount} failed${failPreview}`);
  }
}

export default function BulkActionsBar({ items, userName, isOnline, onDone }: BulkActionsBarProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showOwnerSelect, setShowOwnerSelect] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ action: ConfirmAction; names: string[]; owner?: string } | null>(null);

  const noQItems = filterNoQ(items);
  const unconfirmedItems = items.filter(i => i.confirmedAt === null);
  const noOwnerItems = filterMissingOwner(items);

  const guardOnline = (fn: () => void) => () => {
    if (!isOnline) {
      toast.error('You are offline. This action requires network.');
      return;
    }
    fn();
  };

  const handleBulkSendQConfirm = guardOnline(() => {
    setConfirmDialog({
      action: 'sendQ',
      names: noQItems.map(i => i.memberName),
    });
  });

  const handleBulkConfirmConfirm = guardOnline(() => {
    setConfirmDialog({
      action: 'confirm',
      names: unconfirmedItems.map(i => i.memberName),
    });
  });

  const handleBulkAssignOwner = guardOnline(() => {
    setShowOwnerSelect(true);
  });

  const handleOwnerSelected = (owner: string) => {
    setShowOwnerSelect(false);
    setConfirmDialog({
      action: 'assign',
      names: noOwnerItems.map(i => i.memberName),
      owner,
    });
  };

  const executeAction = async () => {
    if (!confirmDialog) return;
    const { action, owner } = confirmDialog;
    setConfirmDialog(null);

    setLoading(action);
    try {
      let result: BulkResult;
      switch (action) {
        case 'sendQ':
          result = await bulkSendQuestionnaires(
            noQItems.map(i => i.bookingId),
            noQItems.map(i => ({ bookingId: i.bookingId, memberName: i.memberName, classDate: i.classDate })),
            userName,
          );
          showBulkResultToast('Send Q', result);
          break;
        case 'confirm':
          result = await bulkConfirmIntros(
            unconfirmedItems.map(i => i.bookingId),
            userName,
          );
          showBulkResultToast('Confirm', result);
          break;
        case 'assign':
          result = await bulkAssignIntroOwner(
            noOwnerItems.map(i => i.bookingId),
            owner!,
            userName,
          );
          showBulkResultToast(`Assign ${owner}`, result);
          break;
      }
      onDone();
    } catch {
      toast.error('Bulk action failed');
    } finally {
      setLoading(null);
    }
  };

  if (noQItems.length === 0 && unconfirmedItems.length === 0 && noOwnerItems.length === 0) {
    return null;
  }

  const confirmTitle: Record<ConfirmAction, string> = {
    sendQ: `Send Q to ${confirmDialog?.names.length ?? 0} intro${(confirmDialog?.names.length ?? 0) !== 1 ? 's' : ''}?`,
    confirm: `Confirm ${confirmDialog?.names.length ?? 0} intro${(confirmDialog?.names.length ?? 0) !== 1 ? 's' : ''}?`,
    assign: `Assign ${confirmDialog?.owner} to ${confirmDialog?.names.length ?? 0} intro${(confirmDialog?.names.length ?? 0) !== 1 ? 's' : ''}?`,
  };

  return (
    <>
      <div className="flex items-center gap-1.5 flex-wrap">
        {noQItems.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1"
            disabled={!!loading}
            onClick={handleBulkSendQConfirm}
          >
            {loading === 'sendQ' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            Send {noQItems.length} Q{noQItems.length !== 1 ? 's' : ''}
          </Button>
        )}

        {unconfirmedItems.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1"
            disabled={!!loading}
            onClick={handleBulkConfirmConfirm}
          >
            {loading === 'confirm' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Confirm {unconfirmedItems.length}
          </Button>
        )}

        {noOwnerItems.length > 0 && !showOwnerSelect && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1"
            disabled={!!loading}
            onClick={handleBulkAssignOwner}
          >
            {loading === 'assign' ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
            Assign {noOwnerItems.length}
          </Button>
        )}

        {showOwnerSelect && (
          <Select onValueChange={handleOwnerSelected}>
            <SelectTrigger className="h-7 w-[140px] text-[11px]">
              <SelectValue placeholder="Select owner" />
            </SelectTrigger>
            <SelectContent>
              {ALL_STAFF.map(s => (
                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Confirmation modal */}
      <Dialog open={!!confirmDialog} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {confirmDialog ? confirmTitle[confirmDialog.action] : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {confirmDialog?.names.map((name, i) => (
              <p key={i} className="text-xs text-muted-foreground">• {name}</p>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDialog(null)}>Cancel</Button>
            <Button size="sm" onClick={executeAction}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
