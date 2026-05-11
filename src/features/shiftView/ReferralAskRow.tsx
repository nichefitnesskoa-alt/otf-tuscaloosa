import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { List, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAllReferralAsks, logReferralAsk, findRecentAsk } from './useReferralAsks';
import { ReferralAskHistorySheet } from './ReferralAskHistorySheet';
import { toast } from 'sonner';
import type { ShiftType } from './ShiftSelector';

interface Props {
  shiftType: ShiftType;
  // Mark the linked template task as completed when an ask is saved.
  onLogged?: () => void;
}

export function ReferralAskRow({ shiftType, onLogged }: Props) {
  const { user } = useAuth();
  const { asks } = useAllReferralAsks();
  const [member, setMember] = useState('');
  const [friend, setFriend] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Distinct historical member names for the datalist.
  const memberSuggestions = useMemo(() => {
    const set = new Set<string>();
    asks.forEach(a => set.add(a.member_name));
    return Array.from(set).sort();
  }, [asks]);

  const recent = useMemo(() => findRecentAsk(asks, member, 30), [asks, member]);

  const save = async () => {
    if (!user?.name || !member.trim()) {
      toast.error('Add a member name first');
      return;
    }
    setSaving(true);
    try {
      await logReferralAsk({
        sa_name: user.name,
        member_name: member,
        friend_name: friend,
        shift_date: format(new Date(), 'yyyy-MM-dd'),
        shift_type: shiftType,
      });
      setMember('');
      setFriend('');
      toast.success('Ask logged');
      onLogged?.();
    } catch (e) {
      toast.error('Could not save ask');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-3 border-border">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-sm font-medium">Ask a member if they have a friend who wants a free class</p>
          <p className="text-[11px] text-muted-foreground">
            Log every ask. We'll flag if you've asked the same person recently.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 gap-1 text-xs shrink-0"
          onClick={() => setHistoryOpen(true)}
        >
          <List className="w-3.5 h-3.5" />
          History
        </Button>
      </div>

      <datalist id="referral-member-suggestions">
        {memberSuggestions.map(n => <option key={n} value={n} />)}
      </datalist>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          list="referral-member-suggestions"
          placeholder="Member name"
          value={member}
          onChange={e => setMember(e.target.value)}
          className="h-9 text-sm"
        />
        <Input
          placeholder="Friend name (optional)"
          value={friend}
          onChange={e => setFriend(e.target.value)}
          className="h-9 text-sm"
        />
      </div>

      {recent && (
        <div className="flex items-center gap-1.5 mt-2 text-[11px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3 h-3" />
          You already asked {recent.member_name} on {format(new Date(recent.asked_at), 'MMM d')}.
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          onClick={save}
          disabled={saving || !member.trim()}
          className="h-9 px-4 text-xs"
        >
          {saving ? 'Saving…' : 'Save ask'}
        </Button>
      </div>

      <ReferralAskHistorySheet open={historyOpen} onOpenChange={setHistoryOpen} />
    </Card>
  );
}
