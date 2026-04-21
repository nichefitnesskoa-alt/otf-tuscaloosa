/**
 * Sheet showing all VIP session registrants with their full registration details
 * and per-attendee outcome logging.
 *
 * When the SA picks "Booked an Intro" for a registrant, an inline booking form
 * appears that creates a real `intros_booked` row (with VIP source attribution),
 * a questionnaire, and optionally a paired friend booking + referral.
 */
import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Phone, Mail, Save, Check, Users } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatPhoneDisplay } from '@/lib/parsing/phone';
import { COACHES } from '@/types';
import { ClassTimeSelect, DatePickerField, formatPhoneAsYouType, autoCapitalizeName } from '@/components/shared/FormHelpers';
import { autoCreateQuestionnaire } from '@/lib/introHelpers';
import { generateUniqueSlug } from '@/lib/utils';

interface Registration {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  weight_lbs: number | null;
  fitness_level: number | null;
  injuries: string | null;
  is_group_contact: boolean;
  created_at: string;
  outcome: string | null;
  outcome_notes: string | null;
  outcome_logged_at: string | null;
  outcome_logged_by: string | null;
}

const OUTCOME_OPTIONS = [
  { value: 'showed', label: 'Showed' },
  { value: 'no_show', label: 'No-Show' },
  { value: 'interested', label: 'Interested — follow up' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'booked_intro', label: 'Booked an Intro' },
  { value: 'purchased', label: 'Purchased Membership' },
];

interface BookingDraft {
  classDate: string;
  classTime: string;
  coach: string;
  bringingFriend: 'yes' | 'no' | null;
  friendFirstName: string;
  friendLastName: string;
  friendPhone: string;
}

const emptyBooking = (): BookingDraft => ({
  classDate: format(new Date(), 'yyyy-MM-dd'),
  classTime: '',
  coach: '',
  bringingFriend: null,
  friendFirstName: '',
  friendLastName: '',
  friendPhone: '',
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vipSessionId: string;
  vipGroupName: string | null;
  userName: string;
}

export default function VipRegistrationsSheet({ open, onOpenChange, vipSessionId, vipGroupName, userName }: Props) {
  const [loading, setLoading] = useState(false);
  const [regs, setRegs] = useState<Registration[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { outcome: string; notes: string }>>({});
  const [bookingDrafts, setBookingDrafts] = useState<Record<string, BookingDraft>>({});
  const [vipCoach, setVipCoach] = useState<string>('');
  const [savingCoach, setSavingCoach] = useState(false);

  useEffect(() => {
    if (!open || !vipSessionId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [{ data, error }, { data: sessionRow }] = await Promise.all([
        supabase
          .from('vip_registrations' as any)
          .select('*')
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
        const list = (data as any as Registration[]) || [];
        setRegs(list);
        const initial: Record<string, { outcome: string; notes: string }> = {};
        for (const r of list) initial[r.id] = { outcome: r.outcome || '', notes: r.outcome_notes || '' };
        setDrafts(initial);
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

  const setOutcome = (regId: string, value: string) => {
    setDrafts(prev => ({ ...prev, [regId]: { ...(prev[regId] || { outcome: '', notes: '' }), outcome: value } }));
    if (value === 'booked_intro' && !bookingDrafts[regId]) {
      setBookingDrafts(prev => ({ ...prev, [regId]: emptyBooking() }));
    }
  };

  const updateBookingDraft = (regId: string, patch: Partial<BookingDraft>) => {
    setBookingDrafts(prev => ({ ...prev, [regId]: { ...(prev[regId] || emptyBooking()), ...patch } }));
  };

  const handleSaveOutcomeOnly = async (regId: string) => {
    const draft = drafts[regId];
    if (!draft || !draft.outcome) {
      toast.error('Pick an outcome first');
      return;
    }
    setSavingId(regId);
    try {
      const { error } = await supabase
        .from('vip_registrations' as any)
        .update({
          outcome: draft.outcome,
          outcome_notes: draft.notes || null,
          outcome_logged_at: new Date().toISOString(),
          outcome_logged_by: userName,
        })
        .eq('id', regId);
      if (error) throw error;
      setRegs(prev => prev.map(r => r.id === regId ? {
        ...r,
        outcome: draft.outcome,
        outcome_notes: draft.notes || null,
        outcome_logged_at: new Date().toISOString(),
        outcome_logged_by: userName,
      } : r));
      toast.success('Outcome saved');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save outcome');
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveBooking = async (reg: Registration) => {
    const bd = bookingDrafts[reg.id] || emptyBooking();
    const draft = drafts[reg.id] || { outcome: 'booked_intro', notes: '' };

    if (!vipCoach) { toast.error('Select who coached this VIP class first (top of sheet)'); return; }
    if (!bd.classDate) { toast.error('Class date is required'); return; }
    if (!bd.classTime) { toast.error('Class time is required'); return; }
    if (!bd.coach) { toast.error('Coach is required'); return; }
    if (bd.bringingFriend === 'yes') {
      if (!bd.friendFirstName.trim()) { toast.error('Friend first name is required'); return; }
      if (!bd.friendPhone.trim()) { toast.error('Friend phone is required'); return; }
    }

    const memberName = `${reg.first_name || ''} ${reg.last_name || ''}`.trim() || 'Unnamed';
    const classStartAt = `${bd.classDate}T${bd.classTime}:00`;
    const h = new Date().getHours();
    const shiftLabel = h < 11 ? 'AM Shift' : h < 16 ? 'Mid Shift' : 'PM Shift';

    setSavingId(reg.id);
    try {
      // 1. Create primary booking — no questionnaire (VIP Class intro)
      const { data: inserted, error: insertErr } = await supabase.from('intros_booked').insert({
        member_name: memberName,
        class_date: bd.classDate,
        intro_time: bd.classTime,
        class_start_at: classStartAt,
        coach_name: bd.coach,
        lead_source: 'VIP Class',
        sa_working_shift: shiftLabel,
        booked_by: userName,
        intro_owner: userName,
        intro_owner_locked: false,
        phone: reg.phone || null,
        email: reg.email || null,
        booking_type_canon: 'STANDARD',
        booking_status_canon: 'ACTIVE',
        questionnaire_status_canon: 'not_required',
        is_vip: false,
        vip_session_id: vipSessionId,
      }).select('id').single();
      if (insertErr) throw insertErr;

      // 3. Friend booking (optional)
      if (inserted?.id && bd.bringingFriend === 'yes' && bd.friendFirstName.trim()) {
        const friendFullName = `${bd.friendFirstName.trim()} ${bd.friendLastName.trim()}`.trim();
        const { data: friendBooking } = await supabase.from('intros_booked').insert({
          member_name: friendFullName,
          class_date: bd.classDate,
          intro_time: bd.classTime,
          class_start_at: classStartAt,
          coach_name: bd.coach,
          lead_source: 'VIP Class (Friend)',
          sa_working_shift: shiftLabel,
          booked_by: userName,
          intro_owner: userName,
          intro_owner_locked: false,
          phone: bd.friendPhone.trim() || null,
          booking_type_canon: 'STANDARD',
          booking_status_canon: 'ACTIVE',
          questionnaire_status_canon: 'not_required',
          is_vip: false,
          vip_session_id: vipSessionId,
          paired_booking_id: inserted.id,
          referred_by_member_name: memberName,
        }).select('id').single();

        if (friendBooking?.id) {
          await Promise.all([
            supabase.from('intros_booked').update({ paired_booking_id: friendBooking.id }).eq('id', inserted.id),
            supabase.from('referrals').insert({
              referrer_name: memberName,
              referred_name: friendFullName,
              referrer_booking_id: inserted.id,
              referred_booking_id: friendBooking.id,
              discount_applied: false,
            }),
          ]);
        }
      }

      // 4. Update registration outcome
      const nowIso = new Date().toISOString();
      const { error: updErr } = await supabase
        .from('vip_registrations' as any)
        .update({
          outcome: 'booked_intro',
          outcome_notes: draft.notes || null,
          outcome_logged_at: nowIso,
          outcome_logged_by: userName,
        })
        .eq('id', reg.id);
      if (updErr) throw updErr;

      setRegs(prev => prev.map(r => r.id === reg.id ? {
        ...r,
        outcome: 'booked_intro',
        outcome_notes: draft.notes || null,
        outcome_logged_at: nowIso,
        outcome_logged_by: userName,
      } : r));

      const friendSuffix = bd.bringingFriend === 'yes' && bd.friendFirstName.trim() ? ` + ${bd.friendFirstName.trim()}` : '';
      toast.success(`${memberName}${friendSuffix} booked for ${format(new Date(bd.classDate + 'T12:00:00'), 'MMM d')}`);
      window.dispatchEvent(new CustomEvent('myday:walk-in-added'));
    } catch (e: any) {
      console.error('VIP booking save error:', e);
      toast.error(e?.message || 'Failed to create booking');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{vipGroupName || 'VIP Group'} — Registrants</SheetTitle>
          <SheetDescription>
            {regs.length} registered. Log an outcome for each attendee.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {!loading && regs.length === 0 && (
            <div className="text-sm text-muted-foreground">No registrations yet.</div>
          )}
          {!loading && regs.map(r => {
            const fullName = `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Unnamed';
            const draft = drafts[r.id] || { outcome: '', notes: '' };
            const isLogged = !!r.outcome;
            const showBookingForm = draft.outcome === 'booked_intro';
            const bd = bookingDrafts[r.id] || emptyBooking();
            return (
              <div key={r.id} className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{fullName}</span>
                      {isLogged && (
                        <Badge className="text-[9px] px-1.5 py-0 h-4 bg-emerald-600 text-white border-transparent gap-0.5">
                          <Check className="w-2.5 h-2.5" /> {OUTCOME_OPTIONS.find(o => o.value === r.outcome)?.label || r.outcome}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  {r.phone && formatPhoneDisplay(r.phone) && (
                    <a
                      href={`sms:+1${(r.phone || '').replace(/\D/g, '').replace(/^1/, '').slice(-10)}`}
                      className="flex items-center gap-1 text-primary underline min-h-[28px]"
                    >
                      <Phone className="w-3 h-3" /> {formatPhoneDisplay(r.phone)}
                    </a>
                  )}
                  {r.email && (
                    <a href={`mailto:${r.email}`} className="flex items-center gap-1 text-primary underline truncate min-h-[28px]">
                      <Mail className="w-3 h-3" /> <span className="truncate">{r.email}</span>
                    </a>
                  )}
                  {r.birthday && (
                    <div><span className="text-muted-foreground">DOB: </span>{r.birthday}</div>
                  )}
                  {r.weight_lbs != null && (
                    <div><span className="text-muted-foreground">Weight: </span>{r.weight_lbs} lbs</div>
                  )}
                  {r.fitness_level != null && (
                    <div><span className="text-muted-foreground">Fitness: </span>{r.fitness_level}/10</div>
                  )}
                </div>
                {r.injuries && (
                  <div className="text-xs"><span className="text-muted-foreground">Injuries/Notes: </span>{r.injuries}</div>
                )}

                <div className="pt-2 border-t space-y-2">
                  <div className="flex gap-2 items-center">
                    <Select
                      value={draft.outcome}
                      onValueChange={(v) => setOutcome(r.id, v)}
                    >
                      <SelectTrigger className="h-9 text-xs flex-1">
                        <SelectValue placeholder="Select outcome…" />
                      </SelectTrigger>
                      <SelectContent>
                        {OUTCOME_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!showBookingForm && (
                      <Button
                        size="sm"
                        className="h-9 gap-1 text-xs"
                        onClick={() => handleSaveOutcomeOnly(r.id)}
                        disabled={savingId === r.id}
                      >
                        <Save className="w-3.5 h-3.5" />
                        {savingId === r.id ? 'Saving…' : 'Save'}
                      </Button>
                    )}
                  </div>

                  {showBookingForm && (
                    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3">
                      <div className="text-xs font-semibold text-primary">Book intro for {fullName}</div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Class Date</Label>
                        <DatePickerField
                          value={bd.classDate}
                          onChange={(v) => updateBookingDraft(r.id, { classDate: v })}
                          className="h-9 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Class Time</Label>
                        <ClassTimeSelect
                          value={bd.classTime}
                          onValueChange={(v) => updateBookingDraft(r.id, { classTime: v })}
                          triggerClassName="h-9 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Coach</Label>
                        <Select value={bd.coach} onValueChange={(v) => updateBookingDraft(r.id, { coach: v })}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Select coach…" />
                          </SelectTrigger>
                          <SelectContent>
                            {COACHES.map(c => (
                              <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-1.5">
                          <Users className="w-3 h-3" /> Bringing a friend?
                        </Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={bd.bringingFriend === 'yes' ? 'default' : 'outline'}
                            className="h-8 text-xs flex-1"
                            onClick={() => updateBookingDraft(r.id, { bringingFriend: 'yes' })}
                          >Yes</Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={bd.bringingFriend === 'no' ? 'default' : 'outline'}
                            className="h-8 text-xs flex-1"
                            onClick={() => updateBookingDraft(r.id, { bringingFriend: 'no', friendFirstName: '', friendLastName: '', friendPhone: '' })}
                          >No</Button>
                        </div>
                      </div>

                      {bd.bringingFriend === 'yes' && (
                        <div className="space-y-2 rounded border border-border bg-card p-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[10px]">Friend First Name</Label>
                              <Input
                                value={bd.friendFirstName}
                                onChange={(e) => updateBookingDraft(r.id, { friendFirstName: autoCapitalizeName(e.target.value) })}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">Friend Last Name</Label>
                              <Input
                                value={bd.friendLastName}
                                onChange={(e) => updateBookingDraft(r.id, { friendLastName: autoCapitalizeName(e.target.value) })}
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Friend Phone</Label>
                            <Input
                              value={bd.friendPhone}
                              onChange={(e) => updateBookingDraft(r.id, { friendPhone: formatPhoneAsYouType(e.target.value) })}
                              placeholder="(555) 123-4567"
                              className="h-8 text-xs"
                              inputMode="tel"
                            />
                          </div>
                        </div>
                      )}

                      <Button
                        size="sm"
                        className="h-9 w-full gap-1 text-xs"
                        onClick={() => handleSaveBooking(r)}
                        disabled={savingId === r.id}
                      >
                        <Save className="w-3.5 h-3.5" />
                        {savingId === r.id ? 'Saving…' : 'Save Booking'}
                      </Button>
                    </div>
                  )}

                  <Textarea
                    placeholder="Notes (optional)"
                    value={draft.notes}
                    onChange={(e) => setDrafts(prev => ({ ...prev, [r.id]: { ...(prev[r.id] || { outcome: '', notes: '' }), notes: e.target.value } }))}
                    className="text-xs min-h-[60px]"
                  />
                  {r.outcome_logged_by && r.outcome_logged_at && (
                    <div className="text-[10px] text-muted-foreground">
                      Logged by {r.outcome_logged_by} · {new Date(r.outcome_logged_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
