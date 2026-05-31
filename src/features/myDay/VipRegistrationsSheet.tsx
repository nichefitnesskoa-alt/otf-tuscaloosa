/**
 * VIP group sheet: shows the group name, total registration count, an outcome
 * roll-up, the required coach picker, and a per-attendee list with names +
 * outcome dropdowns so SAs can log how each registrant did.
 *
 * Names ARE shown here (this is staff-facing, behind login). Privacy stripping
 * applies only to the front-page notification banner — not to this sheet.
 */
import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Users, Copy, Check, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import { notifyDataChanged } from '@/lib/data/invalidation';
import { BookIntroSheet } from '@/components/dashboard/BookIntroSheet';
import { ScriptSendDrawer } from '@/components/scripts/ScriptSendDrawer';
import {
  VIP_MEMBERSHIP_OPTIONS,
  saveVipPurchase,
  softCancelVipPurchase,
} from '@/lib/vip/convertVipPurchaseToIntro';

interface RegRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  outcome: string | null;
  created_at: string;
  birthday: string | null;
  weight_lbs: number | null;
  membership_type: string | null;
  commission_amount: number | null;
  is_group_contact: boolean;
  attending_class: boolean;
}

const OUTCOME_OPTIONS: { value: string; label: string }[] = [
  { value: 'showed', label: 'Showed' },
  { value: 'no_show', label: 'No-show' },
  { value: 'booked_intro', label: 'Booked intro' },
  { value: 'purchased', label: 'Purchased' },
];

const OUTCOME_LABELS: Record<string, string> = Object.fromEntries(
  OUTCOME_OPTIONS.map(o => [o.value, o.label.toLowerCase()])
);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vipSessionId: string;
  vipGroupName: string | null;
  userName: string;
}

export default function VipRegistrationsSheet({ open, onOpenChange, vipSessionId, vipGroupName, userName }: Props) {
  const { coaches: COACHES, salesAssociates: SAS } = useActiveStaff();
  const [loading, setLoading] = useState(false);
  const [regs, setRegs] = useState<RegRow[]>([]);
  const [vipCoach, setVipCoach] = useState<string>('');
  const [vipSaSetup, setVipSaSetup] = useState<string>('');
  const [vipSessionDate, setVipSessionDate] = useState<string | null>(null);
  const [vipSessionTime, setVipSessionTime] = useState<string | null>(null);
  const [savingCoach, setSavingCoach] = useState(false);
  const [savingSaSetup, setSavingSaSetup] = useState(false);
  const [saSetupSaved, setSaSetupSaved] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bookIntroOpen, setBookIntroOpen] = useState(false);
  const [bookIntroPrefill, setBookIntroPrefill] = useState<{ firstName: string; lastName: string; phone: string } | null>(null);
  const [scriptDrawer, setScriptDrawer] = useState<{ open: boolean; name: string; phone: string }>({ open: false, name: '', phone: '' });
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);
  const [pendingMembership, setPendingMembership] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !vipSessionId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [{ data, error }, { data: sessionRow }] = await Promise.all([
        supabase
          .from('vip_registrations' as any)
          .select('id, first_name, last_name, phone, email, outcome, created_at, birthday, weight_lbs, membership_type, commission_amount, is_group_contact, attending_class')
          .eq('vip_session_id', vipSessionId)
          .or('is_group_contact.eq.false,attending_class.eq.true')
          .order('is_group_contact', { ascending: false })
          .order('created_at', { ascending: true }),
        supabase
          .from('vip_sessions' as any)
          .select('coach_name, sa_setup_name, session_date, session_time')
          .eq('id', vipSessionId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (error) {
        toast.error('Failed to load registrations');
        setRegs([]);
      } else {
        setRegs((data as any as RegRow[]) || []);
      }
      setVipCoach((sessionRow as any)?.coach_name || '');
      setVipSaSetup((sessionRow as any)?.sa_setup_name || '');
      setVipSessionDate((sessionRow as any)?.session_date || null);
      setVipSessionTime((sessionRow as any)?.session_time || null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, vipSessionId]);

  const saveVipCoach = async (coach: string) => {
    setVipCoach(coach);
    setSavingCoach(true);
    try {
      const { error } = await supabase
        .from('vip_sessions' as any)
        .update({ coach_name: coach || null })
        .eq('id', vipSessionId);
      if (error) throw error;
      toast.success('VIP class coach saved');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save coach');
    } finally {
      setSavingCoach(false);
    }
  };

  const saveVipSaSetup = async (sa: string) => {
    setVipSaSetup(sa);
    setSavingSaSetup(true);
    try {
      const { error } = await supabase
        .from('vip_sessions' as any)
        .update({ sa_setup_name: sa || null })
        .eq('id', vipSessionId);
      if (error) throw error;
      setSaSetupSaved(true);
      setTimeout(() => setSaSetupSaved(false), 2000);
      notifyDataChanged(['vip_sessions', 'sa-leads-booked'], 'vip-sa-setup-edit');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save SA setup');
    } finally {
      setSavingSaSetup(false);
    }
  };

  const saveOutcome = async (regId: string, outcome: string) => {
    const prev = regs;
    const reg = regs.find(r => r.id === regId);
    const wasPurchased = reg?.outcome === 'purchased';

    // Selecting Purchased: open the membership picker. Don't write the
    // outcome until the SA confirms a tier (savePurchase handles all writes).
    if (outcome === 'purchased') {
      setRegs(curr => curr.map(r => r.id === regId ? { ...r, outcome: 'purchased' } : r));
      setPendingMembership(curr => ({
        ...curr,
        [regId]: reg?.membership_type || VIP_MEMBERSHIP_OPTIONS[0].label,
      }));
      return;
    }

    setRegs(curr => curr.map(r => r.id === regId ? {
      ...r, outcome, membership_type: outcome === 'purchased' ? r.membership_type : null,
      commission_amount: outcome === 'purchased' ? r.commission_amount : null,
    } : r));
    setPendingMembership(curr => { const n = { ...curr }; delete n[regId]; return n; });
    setSavingId(regId);
    try {
      // If reverting away from a previously saved purchase, soft-cancel the auto-created intro pair first
      if (wasPurchased) {
        await softCancelVipPurchase(regId, userName || 'Unknown');
      }
      const { error } = await supabase
        .from('vip_registrations' as any)
        .update({
          outcome,
          outcome_logged_at: new Date().toISOString(),
          outcome_logged_by: userName || null,
        })
        .eq('id', regId);
      if (error) throw error;

      // VIP no-shows → SA reschedule task. Coaches don't chase no-shows.
      if (outcome === 'no_show') {
        const fullName = [reg?.first_name, reg?.last_name].filter(Boolean).join(' ').trim() || 'Unnamed';
        const today = new Date().toISOString().slice(0, 10);
        const { data: existing } = await supabase
          .from('follow_up_queue')
          .select('id')
          .eq('person_name', fullName)
          .eq('person_type', 'vip_no_show')
          .eq('scheduled_date', today)
          .limit(1);
        if (!existing || existing.length === 0) {
          await supabase.from('follow_up_queue').insert({
            person_name: fullName,
            person_type: 'vip_no_show',
            owner_role: 'SA',
            scheduled_date: today,
            trigger_date: today,
            touch_number: 1,
            status: 'pending',
            is_vip: true,
            fitness_goal: 'VIP no-show — try to reschedule into a real intro',
          } as any);
        }
        toast.success('Logged no-show — sent to SA reschedule queue');
      } else {
        toast.success('Saved');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to save outcome');
      setRegs(prev);
    } finally {
      setSavingId(null);
    }

    if (outcome === 'booked_intro') {
      setBookIntroPrefill({
        firstName: reg?.first_name || '',
        lastName: reg?.last_name || '',
        phone: reg?.phone || '',
      });
      setBookIntroOpen(true);
    }
  };

  const savePurchase = async (regId: string) => {
    const reg = regs.find(r => r.id === regId);
    if (!reg) return;
    const membership = pendingMembership[regId];
    if (!membership) { toast.error('Select a membership tier'); return; }
    if (!vipCoach) { toast.error('Select a class coach first (top of sheet)'); return; }

    setSavingId(regId);
    try {
      await saveVipPurchase({
        registrationId: regId,
        firstName: reg.first_name,
        lastName: reg.last_name,
        phone: reg.phone,
        email: reg.email,
        vipSessionId,
        vipSessionDate,
        vipSessionTime,
        vipCoach,
        membership,
        saName: userName || 'Unknown',
      });
      const commission = VIP_MEMBERSHIP_OPTIONS.find(m => m.label === membership)?.commission ?? 0;
      setRegs(curr => curr.map(r => r.id === regId ? {
        ...r, outcome: 'purchased', membership_type: membership, commission_amount: commission,
      } : r));
      setPendingMembership(curr => { const n = { ...curr }; delete n[regId]; return n; });
      toast.success(`Purchase saved — $${commission.toFixed(2)} to ${vipCoach}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to save purchase');
    } finally {
      setSavingId(null);
    }
  };

  const cancelPurchaseEdit = (regId: string) => {
    const reg = regs.find(r => r.id === regId);
    setPendingMembership(curr => { const n = { ...curr }; delete n[regId]; return n; });
    // If they hadn't actually saved a purchase yet, revert outcome to whatever DB still says (refetch-light: use commission_amount as proxy)
    if (!reg?.membership_type) {
      setRegs(curr => curr.map(r => r.id === regId ? { ...r, outcome: null } : r));
    }
  };

  const totalRegistered = regs.length;
  const summary = useMemo(() => {
    let noShow = 0;
    let attended = 0;
    let bookedIntro = 0;
    let purchased = 0;
    let purchaseNeedsTier = 0;
    let unlogged = 0;
    for (const r of regs) {
      if (!r.outcome) { unlogged++; continue; }
      if (r.outcome === 'no_show') noShow++;
      if (r.outcome === 'showed' || r.outcome === 'booked_intro' || r.outcome === 'purchased') attended++;
      if (r.outcome === 'booked_intro' || r.outcome === 'purchased') bookedIntro++;
      if (r.outcome === 'purchased') {
        purchased++;
        if (!r.membership_type) purchaseNeedsTier++;
      }
    }
    return { noShow, attended, bookedIntro, purchased, purchaseNeedsTier, unlogged, anyLogged: noShow + attended > 0 };
  }, [regs]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{vipGroupName || 'VIP Group'}</SheetTitle>
          <SheetDescription>
            {totalRegistered} registered for this VIP class.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1.5">
          <Label className="text-xs font-semibold">
            Who coached this VIP class? <span className="text-destructive">*</span>
          </Label>
          <Select value={vipCoach} onValueChange={saveVipCoach} disabled={savingCoach}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Select VIP class coach…" />
            </SelectTrigger>
            <SelectContent>
              {COACHES.map(c => (
                <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">
            Sale credits go to this coach for any VIP-class attendee who buys — even if a different coach runs their follow-up intro.
          </p>
        </div>

        <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">
              Which SA found and set up this VIP class?
            </Label>
            {saSetupSaved && <span className="text-[10px] text-success">Saved</span>}
          </div>
          <Select value={vipSaSetup} onValueChange={saveVipSaSetup} disabled={savingSaSetup}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Select SA who set this up…" />
            </SelectTrigger>
            <SelectContent>
              {SAS.map(s => (
                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">
            This SA gets credit for every intro booked from this VIP class toward their weekly leads booked.
          </p>
        </div>

        <div className="mt-4 rounded-lg border bg-card p-4 space-y-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2.5">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold leading-tight">{totalRegistered}</div>
                  <div className="text-xs text-muted-foreground">people registered</div>
                </div>
              </div>
              {summary.anyLogged && (
                <div className="text-xs text-muted-foreground border-t pt-2 space-y-1">
                  <div>
                    <span className="font-medium text-foreground">{summary.attended} showed</span>
                    {' · '}
                    <span>{summary.noShow} no-show</span>
                    {summary.unlogged > 0 && (
                      <span className="text-muted-foreground"> · {summary.unlogged} still need outcome logged</span>
                    )}
                  </div>
                  {summary.attended > 0 && (
                    <div>
                      Of those {summary.attended} who showed → <span className="font-medium text-foreground">{summary.bookedIntro} booked an intro</span>
                      {summary.purchased > 0 && (
                        <> · <span className="font-medium text-foreground">{summary.purchased} purchased</span></>
                      )}
                    </div>
                  )}
                  {summary.purchaseNeedsTier > 0 && (
                    <div className="text-warning dark:text-warning">
                      ⚠ {summary.purchaseNeedsTier} purchase{summary.purchaseNeedsTier !== 1 ? 's' : ''} need membership tier selected
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {!loading && regs.length > 0 && (
          <div className="mt-4 rounded-lg border bg-card divide-y">
            {regs.map((r) => {
              const fullName = [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || 'Unnamed';
              const copyPhone = async () => {
                if (!r.phone) return;
                await navigator.clipboard.writeText(r.phone);
                setCopiedPhoneId(r.id);
                toast.success('Phone copied!');
                setTimeout(() => setCopiedPhoneId(curr => (curr === r.id ? null : curr)), 2000);
              };
              const showMembershipPicker = r.outcome === 'purchased' && (pendingMembership[r.id] !== undefined || !r.membership_type);
              return (
                <div key={r.id} className="p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex-1 min-w-[140px]">
                      <div className="text-sm font-medium truncate flex items-center gap-1.5">
                        {fullName}
                        {r.is_group_contact && (
                          <span className="text-[9px] font-bold uppercase tracking-wide bg-brand/15 text-brand border border-brand/40 rounded px-1.5 py-0.5">
                            Group Contact
                          </span>
                        )}
                      </div>
                      {r.email && (
                        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          ✉ <a href={`mailto:${r.email}`} className="hover:underline">{r.email}</a>
                        </div>
                      )}
                      {(r.birthday || r.weight_lbs) && (
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                          {r.birthday && (
                            <span>🎂 {(() => {
                              try {
                                const [y, m, d] = r.birthday.split('-').map(Number);
                                if (y && m && d) {
                                  return `${String(m).padStart(2,'0')}/${String(d).padStart(2,'0')}/${y}`;
                                }
                                return r.birthday;
                              } catch { return r.birthday; }
                            })()}</span>
                          )}
                          {r.weight_lbs && <span>⚖ {r.weight_lbs} lb</span>}
                        </div>
                      )}
                      {r.outcome === 'purchased' && r.membership_type && !showMembershipPicker && (
                        <div className="text-[11px] mt-1 flex items-center gap-2">
                          <span className="font-medium text-success dark:text-success">
                            Purchased — {r.membership_type} — ${(r.commission_amount ?? 0).toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPendingMembership(curr => ({ ...curr, [r.id]: r.membership_type! }))}
                            className="text-primary underline cursor-pointer"
                          >
                            edit
                          </button>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 min-h-[36px] text-[11px] gap-1 cursor-pointer"
                      onClick={copyPhone}
                      disabled={!r.phone}
                    >
                      {copiedPhoneId === r.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedPhoneId === r.id ? 'Copied!' : 'Copy'}
                    </Button>
                    <Button
                      size="sm"
                      className="h-9 min-h-[36px] text-[11px] gap-1 cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground"
                      onClick={() => setScriptDrawer({ open: true, name: fullName, phone: r.phone || '' })}
                    >
                      <Send className="w-3.5 h-3.5" />
                      Script
                    </Button>
                    <Select
                      value={r.outcome || ''}
                      onValueChange={(v) => saveOutcome(r.id, v)}
                      disabled={savingId === r.id}
                    >
                      <SelectTrigger className="h-9 w-36 text-xs">
                        <SelectValue placeholder="Log outcome…" />
                      </SelectTrigger>
                      <SelectContent>
                        {OUTCOME_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {showMembershipPicker && (
                    <div className="ml-1 rounded-md border border-warning dark:border-warning bg-warning-dim dark:bg-warning/30 p-2 space-y-2">
                      <div className="text-[11px] font-semibold">Which membership did they buy?</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={pendingMembership[r.id] || r.membership_type || VIP_MEMBERSHIP_OPTIONS[0].label}
                          onValueChange={(v) => setPendingMembership(curr => ({ ...curr, [r.id]: v }))}
                          disabled={savingId === r.id}
                        >
                          <SelectTrigger className="h-9 flex-1 min-w-[180px] text-xs bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VIP_MEMBERSHIP_OPTIONS.map(m => (
                              <SelectItem key={m.label} value={m.label} className="text-xs">
                                {m.label} (${m.commission.toFixed(2)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="h-9 text-[11px] cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground"
                          onClick={() => savePurchase(r.id)}
                          disabled={savingId === r.id || !vipCoach}
                        >
                          {savingId === r.id ? 'Saving…' : 'Save purchase'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 text-[11px] cursor-pointer"
                          onClick={() => cancelPurchaseEdit(r.id)}
                          disabled={savingId === r.id}
                        >
                          Cancel
                        </Button>
                      </div>
                      {!vipCoach && (
                        <div className="text-[10px] text-destructive">Select the class coach at the top of the sheet first — they receive the sale credit.</div>
                      )}
                      <div className="text-[10px] text-muted-foreground">
                        Saving creates a SHOWED + SALE intro for {vipCoach || 'the class coach'} so the coach can run a First Visit Scorecard on the coach side.
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Booked an intro from this group?</strong> Use the standard
            Book Intro sheet on the floor — set lead source to <em>VIP Class</em>. The booking will tie back
            to this session automatically and credit the coach above on any sale.
          </p>
        </div>
      </SheetContent>
      <BookIntroSheet
        open={bookIntroOpen}
        onOpenChange={setBookIntroOpen}
        onSaved={() => setBookIntroOpen(false)}
        prefillFirstName={bookIntroPrefill?.firstName}
        prefillLastName={bookIntroPrefill?.lastName}
        prefillPhone={bookIntroPrefill?.phone}
        prefillLeadSource="VIP Class"
        prefillVipSessionId={vipSessionId}
        prefillCoach={vipCoach}
      />
      <ScriptSendDrawer
        open={scriptDrawer.open}
        onOpenChange={(open) => setScriptDrawer(s => ({ ...s, open }))}
        leadName={scriptDrawer.name}
        leadPhone={scriptDrawer.phone}
        categoryFilter="vip_class"
        saName={userName || ''}
        coachContextFallback={vipCoach || null}
        classDate={vipSessionDate}
        classTime={vipSessionTime}
      />
    </Sheet>
  );
}
