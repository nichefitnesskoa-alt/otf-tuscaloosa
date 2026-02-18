/**
 * Three outside-sale sheets accessible from the QuickAddFAB:
 *  1. WalkInSaleSheet   — new member, no prior intro booking
 *  2. UpgradeSheet      — existing member upgrading tier
 *  3. HRMAddOnSheet     — existing member adding OTbeat
 *
 * All commission logic imported exclusively from commissionRules.ts (SSOT).
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
import { Loader2, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import ClientNameAutocomplete from '@/components/ClientNameAutocomplete';
import {
  computeCommission,
  computeHRMDeltaCommission,
  computeUpgradeCommission,
  getOTbeatTier,
  STANDARD_MEMBERSHIP_TIERS,
} from '@/lib/outcomes/commissionRules';
import { incrementAmcOnSale, isAmcEligibleSale } from '@/lib/amc-auto';

const today = () => format(new Date(), 'yyyy-MM-dd');

/** Find the original intro owner for a member by name matching in intros_booked */
async function findIntroOwner(memberName: string): Promise<string | null> {
  if (!memberName.trim()) return null;
  const { data } = await supabase
    .from('intros_booked')
    .select('intro_owner, booked_by')
    .ilike('member_name', `%${memberName.trim()}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.intro_owner || data?.booked_by || null;
}

// ────────────────────────────────────────────────────────────────────────────
// WALK-IN SALE SHEET
// ────────────────────────────────────────────────────────────────────────────
interface WalkInSaleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function WalkInSaleSheet({ open, onOpenChange, onSaved }: WalkInSaleSheetProps) {
  const { user } = useAuth();
  const [memberName, setMemberName] = useState('');
  const [phone, setPhone] = useState('');
  const [tier, setTier] = useState('');
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const commission = computeCommission({ membershipType: tier });

  const reset = () => {
    setMemberName(''); setPhone(''); setTier(''); setDate(today()); setNotes('');
  };

  const handleSave = async () => {
    if (!memberName.trim() || !tier) {
      toast.error('Member name and membership tier are required');
      return;
    }
    setSaving(true);
    try {
      const sa = user?.name || 'Unknown';
      const saleId = `walkin_${crypto.randomUUID().substring(0, 8)}`;

      await supabase.from('sales_outside_intro').insert({
        sale_id: saleId,
        sale_type: 'walk_in',
        member_name: memberName.trim(),
        lead_source: 'Walk in',
        membership_type: tier,
        commission_amount: commission,
        intro_owner: sa,
        date_closed: date,
        edit_reason: notes || null,
      });

      // AMC — walk-in is a new membership
      if (isAmcEligibleSale({ membershipType: tier, leadSource: 'Walk in' })) {
        await incrementAmcOnSale(memberName.trim(), tier, sa, date);
      }

      toast.success(`${memberName.trim()} walk-in sale logged — ${tier} — $${commission.toFixed(2)}`);
      reset();
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to save walk-in sale');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>Walk-In Sale</SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          <div>
            <Label>Member Name *</Label>
            <ClientNameAutocomplete
              value={memberName}
              onChange={setMemberName}
              onSelectExisting={(c) => setMemberName(c.member_name)}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Optional" />
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
            <Label>SA (you)</Label>
            <Input value={user?.name || ''} disabled />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional" />
          </div>
          {tier && (
            <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                ${commission.toFixed(2)} commission — attributed to {user?.name}
              </span>
            </div>
          )}
          <Button className="w-full" onClick={handleSave} disabled={saving || !memberName.trim() || !tier}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Log Walk-In Sale
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// UPGRADE SHEET
// ────────────────────────────────────────────────────────────────────────────
interface UpgradeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function UpgradeSheet({ open, onOpenChange, onSaved }: UpgradeSheetProps) {
  const { user } = useAuth();
  const [memberName, setMemberName] = useState('');
  const [prevTier, setPrevTier] = useState('');
  const [newTier, setNewTier] = useState('');
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [resolvedOwner, setResolvedOwner] = useState<string | null>(null);

  const commission = computeUpgradeCommission({ newTier });

  const reset = () => {
    setMemberName(''); setPrevTier(''); setNewTier(''); setDate(today()); setNotes(''); setResolvedOwner(null);
  };

  const handleNameSelect = async (name: string) => {
    setMemberName(name);
    const owner = await findIntroOwner(name);
    setResolvedOwner(owner);
  };

  const handleSave = async () => {
    if (!memberName.trim() || !newTier || !prevTier) {
      toast.error('All fields are required');
      return;
    }
    if (prevTier === newTier) {
      toast.error('Previous and new tier must be different');
      return;
    }
    setSaving(true);
    try {
      const sa = user?.name || 'Unknown';
      const attributedTo = resolvedOwner || sa;
      const saleId = `upgrade_${crypto.randomUUID().substring(0, 8)}`;

      await supabase.from('sales_outside_intro').insert({
        sale_id: saleId,
        sale_type: 'upgrade',
        member_name: memberName.trim(),
        lead_source: 'Upgrade',
        membership_type: newTier,
        commission_amount: commission,
        intro_owner: attributedTo,
        date_closed: date,
        edit_reason: notes ? notes : `Upgraded from ${prevTier} to ${newTier}`,
      });

      // AMC does NOT increment for upgrades (already a member)

      toast.success(
        `${memberName.trim()} upgrade logged — ${newTier} — $${commission.toFixed(2)} to ${attributedTo}`
      );
      reset();
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to save upgrade');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>Membership Upgrade</SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          <div>
            <Label>Member Name *</Label>
            <ClientNameAutocomplete
              value={memberName}
              onChange={(v) => { setMemberName(v); setResolvedOwner(null); }}
              onSelectExisting={(c) => handleNameSelect(c.member_name)}
            />
          </div>
          <div>
            <Label>Previous Membership Tier *</Label>
            <Select value={prevTier} onValueChange={setPrevTier}>
              <SelectTrigger><SelectValue placeholder="Select previous tier…" /></SelectTrigger>
              <SelectContent>
                {STANDARD_MEMBERSHIP_TIERS.map(t => (
                  <SelectItem key={t.label} value={t.label}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>New Membership Tier *</Label>
            <Select value={newTier} onValueChange={setNewTier}>
              <SelectTrigger><SelectValue placeholder="Select new tier…" /></SelectTrigger>
              <SelectContent>
                {STANDARD_MEMBERSHIP_TIERS.map(t => (
                  <SelectItem key={t.label} value={t.label}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>SA (you)</Label>
            <Input value={user?.name || ''} disabled />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional" />
          </div>
          {newTier && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                ${commission.toFixed(2)} → {resolvedOwner || user?.name}
                {resolvedOwner && resolvedOwner !== user?.name && ' (original intro owner)'}
              </span>
            </div>
          )}
          <Button className="w-full" onClick={handleSave} disabled={saving || !memberName.trim() || !prevTier || !newTier}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Log Upgrade
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// HRM ADD-ON SHEET
// ────────────────────────────────────────────────────────────────────────────
interface HRMAddOnSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function HRMAddOnSheet({ open, onOpenChange, onSaved }: HRMAddOnSheetProps) {
  const { user } = useAuth();
  const [memberName, setMemberName] = useState('');
  const [currentTier, setCurrentTier] = useState('');
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [resolvedOwner, setResolvedOwner] = useState<string | null>(null);

  const delta = currentTier ? computeHRMDeltaCommission({ currentTier }) : 0;
  const otbeatTier = currentTier ? getOTbeatTier(currentTier) : '';

  const reset = () => {
    setMemberName(''); setCurrentTier(''); setDate(today()); setNotes(''); setResolvedOwner(null);
  };

  const handleNameSelect = async (name: string) => {
    setMemberName(name);
    const owner = await findIntroOwner(name);
    setResolvedOwner(owner);
  };

  const handleSave = async () => {
    if (!memberName.trim() || !currentTier) {
      toast.error('Member name and current tier are required');
      return;
    }
    setSaving(true);
    try {
      const sa = user?.name || 'Unknown';
      const attributedTo = resolvedOwner || sa;
      const saleId = `hrm_${crypto.randomUUID().substring(0, 8)}`;

      // Try to upgrade existing intros_run record
      const { data: existingRuns } = await supabase
        .from('intros_run')
        .select('id, result, buy_date')
        .ilike('member_name', `%${memberName.trim()}%`)
        .order('created_at', { ascending: false });

      const existing = (existingRuns || []).find(r =>
        r.result?.toLowerCase().includes('premier') ||
        r.result?.toLowerCase().includes('elite') ||
        r.result?.toLowerCase().includes('basic')
      );

      if (existing) {
        const upgradedCommission = computeCommission({ membershipType: otbeatTier });
        await supabase.from('intros_run').update({
          result: otbeatTier,
          result_canon: otbeatTier.toUpperCase().replace(/[\s+]/g, '_'),
          commission_amount: upgradedCommission,
          last_edited_at: new Date().toISOString(),
          last_edited_by: sa,
          edit_reason: `HRM Add-On: upgraded to ${otbeatTier} by ${sa} on ${date}`,
        }).eq('id', existing.id);
      } else {
        // No existing run — create outside sale record
        await supabase.from('sales_outside_intro').insert({
          sale_id: saleId,
          sale_type: 'hrm_addon',
          member_name: memberName.trim(),
          lead_source: 'HRM Add-on',
          membership_type: 'HRM Add-on (OTBeat)',
          commission_amount: delta,
          intro_owner: attributedTo,
          date_closed: date,
          edit_reason: notes || null,
        });
      }

      // AMC does NOT increment (already a member)

      toast.success(
        `${memberName.trim()} HRM add-on logged — $${delta.toFixed(2)} to ${attributedTo}`
      );
      reset();
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to save HRM add-on');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>HRM Add-On (OTbeat)</SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          <div>
            <Label>Member Name *</Label>
            <ClientNameAutocomplete
              value={memberName}
              onChange={(v) => { setMemberName(v); setResolvedOwner(null); }}
              onSelectExisting={(c) => handleNameSelect(c.member_name)}
            />
          </div>
          <div>
            <Label>Current Membership Tier *</Label>
            <Select value={currentTier} onValueChange={setCurrentTier}>
              <SelectTrigger><SelectValue placeholder="Select their current tier…" /></SelectTrigger>
              <SelectContent>
                {STANDARD_MEMBERSHIP_TIERS.map(t => (
                  <SelectItem key={t.label} value={t.label}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>SA Processing Sale</Label>
            <Input value={user?.name || ''} disabled />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
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
                  ${delta.toFixed(2)} delta commission → {resolvedOwner || user?.name}
                </span>
              </div>
              {otbeatTier && (
                <p className="text-xs text-muted-foreground">
                  Membership will update: {currentTier} → {otbeatTier}
                </p>
              )}
              {resolvedOwner && resolvedOwner !== user?.name && (
                <p className="text-xs text-purple-600">(original intro owner)</p>
              )}
            </div>
          )}
          <Button className="w-full" onClick={handleSave} disabled={saving || !memberName.trim() || !currentTier}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Log HRM Add-On
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
