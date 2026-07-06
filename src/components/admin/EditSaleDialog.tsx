import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LeadSourceWithReferrerField, validateLeadSourceReferrer, resolveReferrerForWrite } from '@/components/shared/LeadSourceWithReferrerField';

interface EditSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase: {
    id: string;
    member_name: string;
    membership_type: string;
    commission_amount: number;
    lead_source: string | null;
    intro_owner: string | null;
    purchase_date: string;
    source: 'intro_run' | 'outside_intro';
  } | null;
  onSaved: () => void;
}

export default function EditSaleDialog({ open, onOpenChange, purchase, onSaved }: EditSaleDialogProps) {
  const [memberName, setMemberName] = useState('');
  const [membershipType, setMembershipType] = useState('');
  const [commission, setCommission] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [referredBy, setReferredBy] = useState<string | null>(null);
  const [introOwner, setIntroOwner] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (purchase) {
      setMemberName(purchase.member_name);
      setMembershipType(purchase.membership_type);
      setCommission(String(purchase.commission_amount));
      setLeadSource(purchase.lead_source || '');
      setIntroOwner(purchase.intro_owner || '');
      setDate(purchase.purchase_date);
      // Fetch linked booking's referrer if this is an intro_run sale
      if (purchase.source === 'intro_run') {
        (async () => {
          const { data: run } = await supabase
            .from('intros_run')
            .select('linked_intro_booked_id')
            .eq('id', purchase.id)
            .maybeSingle();
          const linkedId = (run as any)?.linked_intro_booked_id;
          if (linkedId) {
            const { data: b } = await supabase
              .from('intros_booked')
              .select('referred_by_member_name')
              .eq('id', linkedId)
              .maybeSingle();
            setReferredBy((b as any)?.referred_by_member_name ?? null);
          } else {
            setReferredBy(null);
          }
        })();
      } else {
        setReferredBy(null);
      }
    }
  }, [purchase]);

  const handleSave = async () => {
    if (!purchase) return;

    const referrerErr = validateLeadSourceReferrer(leadSource, referredBy);
    if (referrerErr) { toast.error(referrerErr); return; }

    setSaving(true);
    try {
      const commissionNum = parseFloat(commission) || 0;
      const normalizedReferrer = resolveReferrerForWrite(leadSource, referredBy);

      if (purchase.source === 'intro_run') {
        const { error } = await supabase
          .from('intros_run')
          .update({
            member_name: memberName,
            result: membershipType,
            commission_amount: commissionNum,
            lead_source: leadSource || null,
            intro_owner: introOwner || null,
            buy_date: date || null,
          })
          .eq('id', purchase.id);
        if (error) throw error;

        // Sync lead source + referrer onto the linked booking so the
        // SOML/referral trigger sees the change as source-of-truth.
        const { data: run } = await supabase
          .from('intros_run')
          .select('linked_intro_booked_id')
          .eq('id', purchase.id)
          .maybeSingle();
        const linkedId = (run as any)?.linked_intro_booked_id;
        if (linkedId && leadSource) {
          await supabase
            .from('intros_booked')
            .update({
              lead_source: leadSource,
              referred_by_member_name: normalizedReferrer,
              last_edited_at: new Date().toISOString(),
              last_edited_by: 'Edit Sale (Auto-Sync)',
              edit_reason: 'Synced lead source / referrer from Edit Sale',
            })
            .eq('id', linkedId);
        }
      } else {
        const { error } = await supabase
          .from('sales_outside_intro')
          .update({
            member_name: memberName,
            membership_type: membershipType,
            commission_amount: commissionNum,
            lead_source: leadSource || 'Unknown',
            intro_owner: introOwner || null,
            date_closed: date || null,
          })
          .eq('id', purchase.id);
        if (error) throw error;
      }

      toast.success('Sale updated');
      onOpenChange(false);
      onSaved();
    } catch (err) {
      console.error('Error updating sale:', err);
      toast.error('Failed to update sale');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Sale</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Member Name</Label>
            <Input value={memberName} onChange={e => setMemberName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Membership Type</Label>
            <Input value={membershipType} onChange={e => setMembershipType(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Commission ($)</Label>
            <Input type="number" step="0.01" value={commission} onChange={e => setCommission(e.target.value)} />
          </div>
          <LeadSourceWithReferrerField
            value={leadSource}
            referredByMemberName={referredBy}
            onChange={({ lead_source, referred_by_member_name }) => {
              setLeadSource(lead_source);
              setReferredBy(referred_by_member_name);
            }}
          />
          <div className="grid gap-1.5">
            <Label>Intro Owner</Label>
            <Input value={introOwner} onChange={e => setIntroOwner(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
