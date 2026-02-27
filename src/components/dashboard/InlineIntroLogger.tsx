import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAutoCloseBooking } from '@/hooks/useAutoCloseBooking';
import { applyIntroOutcomeUpdate } from '@/lib/outcome-update';

interface InlineIntroLoggerProps {
  bookingId: string;
  memberName: string;
  classDate: string;
  classTime: string | null;
  coachName: string;
  leadSource: string;
  onLogged: (undoData?: { introRunId: string; followUpIds: string[]; bookingId: string; previousStatus: string }) => void;
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

const MEMBERSHIP_OPTIONS = [
  { label: 'Premier + OTBeat', commission: 15.00 },
  { label: 'Premier w/o OTBeat', commission: 7.50 },
  { label: 'Elite + OTBeat', commission: 12.00 },
  { label: 'Elite w/o OTBeat', commission: 6.00 },
  { label: 'Basic + OTBeat', commission: 9.00 },
  { label: 'Basic w/o OTBeat', commission: 3.00 },
] as const;

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
  const { closeBookingOnSale } = useAutoCloseBooking();
  const [outcome, setOutcome] = useState<string>('');
  const [objection, setObjection] = useState<string>('');
  const [membershipType, setMembershipType] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedOption = MEMBERSHIP_OPTIONS.find(m => m.label === membershipType);

  const handleSubmit = async () => {
    if (!outcome) {
      toast.error('Select an outcome');
      return;
    }
    if (outcome === 'purchased' && !membershipType) {
      toast.error('Select a membership type');
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
        result = membershipType;
        const match = MEMBERSHIP_OPTIONS.find(m => m.label === membershipType);
        commissionAmount = match?.commission || 0;
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
            shift_type: 'AM',
          })
          .select('id')
          .single();
        if (newRecap) shiftRecapId = newRecap.id;
      }

      // Create the intros_run record
      const { data: runData, error: runError } = await supabase
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
          intro_owner_locked: true,
          linked_intro_booked_id: bookingId,
          shift_recap_id: shiftRecapId,
          commission_amount: commissionAmount,
          primary_objection: outcome === 'didnt_buy' ? objection || null : outcome === 'purchased' ? objection || null : null,
          notes: notes.trim() || null,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (runError) throw runError;
      const introRunId = runData?.id || '';

      // Lock intro owner on the booking
      try {
        await supabase
          .from('intros_booked')
          .update({
            intro_owner: saName,
            intro_owner_locked: true,
            last_edited_at: new Date().toISOString(),
            last_edited_by: saName,
            edit_reason: 'Intro owner locked on first run via MyDay',
          })
          .eq('id', bookingId);
      } catch (e) {
        console.error('Error locking intro owner:', e);
      }

      // Track previous booking status for undo
      const previousStatus = 'Active';

      // Sync booking, AMC, follow-ups, and audit via canonical function
      await applyIntroOutcomeUpdate({
        bookingId,
        memberName,
        classDate,
        newResult: result,
        previousResult: null, // first time logging
        membershipType: outcome === 'purchased' ? membershipType : undefined,
        commissionAmount,
        leadSource,
        objection: outcome === 'didnt_buy' ? objection : outcome === 'purchased' ? objection : null,
        editedBy: saName,
        sourceComponent: 'InlineIntroLogger',
        runId: introRunId,
      });

      // Auto-close booking with full sale linking (Sheets sync, multi-booking matching)
      if (outcome === 'purchased' && commissionAmount > 0) {
        const saleId = `run_${introRunId}`;
        try {
          await closeBookingOnSale(memberName, commissionAmount, membershipType, saleId, bookingId, saName);
        } catch (e) {
          console.error('Error in closeBookingOnSale:', e);
        }

        // Match lead as won
        try {
          const nameParts = memberName.trim().split(/\s+/);
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          if (firstName) {
            const { data: matchingLeads } = await supabase
              .from('leads')
              .select('id, stage')
              .ilike('first_name', firstName)
              .ilike('last_name', lastName || '%')
              .not('stage', 'eq', 'won')
              .limit(1);
            if (matchingLeads && matchingLeads.length > 0) {
              await supabase.from('leads').update({ stage: 'won' }).eq('id', matchingLeads[0].id);
            }
          }
        } catch (e) {
          console.error('Error matching lead:', e);
        }
      }

      let followUpIds: string[] = [];

      // Google Sheets sync removed — old outbound sheet no longer exists

      const commissionText = commissionAmount > 0 ? ` · $${commissionAmount.toFixed(2)} commission` : '';
      toast.success(`${memberName} logged as ${result}${commissionText}`);
      await refreshData();
      onLogged({ introRunId, followUpIds, bookingId, previousStatus });
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
        <>
          <Select value={membershipType} onValueChange={setMembershipType}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select membership type" />
            </SelectTrigger>
            <SelectContent>
              {MEMBERSHIP_OPTIONS.map(m => (
                <SelectItem key={m.label} value={m.label}>
                  {m.label} (${m.commission.toFixed(2)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedOption && (
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-800 dark:bg-emerald-950/30">
                ${selectedOption.commission.toFixed(2)} commission
              </Badge>
            </div>
          )}

          {/* Required: capture objection even on purchase */}
          <div className="p-2 bg-primary/5 border border-primary/20 rounded-md">
            <Label className="text-xs font-medium">Objection handled (or first-ask close)?</Label>
            <Select value={objection} onValueChange={setObjection}>
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue placeholder="Select objection or None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="None - First Ask Close">None – First Ask Close</SelectItem>
                {OBJECTIONS.map(o => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
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
            disabled={saving || (outcome === 'purchased' && !membershipType) || (outcome === 'didnt_buy' && !objection) || (outcome === 'purchased' && !objection)}
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            {saving ? 'Saving...' : 'Submit'}
          </Button>
        </>
      )}
    </div>
  );
}
