import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { generateFollowUpEntries } from '@/components/dashboard/FollowUpQueue';
import { incrementAmcOnSale } from '@/lib/amc-auto';

interface InlineIntroLoggerProps {
  bookingId: string;
  memberName: string;
  classDate: string;
  classTime: string | null;
  coachName: string;
  leadSource: string;
  onLogged: () => void;
}

const OBJECTIONS = [
  'Pricing',
  'Time',
  'Shopping Around',
  'Spousal/Parental',
  'Think About It',
  'Out of Town',
  'Other',
];

const MEMBERSHIP_TYPES = ['Premier', 'Elite', 'Basic'];

export function InlineIntroLogger({
  bookingId,
  memberName,
  classDate,
  classTime,
  coachName,
  leadSource,
  onLogged,
}: InlineIntroLoggerProps) {
  const { user } = useAuth();
  const { refreshData } = useData();
  const [outcome, setOutcome] = useState<string>('');
  const [objection, setObjection] = useState<string>('');
  const [membershipType, setMembershipType] = useState<string>('Premier');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!outcome) {
      toast.error('Select an outcome');
      return;
    }
    setSaving(true);
    try {
      const saName = user?.name || 'Unknown';
      const today = format(new Date(), 'yyyy-MM-dd');

      // Map outcome to result string
      let result = '';
      let commissionAmount = 0;
      if (outcome === 'purchased') {
        result = membershipType || 'Premier';
        commissionAmount = 0; // SA can edit later in shift recap
      } else if (outcome === 'didnt_buy') {
        result = "Didn't Buy";
      } else if (outcome === 'no_show') {
        result = 'No-show';
      }

      // Find or create today's shift recap
      let shiftRecapId: string | null = null;
      const { data: existingRecap } = await supabase
        .from('shift_recaps')
        .select('id')
        .eq('staff_name', saName)
        .eq('shift_date', today)
        .limit(1)
        .maybeSingle();

      if (existingRecap) {
        shiftRecapId = existingRecap.id;
      } else {
        const { data: newRecap } = await supabase
          .from('shift_recaps')
          .insert({
            staff_name: saName,
            shift_date: today,
            shift_type: 'AM', // default, SA can update
          })
          .select('id')
          .single();
        if (newRecap) shiftRecapId = newRecap.id;
      }

      // Create the intros_run record
      const { error: runError } = await supabase
        .from('intros_run')
        .insert({
          member_name: memberName,
          run_date: classDate,
          class_time: classTime || '00:00',
          lead_source: leadSource,
          result,
          coach_name: coachName,
          sa_name: saName,
          intro_owner: saName,
          linked_intro_booked_id: bookingId,
          shift_recap_id: shiftRecapId,
          commission_amount: commissionAmount,
          primary_objection: outcome === 'didnt_buy' ? objection || null : null,
          notes: notes.trim() || null,
          // Mark submitted so shift recap knows it's already done
          created_at: new Date().toISOString(),
        });

      if (runError) throw runError;

      // Update booking status
      if (outcome === 'purchased') {
        await supabase
          .from('intros_booked')
          .update({ booking_status: 'Closed – Bought', closed_at: new Date().toISOString(), closed_by: saName })
          .eq('id', bookingId);

        // Auto-increment AMC
        await incrementAmcOnSale(memberName, membershipType, saName);
      }

      // Log the action
      await supabase.from('script_actions').insert({
        booking_id: bookingId,
        action_type: 'intro_logged',
        script_category: result,
        completed_by: saName,
      });

      // Generate follow-up queue entries for no-show and didn't-buy (Part 6)
      if (outcome === 'no_show' || outcome === 'didnt_buy') {
        const personType = outcome === 'no_show' ? 'no_show' : 'didnt_buy';
        // Check if booking is VIP
        const { data: bookingData } = await supabase
          .from('intros_booked')
          .select('is_vip')
          .eq('id', bookingId)
          .maybeSingle();
        const isVip = bookingData?.is_vip || false;

        // Only create follow-ups for non-VIP (Part 7)
        if (!isVip) {
          const entries = generateFollowUpEntries(
            memberName,
            personType as 'no_show' | 'didnt_buy',
            classDate,
            bookingId,
            null,
            false,
            outcome === 'didnt_buy' ? objection : null,
            null,
          );
          await supabase.from('follow_up_queue').insert(entries);
        }
      }

      toast.success(`Intro logged: ${result}`);
      await refreshData();
      onLogged();
    } catch (err: any) {
      console.error('Inline intro log error:', err);
      toast.error('Failed to log intro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t mt-2 pt-2 space-y-2">
      <Label className="text-xs font-semibold text-muted-foreground">Log Intro Result</Label>

      <div className="grid grid-cols-3 gap-1.5">
        <Button
          variant={outcome === 'purchased' ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-[11px] gap-1"
          onClick={() => setOutcome('purchased')}
        >
          <CheckCircle className="w-3 h-3" />
          Bought
        </Button>
        <Button
          variant={outcome === 'didnt_buy' ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-[11px] gap-1"
          onClick={() => setOutcome('didnt_buy')}
        >
          <XCircle className="w-3 h-3" />
          Didn't Buy
        </Button>
        <Button
          variant={outcome === 'no_show' ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-[11px] gap-1"
          onClick={() => setOutcome('no_show')}
        >
          <AlertTriangle className="w-3 h-3" />
          No Show
        </Button>
      </div>

      {outcome === 'purchased' && (
        <Select value={membershipType} onValueChange={setMembershipType}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Membership type" />
          </SelectTrigger>
          <SelectContent>
            {MEMBERSHIP_TYPES.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {outcome === 'didnt_buy' && (
        <Select value={objection} onValueChange={setObjection}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Primary objection" />
          </SelectTrigger>
          <SelectContent>
            {OBJECTIONS.map(o => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {outcome && (
        <>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="text-xs min-h-[50px]"
            rows={2}
          />
          <Button
            size="sm"
            className="w-full h-8 text-xs"
            onClick={handleSubmit}
            disabled={saving || (outcome === 'didnt_buy' && !objection)}
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            {saving ? 'Saving...' : 'Submit'}
          </Button>
        </>
      )}
    </div>
  );
}
