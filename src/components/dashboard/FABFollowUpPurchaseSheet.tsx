/**
 * FABFollowUpPurchaseSheet — Log a follow-up purchase from the QuickAddFAB.
 * SA searches for a person who had an intro and didn't buy, selects them,
 * then logs the membership purchase with correct attribution.
 * Uses applyIntroOutcomeUpdate as the canonical write path.
 */
import { useState, useCallback, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from '@/components/shared/FormHelpers';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Search, Loader2, UserCheck } from 'lucide-react';
import { applyIntroOutcomeUpdate } from '@/lib/outcome-update';
import { STANDARD_MEMBERSHIP_TIERS, computeHRMDeltaCommission, getOTbeatTier } from '@/lib/outcomes/commissionRules';

interface SearchResult {
  bookingId: string;
  memberName: string;
  introDate: string;
  introOwner: string | null;
  runId?: string;
  leadSource?: string | null;
}

interface FABFollowUpPurchaseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function FABFollowUpPurchaseSheet({ open, onOpenChange, onSaved }: FABFollowUpPurchaseSheetProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [mode, setMode] = useState<'pick' | 'membership' | 'hrm'>('pick');
  const [membership, setMembership] = useState('');
  const [currentTier, setCurrentTier] = useState('');
  const [buyDate, setBuyDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setQuery(''); setResults([]); setSelected(null);
    setMode('pick'); setMembership(''); setCurrentTier('');
    setBuyDate(format(new Date(), 'yyyy-MM-dd')); setNotes('');
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const { data: bookings } = await supabase
        .from('intros_booked')
        .select('id, member_name, class_date, intro_owner, booking_status_canon, lead_source')
        .ilike('member_name', `%${q.trim()}%`)
        .neq('booking_status_canon', 'CANCELLED')
        .is('deleted_at', null)
        .order('class_date', { ascending: false })
        .limit(20);

      if (!bookings) { setResults([]); return; }

      const bookingIds = bookings.map(b => b.id);
      const { data: runs } = await supabase
        .from('intros_run')
        .select('linked_intro_booked_id, result_canon, id')
        .in('linked_intro_booked_id', bookingIds);

      const soldBookingIds = new Set(
        (runs || [])
          .filter(r => r.result_canon === 'SOLD')
          .map(r => r.linked_intro_booked_id)
          .filter(Boolean)
      );

      const filtered: SearchResult[] = bookings
        .filter(b => !soldBookingIds.has(b.id))
        .map(b => {
          const run = (runs || []).find(r => r.linked_intro_booked_id === b.id);
          return {
            bookingId: b.id,
            memberName: b.member_name,
            introDate: b.class_date,
            introOwner: b.intro_owner,
            runId: run?.id,
            leadSource: b.lead_source,
          };
        });

      setResults(filtered);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => handleSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  const hrmDelta = currentTier ? computeHRMDeltaCommission({ currentTier }) : 0;
  const otbeatTier = currentTier ? getOTbeatTier(currentTier) : '';
  const membershipObj = STANDARD_MEMBERSHIP_TIERS.find(m => m.label === membership);
  const commission = membershipObj?.commission ?? 0;

  const handleMembershipSave = async () => {
    if (!selected || !membership) { toast.error('Select membership tier'); return; }
    setSaving(true);
    try {
      await applyIntroOutcomeUpdate({
        bookingId: selected.bookingId,
        memberName: selected.memberName,
        classDate: selected.introDate,
        newResult: membership,
        previousResult: "Didn't Buy",
        membershipType: membership,
        leadSource: selected.leadSource || undefined,
        editedBy: user?.name || 'Unknown',
        sourceComponent: 'FABFollowUpPurchaseSheet',
        runId: selected.runId || undefined,
        editReason: `Follow-up purchase via + button. Buy date: ${buyDate}.${notes ? ' Notes: ' + notes : ''}`,
      });

      if (selected.runId) {
        await supabase.from('intros_run').update({ buy_date: buyDate }).eq('id', selected.runId);
      }

      // Clear follow-up queue
      await supabase.from('follow_up_queue')
        .update({ status: 'converted' })
        .eq('booking_id', selected.bookingId)
        .eq('status', 'pending');

      const attributedTo = selected.introOwner || 'original SA';
      toast.success(`${selected.memberName} — ${membership} — $${commission.toFixed(2)} to ${attributedTo}`);
      window.dispatchEvent(new CustomEvent('myday:walk-in-added'));
      onSaved();
      handleClose(false);
    } catch (err: any) {
      console.error('[FABFollowUpPurchaseSheet]', err);
      toast.error(err?.message || 'Failed to log purchase');
    } finally {
      setSaving(false);
    }
  };

  const handleHRMSave = async () => {
    if (!selected || !currentTier) { toast.error('Select current membership tier'); return; }
    setSaving(true);
    try {
      const attributedTo = selected.introOwner || user?.name || 'Unknown';
      await supabase.from('sales_outside_intro').insert({
        sale_id: `hrm_fu_${crypto.randomUUID().substring(0, 8)}`,
        sale_type: 'hrm_addon',
        member_name: selected.memberName,
        lead_source: selected.leadSource || 'HRM Add-on',
        membership_type: 'HRM Add-on (OTBeat)',
        commission_amount: hrmDelta,
        intro_owner: attributedTo,
        date_closed: buyDate,
        edit_reason: notes || null,
      });

      await supabase.from('follow_up_queue')
        .update({ status: 'converted' })
        .eq('booking_id', selected.bookingId)
        .eq('status', 'pending');

      toast.success(`${selected.memberName} — HRM Add-On — $${hrmDelta.toFixed(2)} to ${attributedTo}`);
      window.dispatchEvent(new CustomEvent('myday:walk-in-added'));
      onSaved();
      handleClose(false);
    } catch (err: any) {
      console.error('[FABFollowUpPurchaseSheet HRM]', err);
      toast.error(err?.message || 'Failed to log HRM add-on');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-xl">
        <SheetHeader className="mb-4">
          <SheetTitle>Log Follow-Up Purchase</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-6">
          {/* Step 1 — search */}
          {!selected && (
            <>
              <div className="space-y-1.5">
                <Label>Search by name</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Type name to search..."
                    className="pl-8"
                    autoFocus
                  />
                  {searching && <Loader2 className="absolute right-2.5 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />}
                </div>
              </div>

              {results.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Select a person</Label>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {results.map(r => (
                      <button
                        key={r.bookingId}
                        className="w-full text-left rounded-lg border border-border bg-card p-2.5 hover:bg-muted/60 transition-colors"
                        onClick={() => setSelected(r)}
                      >
                        <p className="text-sm font-medium">{r.memberName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Intro: {r.introDate} · Run by: {r.introOwner || 'Unknown'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {query.length >= 2 && !searching && results.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No matches found</p>
              )}
            </>
          )}

          {/* Step 2 — selected, pick type */}
          {selected && mode === 'pick' && (
            <>
              <div className="rounded-lg bg-primary/10 border border-primary/30 p-3 flex items-start gap-2">
                <UserCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{selected.memberName}</p>
                  <p className="text-xs text-muted-foreground">Original intro: {selected.introDate}</p>
                  <p className="text-xs text-muted-foreground">Commission → {selected.introOwner || 'Original SA'}</p>
                </div>
                <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => setSelected(null)}>Change</Button>
              </div>

              <p className="text-sm text-muted-foreground">What did {selected.memberName.split(' ')[0]} purchase?</p>
              <div className="space-y-2">
                <Button variant="outline" className="w-full h-14 flex flex-col gap-1 border-2 border-primary/40" onClick={() => setMode('membership')}>
                  <span className="text-sm font-semibold">Membership Purchase</span>
                  <span className="text-[10px] text-muted-foreground">Premier, Elite, or Basic</span>
                </Button>
                <Button variant="outline" className="w-full h-14 flex flex-col gap-1 border-2 border-purple-400/40" onClick={() => setMode('hrm')}>
                  <span className="text-sm font-semibold">HRM Add-On (OTBeat)</span>
                  <span className="text-[10px] text-muted-foreground">Already a member, adding OTBeat</span>
                </Button>
              </div>
            </>
          )}

          {/* Step 3a — membership */}
          {selected && mode === 'membership' && (
            <>
              <div className="rounded-lg bg-primary/10 border border-primary/30 px-3 py-2 text-xs text-muted-foreground">
                {selected.memberName} · Intro: {selected.introDate} · Commission → {selected.introOwner || 'Original SA'}
              </div>

              <div className="space-y-1.5">
                <Label>Membership Tier <span className="text-destructive">*</span></Label>
                <Select value={membership} onValueChange={setMembership}>
                  <SelectTrigger><SelectValue placeholder="Select tier..." /></SelectTrigger>
                  <SelectContent>
                    {STANDARD_MEMBERSHIP_TIERS.map(m => (
                      <SelectItem key={m.label} value={m.label}>{m.label} — ${m.commission.toFixed(2)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {membership && (
                <div className="rounded bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  Commission: <span className="font-semibold text-foreground">${commission.toFixed(2)}</span> → <span className="font-semibold text-foreground">{selected.introOwner || 'Original SA'}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Purchase Date</Label>
                <DatePickerField value={buyDate} onChange={setBuyDate} />
              </div>
              <div className="space-y-1.5">
                <Label>Notes (optional)</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes..." />
              </div>

              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setMode('pick')}>← Back</Button>
                <Button className="flex-1" onClick={handleMembershipSave} disabled={saving || !membership} size="lg">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Log Purchase — ${commission.toFixed(2)}
                </Button>
              </div>
            </>
          )}

          {/* Step 3b — HRM */}
          {selected && mode === 'hrm' && (
            <>
              <div className="rounded-lg bg-primary/10 border border-primary/30 px-3 py-2 text-xs text-muted-foreground">
                {selected.memberName} · Intro: {selected.introDate} · Commission → {selected.introOwner || 'Original SA'}
              </div>

              <div className="space-y-1.5">
                <Label>Current Membership Tier <span className="text-destructive">*</span></Label>
                <Select value={currentTier} onValueChange={setCurrentTier}>
                  <SelectTrigger><SelectValue placeholder="Their current tier..." /></SelectTrigger>
                  <SelectContent>
                    {STANDARD_MEMBERSHIP_TIERS.map(m => (
                      <SelectItem key={m.label} value={m.label}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentTier && (
                <div className="rounded bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  Delta: <span className="font-semibold text-foreground">${hrmDelta.toFixed(2)}</span> → <span className="font-semibold text-foreground">{selected.introOwner || 'Original SA'}</span>
                  <span className="ml-1">· Upgrades to {otbeatTier}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Date</Label>
                <DatePickerField value={buyDate} onChange={setBuyDate} />
              </div>
              <div className="space-y-1.5">
                <Label>Notes (optional)</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes..." />
              </div>

              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setMode('pick')}>← Back</Button>
                <Button className="flex-1" onClick={handleHRMSave} disabled={saving || !currentTier} size="lg">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Log HRM Add-On — ${hrmDelta.toFixed(2)}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
