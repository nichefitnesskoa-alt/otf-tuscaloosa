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
import { COACHES } from '@/types';
import { BookIntroSheet } from '@/components/dashboard/BookIntroSheet';
import { ScriptSendDrawer } from '@/components/scripts/ScriptSendDrawer';

interface RegRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  outcome: string | null;
  created_at: string;
  birthday: string | null;
  weight_lbs: number | null;
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
  const [loading, setLoading] = useState(false);
  const [regs, setRegs] = useState<RegRow[]>([]);
  const [vipCoach, setVipCoach] = useState<string>('');
  const [savingCoach, setSavingCoach] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bookIntroOpen, setBookIntroOpen] = useState(false);
  const [bookIntroPrefill, setBookIntroPrefill] = useState<{ firstName: string; lastName: string; phone: string } | null>(null);
  const [scriptDrawer, setScriptDrawer] = useState<{ open: boolean; name: string; phone: string }>({ open: false, name: '', phone: '' });
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !vipSessionId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [{ data, error }, { data: sessionRow }] = await Promise.all([
        supabase
          .from('vip_registrations' as any)
          .select('id, first_name, last_name, phone, outcome, created_at, birthday, weight_lbs')
          .eq('vip_session_id', vipSessionId)
          .eq('is_group_contact', false)
          .order('created_at', { ascending: true }),
        supabase
          .from('vip_sessions' as any)
          .select('coach_name')
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

  const saveOutcome = async (regId: string, outcome: string) => {
    const prev = regs;
    setRegs(curr => curr.map(r => r.id === regId ? { ...r, outcome } : r));
    setSavingId(regId);
    try {
      const { error } = await supabase
        .from('vip_registrations' as any)
        .update({
          outcome,
          outcome_logged_at: new Date().toISOString(),
          outcome_logged_by: userName || null,
        })
        .eq('id', regId);
      if (error) throw error;
      toast.success('Saved');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save outcome');
      setRegs(prev);
    } finally {
      setSavingId(null);
    }

    // If user picked Booked intro, open the standard Book Intro sheet pre-filled
    if (outcome === 'booked_intro') {
      const reg = regs.find(r => r.id === regId);
      setBookIntroPrefill({
        firstName: reg?.first_name || '',
        lastName: reg?.last_name || '',
        phone: reg?.phone || '',
      });
      setBookIntroOpen(true);
    }
  };

  const totalRegistered = regs.length;
  const summary = useMemo(() => {
    let noShow = 0;
    let attended = 0;
    let bookedIntro = 0;
    let unlogged = 0;
    for (const r of regs) {
      if (!r.outcome) { unlogged++; continue; }
      if (r.outcome === 'no_show') noShow++;
      if (r.outcome === 'showed' || r.outcome === 'booked_intro' || r.outcome === 'purchased') attended++;
      if (r.outcome === 'booked_intro' || r.outcome === 'purchased') bookedIntro++;
    }
    return { noShow, attended, bookedIntro, unlogged, anyLogged: noShow + attended > 0 };
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
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-2 p-3">
                  <div className="flex-1 min-w-[140px]">
                    <div className="text-sm font-medium truncate">{fullName}</div>
                    {(r.birthday || r.weight_lbs) && (
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                        {r.birthday && (
                          <span>🎂 {(() => {
                            try {
                              // birthday is a date string like '1995-03-14'
                              const [y, m, d] = r.birthday.split('-').map(Number);
                              const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                              if (m && d) return `${months[m-1]} ${d}`;
                              return r.birthday;
                            } catch { return r.birthday; }
                          })()}</span>
                        )}
                        {r.weight_lbs && <span>⚖ {r.weight_lbs} lb</span>}
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
      />
    </Sheet>
  );
}
