import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { isMembershipSale } from '@/lib/sales-detection';
import { applyIntroOutcomeUpdate } from '@/lib/outcome-update';
import { useAuth } from '@/context/AuthContext';

const OBJECTIONS = ['Pricing', 'Time', 'Shopping Around', 'Spousal/Parental', 'Think About It', 'Out of Town', 'Other'];

const MEMBERSHIP_OPTIONS = [
  { label: 'Premier + OTBeat', commission: 15.00 },
  { label: 'Premier w/o OTBeat', commission: 7.50 },
  { label: 'Elite + OTBeat', commission: 12.00 },
  { label: 'Elite w/o OTBeat', commission: 6.00 },
  { label: 'Basic + OTBeat', commission: 9.00 },
  { label: 'Basic w/o OTBeat', commission: 3.00 },
] as const;

interface OutcomeEditorProps {
  bookingId: string;
  memberName: string;
  classDate: string;
  currentResult: string;
  currentObjection: string | null;
  onDone: () => void;
}

export function OutcomeEditor({ bookingId, memberName, classDate, currentResult, currentObjection, onDone }: OutcomeEditorProps) {
  const { user } = useAuth();
  const wasPurchased = isMembershipSale(currentResult);
  const wasDidntBuy = currentResult === "Didn't Buy";
  const wasNoShow = currentResult === 'No-show';

  const initialOutcome = wasPurchased ? 'purchased' : wasDidntBuy ? 'didnt_buy' : wasNoShow ? 'no_show' : '';
  const [outcome, setOutcome] = useState(initialOutcome);
  const [objection, setObjection] = useState(currentObjection || '');
  const initialMembership = wasPurchased
    ? (MEMBERSHIP_OPTIONS.find(m => m.label === currentResult)?.label || MEMBERSHIP_OPTIONS[0].label)
    : MEMBERSHIP_OPTIONS[0].label;
  const [membershipType, setMembershipType] = useState<string>(initialMembership);
  const [saving, setSaving] = useState(false);

  const selectedOption = MEMBERSHIP_OPTIONS.find(m => m.label === membershipType);

  const handleSave = async () => {
    if (!outcome) return;
    setSaving(true);
    try {
      const saName = user?.name || 'Unknown';
      let newResult = '';
      let newCommission = 0;
      if (outcome === 'purchased') {
        newResult = membershipType;
        newCommission = selectedOption?.commission || 0;
      } else if (outcome === 'didnt_buy') {
        newResult = "Didn't Buy";
      } else if (outcome === 'no_show') {
        newResult = 'No-show';
      }

      const result = await applyIntroOutcomeUpdate({
        bookingId,
        memberName,
        classDate,
        newResult,
        previousResult: currentResult,
        membershipType: outcome === 'purchased' ? membershipType : undefined,
        commissionAmount: newCommission,
        objection: outcome === 'didnt_buy' ? objection || null : null,
        editedBy: saName,
        sourceComponent: 'OutcomeEditor',
        editReason: `Outcome changed from ${currentResult} to ${newResult} via MyDay`,
      });

      if (!result.success) throw new Error(result.error);

      toast.success(`Outcome updated to ${newResult}`);
      onDone();
    } catch (err) {
      console.error('Outcome edit error:', err);
      toast.error('Failed to update outcome');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 p-2 rounded border bg-muted/30 space-y-2" onClick={e => e.stopPropagation()}>
      <div className="grid grid-cols-3 gap-1.5">
        <Button variant={outcome === 'purchased' ? 'default' : 'outline'} size="sm" className="h-7 text-[10px]" onClick={() => setOutcome('purchased')}>Purchased</Button>
        <Button variant={outcome === 'didnt_buy' ? 'default' : 'outline'} size="sm" className="h-7 text-[10px]" onClick={() => setOutcome('didnt_buy')}>Didn't Buy</Button>
        <Button variant={outcome === 'no_show' ? 'default' : 'outline'} size="sm" className="h-7 text-[10px]" onClick={() => setOutcome('no_show')}>No Show</Button>
      </div>
      {outcome === 'purchased' && (
        <Select value={membershipType} onValueChange={setMembershipType}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MEMBERSHIP_OPTIONS.map(m => (
              <SelectItem key={m.label} value={m.label} className="text-xs">
                {m.label} (${m.commission.toFixed(2)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {outcome === 'didnt_buy' && (
        <Select value={objection} onValueChange={setObjection}>
          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select objection" /></SelectTrigger>
          <SelectContent>
            {OBJECTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <div className="flex gap-1.5">
        <Button size="sm" className="h-7 text-[10px] flex-1" onClick={handleSave} disabled={saving || (outcome === 'purchased' && !membershipType) || (outcome === 'didnt_buy' && !objection)}>
          {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => onDone()} disabled={saving}>Cancel</Button>
      </div>
    </div>
  );
}
