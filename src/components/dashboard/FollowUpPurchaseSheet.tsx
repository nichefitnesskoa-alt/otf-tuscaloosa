/**
 * Log Purchase sheet for follow-up queue cards.
 * Two options: Membership Purchase OR HRM Add-On.
 * All commission via commissionRules.ts SSOT.
 */
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DatePickerField } from '@/components/shared/FormHelpers';
import { Loader2, DollarSign, ShoppingCart, Watch } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import {
  computeCommission,
  computeHRMDeltaCommission,
  getOTbeatTier,
  STANDARD_MEMBERSHIP_TIERS,
} from '@/lib/outcomes/commissionRules';
import { applyIntroOutcomeUpdate } from '@/lib/outcome-update';
import { isAmcEligibleSale, incrementAmcOnSale } from '@/lib/amc-auto';

interface FollowUpPurchaseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The follow-up queue item's person name */
  personName: string;
  /** Linked booking id from follow_up_queue */
  bookingId: string | null;
  /** Follow-up queue item id — cleared on purchase */
  queueItemId: string;
  /** The intro owner of the original booking (for commission attribution) */
  introOwner?: string | null;
  /** Original intro's run id if known */
  runId?: string | null;
  /** Class date of the original intro */
  classDate?: string;
  /** Lead source from the original booking */
  leadSource?: string | null;
  onSaved: () => void;
}

export function FollowUpPurchaseSheet({
  open,
  onOpenChange,
  personName,
  bookingId,
  queueItemId,
  introOwner,
  runId,
  classDate,
  leadSource,
  onSaved,
}: FollowUpPurchaseSheetProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<'pick' | 'membership' | 'hrm'>('pick');
  const [tier, setTier] = useState('');
  const [currentTier, setCurrentTier] = useState('');
  const [buyDate, setBuyDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const commission = computeCommission({ membershipType: tier });
  const hrmDelta = currentTier ? computeHRMDeltaCommission({ currentTier }) : 0;
  const otbeatTier = currentTier ? getOTbeatTier(currentTier) : '';
  const attributedTo = introOwner || user?.name || 'Unknown';

  const reset = () => {
    setMode('pick'); setTier(''); setCurrentTier(''); setBuyDate(format(new Date(), 'yyyy-MM-dd')); setNotes('');
  };

  /** Clear the follow-up queue for this person on any purchase */
  const clearQueue = async () => {
    await supabase.from('follow_up_queue')
      .update({ status: 'converted' })
      .eq('id', queueItemId);
    // Also clear all pending for this person if they have a booking
    if (bookingId) {
      await supabase.from('follow_up_queue')
        .update({ status: 'converted' })
        .eq('booking_id', bookingId)
        .eq('status', 'pending');
    }
  };

  const handleMembershipSave = async () => {
    if (!tier) { toast.error('Select a membership tier'); return; }
    setSaving(true);
    try {
      const sa = user?.name || 'Unknown';

      // Call canonical outcome update — syncs intros_run, intros_booked, AMC, audit
      await applyIntroOutcomeUpdate({
        bookingId: bookingId || '',
        memberName: personName,
        classDate: classDate || buyDate,
        newResult: tier,
        previousResult: "Didn't Buy",
        membershipType: tier,
        leadSource: leadSource || undefined,
        editedBy: sa,
        sourceComponent: 'FollowUpPurchaseSheet',
        runId: runId || undefined,
        editReason: `Follow-up purchase logged via MyDay Follow-Ups tab. Buy date: ${buyDate}. Notes: ${notes}`,
      });

      // Update buy_date to the selected date (not today by default)
      if (runId) {
        await supabase.from('intros_run').update({ buy_date: buyDate }).eq('id', runId);
      }

      await clearQueue();

      toast.success(`${personName} follow-up purchase logged — ${tier} — $${commission.toFixed(2)}`);
      reset();
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to log purchase');
    } finally {
      setSaving(false);
    }
  };

  const handleHRMSave = async () => {
    if (!currentTier) { toast.error('Select current membership tier'); return; }
    setSaving(true);
    try {
      const sa = user?.name || 'Unknown';

      // Upgrade existing run if we have one
      if (runId) {
        const fullCommission = computeCommission({ membershipType: otbeatTier });
        await supabase.from('intros_run').update({
          result: otbeatTier,
          result_canon: otbeatTier.toUpperCase().replace(/[\s+]/g, '_'),
          commission_amount: fullCommission,
          buy_date: buyDate,
          last_edited_at: new Date().toISOString(),
          last_edited_by: sa,
          edit_reason: `HRM Add-On logged via Follow-Up tab. ${currentTier} → ${otbeatTier}`,
        }).eq('id', runId);
      } else {
        // Create outside sale record
        await supabase.from('sales_outside_intro').insert({
          sale_id: `hrm_fu_${crypto.randomUUID().substring(0, 8)}`,
          sale_type: 'hrm_addon',
          member_name: personName,
          lead_source: leadSource || 'HRM Add-on',
          membership_type: 'HRM Add-on (OTBeat)',
          commission_amount: hrmDelta,
          intro_owner: attributedTo,
          date_closed: buyDate,
          edit_reason: notes || null,
        });
      }

      // AMC does NOT increment
      await clearQueue();

      toast.success(`${personName} HRM add-on logged — $${hrmDelta.toFixed(2)} to ${attributedTo}`);
      reset();
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to log HRM add-on');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>Log Purchase — {personName}</SheetTitle>
        </SheetHeader>

        {mode === 'pick' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">What did {personName.split(' ')[0]} purchase?</p>
            <Button
              variant="outline"
              className="w-full h-16 flex flex-col gap-1 border-2 border-primary/40 hover:border-primary"
              onClick={() => setMode('membership')}
            >
              <ShoppingCart className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold">Membership Purchase</span>
              <span className="text-[10px] text-muted-foreground">Premier, Elite, or Basic</span>
            </Button>
            <Button
              variant="outline"
              className="w-full h-16 flex flex-col gap-1 border-2 border-purple-400/40 hover:border-purple-500"
              onClick={() => setMode('hrm')}
            >
              <Watch className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-semibold">HRM Add-On (OTbeat)</span>
              <span className="text-[10px] text-muted-foreground">Already a member, adding OTbeat</span>
            </Button>
          </div>
        )}

        {mode === 'membership' && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" className="mb-2 -ml-1" onClick={() => setMode('pick')}>← Back</Button>
            <div>
              <Label>Member</Label>
              <Input value={personName} disabled />
            </div>
            <div>
              <Label>Membership Tier *</Label>
              <Select value={tier} onValueChange={setTier}>
                <SelectTrigger><SelectValue placeholder="Select tier…" /></SelectTrigger>
                <SelectContent>
                  {STANDARD_MEMBERSHIP_TIERS.map(t => (
                    <SelectItem key={t.label} value={t.label}>
                      {t.label} — ${t.commission.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Buy Date</Label>
              <DatePickerField value={buyDate} onChange={setBuyDate} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional" />
            </div>
            {tier && (
              <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                <div>
                  <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                    ${commission.toFixed(2)} commission → {attributedTo}
                  </p>
                  <p className="text-xs text-muted-foreground">Counted in pay period of buy date ({buyDate})</p>
                </div>
              </div>
            )}
            <Button className="w-full" onClick={handleMembershipSave} disabled={saving || !tier}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Log Membership Purchase
            </Button>
          </div>
        )}

        {mode === 'hrm' && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" className="mb-2 -ml-1" onClick={() => setMode('pick')}>← Back</Button>
            <div>
              <Label>Member</Label>
              <Input value={personName} disabled />
            </div>
            <div>
              <Label>Current Membership Tier *</Label>
              <Select value={currentTier} onValueChange={setCurrentTier}>
                <SelectTrigger><SelectValue placeholder="Their current tier…" /></SelectTrigger>
                <SelectContent>
                  {STANDARD_MEMBERSHIP_TIERS.map(t => (
                    <SelectItem key={t.label} value={t.label}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional" />
            </div>
            {currentTier && (
              <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg space-y-1">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-semibold text-purple-700 dark:text-purple-400">
                    ${hrmDelta.toFixed(2)} delta → {attributedTo}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Upgrades membership: {currentTier} → {otbeatTier}
                </p>
              </div>
            )}
            <Button className="w-full" onClick={handleHRMSave} disabled={saving || !currentTier}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Log HRM Add-On
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
