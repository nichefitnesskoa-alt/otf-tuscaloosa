/**
 * Bulk actions bar per day group.
 * Operates on all intros for a given day.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Check, UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ALL_STAFF } from '@/types';
import type { UpcomingIntroItem } from './myDayTypes';
import { filterNoQ, filterMissingOwner } from './myDaySelectors';
import { bulkSendQuestionnaires, bulkConfirmIntros, bulkAssignIntroOwner } from './myDayActions';

interface BulkActionsBarProps {
  items: UpcomingIntroItem[];
  userName: string;
  isOnline: boolean;
  onDone: () => void;
}

export default function BulkActionsBar({ items, userName, isOnline, onDone }: BulkActionsBarProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showOwnerSelect, setShowOwnerSelect] = useState(false);

  const noQItems = filterNoQ(items);
  const unconfirmedItems = items.filter(i => i.confirmedAt === null);
  const noOwnerItems = filterMissingOwner(items);

  const guardOnline = (fn: () => Promise<void>) => async () => {
    if (!isOnline) {
      toast.error('You are offline. This action requires network.');
      return;
    }
    await fn();
  };

  const handleBulkSendQ = guardOnline(async () => {
    setLoading('sendQ');
    try {
      const count = await bulkSendQuestionnaires(
        noQItems.map(i => i.bookingId),
        noQItems.map(i => ({ bookingId: i.bookingId, memberName: i.memberName, classDate: i.classDate })),
        userName,
      );
      toast.success(`Sent ${count} questionnaire${count !== 1 ? 's' : ''}`);
      onDone();
    } catch {
      toast.error('Bulk send failed');
    } finally {
      setLoading(null);
    }
  });

  const handleBulkConfirm = guardOnline(async () => {
    setLoading('confirm');
    try {
      const count = await bulkConfirmIntros(
        unconfirmedItems.map(i => i.bookingId),
        userName,
      );
      toast.success(`Confirmed ${count} intro${count !== 1 ? 's' : ''}`);
      onDone();
    } catch {
      toast.error('Bulk confirm failed');
    } finally {
      setLoading(null);
    }
  });

  const handleBulkAssignOwner = guardOnline(async () => {
    setShowOwnerSelect(true);
  });

  const handleOwnerSelected = async (owner: string) => {
    setShowOwnerSelect(false);
    setLoading('assign');
    try {
      const count = await bulkAssignIntroOwner(
        noOwnerItems.map(i => i.bookingId),
        owner,
        userName,
      );
      toast.success(`Assigned ${owner} to ${count} intro${count !== 1 ? 's' : ''}`);
      onDone();
    } catch {
      toast.error('Bulk assign failed');
    } finally {
      setLoading(null);
    }
  };

  if (noQItems.length === 0 && unconfirmedItems.length === 0 && noOwnerItems.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {noQItems.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px] gap-1"
          disabled={!!loading}
          onClick={handleBulkSendQ}
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
          onClick={handleBulkConfirm}
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
  );
}
