import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { isMembershipSale } from '@/lib/sales-detection';
import { generateFollowUpEntries } from '@/components/dashboard/FollowUpQueue';
import { incrementAmcOnSale } from '@/lib/amc-auto';
import { useAuth } from '@/context/AuthContext';

const OBJECTIONS = ['Pricing', 'Time', 'Shopping Around', 'Spousal/Parental', 'Think About It', 'Out of Town', 'Other'];
const MEMBERSHIP_TYPES = ['Premier', 'Elite', 'Basic'];

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
  const [membershipType, setMembershipType] = useState(wasPurchased ? currentResult : 'Premier');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!outcome) return;
    setSaving(true);
    try {
      const saName = user?.name || 'Unknown';
      let newResult = '';
      if (outcome === 'purchased') newResult = membershipType || 'Premier';
      else if (outcome === 'didnt_buy') newResult = "Didn't Buy";
      else if (outcome === 'no_show') newResult = 'No-show';

      // Update intros_run record
      await supabase.from('intros_run')
        .update({
          result: newResult,
          primary_objection: outcome === 'didnt_buy' ? objection || null : null,
        })
        .eq('linked_intro_booked_id', bookingId);

      // Handle downstream effects based on transition
      const nowPurchased = outcome === 'purchased';
      const nowDidntBuy = outcome === 'didnt_buy';
      const nowNoShow = outcome === 'no_show';

      // Remove old follow-ups if transitioning away from no-show/didn't-buy
      if ((wasDidntBuy || wasNoShow) && nowPurchased) {
        await supabase.from('follow_up_queue').delete().eq('booking_id', bookingId);
      }

      // Update booking status
      if (nowPurchased) {
        await supabase.from('intros_booked')
          .update({ booking_status: 'Closed – Bought', closed_at: new Date().toISOString(), closed_by: saName })
          .eq('id', bookingId);
        if (!wasPurchased) {
          await incrementAmcOnSale(memberName, membershipType, saName);
        }
      } else {
        await supabase.from('intros_booked')
          .update({ booking_status: 'Active', closed_at: null, closed_by: null })
          .eq('id', bookingId);
      }

      // Create follow-ups if transitioning TO no-show/didn't-buy
      if ((nowDidntBuy || nowNoShow) && !wasDidntBuy && !wasNoShow) {
        const personType = nowNoShow ? 'no_show' : 'didnt_buy';
        const entries = generateFollowUpEntries(
          memberName, personType as 'no_show' | 'didnt_buy',
          classDate, bookingId, null, false,
          nowDidntBuy ? objection : null, null,
        );
        await supabase.from('follow_up_queue').insert(entries);
      }

      // If switching between didn't-buy and no-show, recreate follow-ups
      if ((wasDidntBuy && nowNoShow) || (wasNoShow && nowDidntBuy)) {
        await supabase.from('follow_up_queue').delete().eq('booking_id', bookingId);
        const personType = nowNoShow ? 'no_show' : 'didnt_buy';
        const entries = generateFollowUpEntries(
          memberName, personType as 'no_show' | 'didnt_buy',
          classDate, bookingId, null, false,
          nowDidntBuy ? objection : null, null,
        );
        await supabase.from('follow_up_queue').insert(entries);
      }

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
            {MEMBERSHIP_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
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
        <Button size="sm" className="h-7 text-[10px] flex-1" onClick={handleSave} disabled={saving || (outcome === 'didnt_buy' && !objection)}>
          {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => onDone()} disabled={saving}>Cancel</Button>
      </div>
    </div>
  );
}
