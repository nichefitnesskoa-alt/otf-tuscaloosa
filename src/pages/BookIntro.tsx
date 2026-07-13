/**
 * Public intro booking page (/book).
 *
 * Multi-step: pick time → info → book → add to calendar → friend yes/no → questionnaire handoff.
 * No auth. SA credit encoded in URL params (?sa=... &source=... &event_id=...).
 * Friend flow: ?friend_of=<uuid> locks the time to the originator's slot.
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useBookableSlots,
  useSlotOverrides,
  materializeBookableDays,
} from '@/hooks/useBookableSlots';
import { formatClassTimeDisplay } from '@/lib/classSchedule';
import {
  downloadIntroIcs,
  buildGoogleCalendarUrl,
  buildIntroCalendarDescription,
} from '@/lib/introScheduler/calendar';
import {
  buildFriendLinkUrl,
  buildShortFriendUrl,
  friendSourceFor,
  resolveIntroLinkCode,
  resolveFriendCodeStrict,
  ensureFriendCode,
  PUBLIC_BOOKING_BASE,
} from '@/lib/introScheduler/linkUrl';
import { stripCountryCode } from '@/lib/parsing/phone';
import { generateUniqueSlug } from '@/lib/utils';
import { CalendarIcon, Check, Copy, Share2, Users, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';

import { InlineQuestionnaire } from '@/features/bookIntro/InlineQuestionnaire';

type Step = 'time' | 'info' | 'questions' | 'calendar' | 'friend' | 'done';

const infoSchema = z.object({
  firstName: z.string().trim().min(1, 'First name required').max(60),
  lastName: z.string().trim().min(1, 'Last name required').max(60),
  phone: z.string().trim().min(10, 'Phone required'),
  email: z.string().trim().email('Valid email required').max(120),
});

function dayLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(x => parseInt(x, 10));
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function longDayLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(x => parseInt(x, 10));
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

export default function BookIntro() {
  const [params] = useSearchParams();
  const routeParams = useParams<{ code?: string; friendCode?: string }>();
  const shortCode = routeParams.code || null;
  const shortFriendCode = routeParams.friendCode || null;

  const saParam = params.get('sa') || 'Studio Team';
  const sourceParam = params.get('source') || 'Intro Scheduler Link';
  const eventIdParam = params.get('event_id');
  const legacyFriendOf = params.get('friend_of');

  const [friendOf, setFriendOf] = useState<string | null>(legacyFriendOf);
  const [resolvingCode, setResolvingCode] = useState<boolean>(!!(shortCode || shortFriendCode));

  const [step, setStep] = useState<Step>('time');
  const [ctx, setCtx] = useState<{
    sa: string;
    source: string;
    eventId: string | null;
    originatorId: string | null;
    originatorFirst: string | null;
    lockedDate: string | null;
    lockedTime: string | null;
  }>({
    sa: saParam,
    source: sourceParam,
    eventId: eventIdParam,
    originatorId: null,
    originatorFirst: null,
    lockedDate: null,
    lockedTime: null,
  });

  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [pickedTime, setPickedTime] = useState<string | null>(null);
  const [info, setInfo] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [friendShareCode, setFriendShareCode] = useState<string | null>(null);
  const [qSlug, setQSlug] = useState<string | null>(null);
  // Snapshot the exact URL the visitor landed on — permanent audit trail.
  const [entryUrl] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.href : ''
  );

  // Resolve short SA link code: /book-intro/<code> → sa / source / event_id
  useEffect(() => {
    if (!shortCode) return;
    (async () => {
      const resolved = await resolveIntroLinkCode(shortCode);
      if (resolved) {
        setCtx(prev => ({
          ...prev,
          sa: resolved.sa,
          source: resolved.source,
          eventId: resolved.eventId ?? null,
        }));
      } else {
        toast.error('This booking link is no longer valid.');
      }
      setResolvingCode(false);
    })();
  }, [shortCode]);

  // Resolve short friend code: /book-intro/f/<friendCode> → originator booking id
  // Distinguishes error vs not_found so a network/RLS failure never silently
  // degrades a friend booking into a plain SA-link booking.
  const [friendResolveError, setFriendResolveError] = useState<string | null>(null);
  useEffect(() => {
    if (!shortFriendCode) return;
    (async () => {
      const r = await resolveFriendCodeStrict(shortFriendCode);
      if (r.status === 'ok') {
        setFriendOf(r.originatorId);
      } else if (r.status === 'not_found') {
        setFriendResolveError('This friend link is no longer valid.');
        toast.error('This friend link is no longer valid.');
      } else {
        setFriendResolveError(`Couldn't verify friend link — ${r.message}. Please refresh and try again.`);
        toast.error("Couldn't verify friend link. Please refresh and try again.");
      }
      setResolvingCode(false);
    })();
  }, [shortFriendCode]);

  // Load originator (friend flow) — lock the time and inherit SA + source
  useEffect(() => {
    if (!friendOf) return;
    (async () => {
      const { data, error } = await supabase
        .from('intros_booked')
        .select('id, member_name, class_date, intro_time, lead_source, scheduler_link_sa, booked_by, event_id')
        .eq('id', friendOf)
        .maybeSingle();
      if (error || !data) {
        toast.error('This friend link is no longer valid.');
        return;
      }
      const b = data as any;
      const first = (b.member_name || '').split(' ')[0] || 'your friend';
      const inheritedSa = b.scheduler_link_sa || b.booked_by || saParam;
      const inheritedSource = friendSourceFor(b.lead_source || sourceParam);
      const timeStr = (b.intro_time || '').slice(0, 5); // HH:mm
      setCtx({
        sa: inheritedSa,
        source: inheritedSource,
        eventId: b.event_id || eventIdParam,
        originatorId: b.id,
        originatorFirst: first,
        lockedDate: b.class_date,
        lockedTime: timeStr,
      });
      setPickedDate(b.class_date);
      setPickedTime(timeStr);
      setStep('info');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendOf]);

  const slotsQ = useBookableSlots();
  const overridesQ = useSlotOverrides();
  const days = useMemo(() =>
    materializeBookableDays(slotsQ.data || [], overridesQ.data || [], 14),
    [slotsQ.data, overridesQ.data]
  );

  // On a friend URL (/book-intro/f/<code>), submission is blocked until the
  // originator has been resolved — otherwise a fast tap or slow network could
  // silently drop what should have been a friend booking into a plain one.
  const friendResolutionPending = !!shortFriendCode && !ctx.originatorId && !friendResolveError;

  const handleBook = async () => {
    if (!pickedDate || !pickedTime) return;
    if (friendResolutionPending) {
      toast.error('Still verifying friend link — one second.');
      return;
    }
    if (friendResolveError) {
      toast.error(friendResolveError);
      return;
    }
    const parsed = infoSchema.safeParse(info);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    const phone10 = stripCountryCode(info.phone);
    if (!phone10) {
      toast.error('Enter a valid 10-digit US phone number.');
      return;
    }
    setSaving(true);
    try {
      const fullName = `${info.firstName.trim()} ${info.lastName.trim()}`.trim();

      // Dedup check on last-10 phone (only warn; we still create the booking)
      const { data: existingLeads } = await supabase
        .from('leads')
        .select('id, first_name, last_name, source, sourced_by_sa')
        .eq('phone', phone10)
        .limit(1);

      // Insert booking — credits the generating SA via booked_by + scheduler_link_sa
      const insertPayload: any = {
        member_name: fullName,
        phone: phone10,
        email: info.email.trim(),
        class_date: pickedDate,
        intro_time: pickedTime,
        coach_name: '',
        lead_source: ctx.source,
        booked_by: ctx.sa,                    // credits SA on leaderboard (not "Self booked")
        scheduler_link_sa: ctx.sa,            // durable link-attribution flag
        via_scheduler_link: true,
        sa_working_shift: ctx.sa,
        event_id: ctx.eventId || null,
        booking_type_canon: 'STANDARD',
        booking_status_canon: 'ACTIVE',
        entry_url: entryUrl || null,
        friend_code_used: shortFriendCode || null,
      };
      if (ctx.originatorId) {
        insertPayload.paired_booking_id = ctx.originatorId;
        insertPayload.referred_by_member_name = ctx.originatorFirst || null;
      }
      const { data: booking, error: bErr } = await supabase
        .from('intros_booked')
        .insert(insertPayload)
        .select('id')
        .single();
      if (bErr) throw bErr;
      const newBookingId = (booking as any).id as string;
      setBookingId(newBookingId);

      // Back-link the friend booking to the originator
      if (ctx.originatorId) {
        await supabase
          .from('intros_booked')
          .update({ paired_booking_id: newBookingId })
          .eq('id', ctx.originatorId);
        await supabase.from('referrals').insert({
          referrer_booking_id: ctx.originatorId,
          referred_booking_id: newBookingId,
          referrer_name: ctx.originatorFirst || 'Originator',
          referred_name: fullName,
        } as any);
      }

      // Insert/link lead (dedup on phone — if a lead already exists we just link it)
      const existingLead = (existingLeads || [])[0] as any;
      let leadIdForLog: string | null = null;
      if (existingLead) {
        // Never overwrite the original SA credit on a pre-existing lead.
        const leadUpdate: any = {
          booked_intro_id: newBookingId,
          stage: 'booked',
        };
        const existingSa = (existingLead.sourced_by_sa || '').trim();
        const existingSrc = (existingLead.source || '').trim();
        if (!existingSa) leadUpdate.sourced_by_sa = ctx.sa;
        if (!existingSrc) leadUpdate.source = ctx.source;
        await supabase.from('leads').update(leadUpdate).eq('id', existingLead.id);
        leadIdForLog = existingLead.id;
      } else {
        const { data: newLead } = await supabase.from('leads').insert({
          first_name: info.firstName.trim(),
          last_name: info.lastName.trim(),
          phone: phone10,
          email: info.email.trim(),
          source: ctx.source,
          stage: 'booked',
          sourced_by_sa: ctx.sa,
          booked_intro_id: newBookingId,
        } as any).select('id').maybeSingle();
        leadIdForLog = (newLead as any)?.id || null;
      }
      console.info('[IntroLink] credited SA=%s source=%s booking=%s lead=%s', ctx.sa, ctx.source, newBookingId, leadIdForLog);

      // Questionnaire slug: DB trigger auto_create_questionnaire fires — we just look it up
      // for immediate handoff. Fall back to generating one if the trigger raced us.
      let slug: string | null = null;
      for (let i = 0; i < 3 && !slug; i++) {
        const { data: q } = await supabase
          .from('intro_questionnaires')
          .select('slug')
          .eq('booking_id', newBookingId)
          .maybeSingle();
        slug = (q as any)?.slug || null;
        if (!slug) await new Promise(r => setTimeout(r, 400));
      }
      if (!slug) {
        slug = await generateUniqueSlug(info.firstName.trim(), info.lastName.trim(), supabase, undefined, pickedDate);
      }
      setQSlug(slug);

      // Mark questionnaire as "sent" on the booking + row: the link is being
      // served to the intro on the very next screen. No SA action needed.
      const nowIso = new Date().toISOString();
      try {
        await Promise.all([
          supabase.from('intros_booked').update({
            questionnaire_status_canon: 'sent',
            questionnaire_sent_at: nowIso,
          } as any).eq('id', newBookingId).is('questionnaire_completed_at', null),
          supabase.from('intro_questionnaires').update({ status: 'sent' } as any)
            .eq('booking_id', newBookingId)
            .eq('status', 'not_sent'),
        ]);
      } catch (e) {
        console.warn('Failed to stamp questionnaire sent at booking:', e);
      }

      setStep('questions');
      toast.success("You're booked!");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Booking failed — please try again.');
    } finally {
      setSaving(false);
    }
  };

  const calendarEvent = pickedDate && pickedTime ? {
    classDate: pickedDate,
    classTime: pickedTime,
    memberFirstName: info.firstName,
  } : null;

  // Auto-mint a short friend code on this booking so the share URL stays clean.
  useEffect(() => {
    if (!bookingId || friendShareCode) return;
    (async () => {
      const c = await ensureFriendCode(bookingId);
      if (c) setFriendShareCode(c);
    })();
  }, [bookingId, friendShareCode]);
  const friendUrl = friendShareCode
    ? buildShortFriendUrl(PUBLIC_BOOKING_BASE, friendShareCode)
    : bookingId
      ? buildFriendLinkUrl(PUBLIC_BOOKING_BASE, bookingId)
      : '';

  const canShareNative = typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="text-[#E8540A] font-bold tracking-widest text-xs mb-2">OTF TUSCALOOSA</div>
          <h1 className="text-3xl font-bold">Book your free intro</h1>
          {ctx.originatorFirst && ctx.lockedTime && ctx.lockedDate && (
            <p className="text-lg text-[#E8540A] mt-2">
              You're joining {ctx.originatorFirst} at {longDayLabel(ctx.lockedDate)}, {formatClassTimeDisplay(ctx.lockedTime)}.
            </p>
          )}
        </div>

        {/* STEP: time */}
        {step === 'time' && (
          <Card className="bg-neutral-900 border-neutral-800 p-5">
            <h2 className="text-xl font-semibold mb-3">Pick a class time</h2>
            <p className="text-sm text-neutral-400 mb-4">Next 14 days — Central Time.</p>
            {slotsQ.isLoading ? (
              <div className="flex items-center gap-2 text-neutral-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading schedule…
              </div>
            ) : days.length === 0 ? (
              <p className="text-neutral-400">No classes open for booking in the next 14 days.</p>
            ) : (
              <div className="space-y-4">
                {days.map(d => (
                  <div key={d.date}>
                    <div className="font-semibold text-neutral-200 mb-2">{dayLabel(d.date)}</div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {d.times.map(t => {
                        const selected = pickedDate === d.date && pickedTime === t;
                        return (
                          <button
                            key={`${d.date}-${t}`}
                            onClick={() => { setPickedDate(d.date); setPickedTime(t); }}
                            className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition ${
                              selected
                                ? 'bg-[#E8540A] border-[#E8540A] text-white'
                                : 'bg-neutral-800 border-neutral-700 hover:border-[#E8540A] text-white'
                            }`}
                          >
                            {formatClassTimeDisplay(t)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button
              className="w-full mt-6 h-12 bg-[#E8540A] hover:bg-[#c94609] text-white font-semibold"
              disabled={!pickedDate || !pickedTime}
              onClick={() => setStep('info')}
            >
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Card>
        )}

        {/* STEP: info */}
        {step === 'info' && (
          <Card className="bg-neutral-900 border-neutral-800 p-5">
            <h2 className="text-xl font-semibold mb-1">Tell us a little about you</h2>
            {pickedDate && pickedTime && (
              <p className="text-sm text-neutral-400 mb-4">
                {longDayLabel(pickedDate)} · {formatClassTimeDisplay(pickedTime)}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-neutral-300">First name</Label>
                <Input value={info.firstName} onChange={e => setInfo({ ...info, firstName: e.target.value })} className="bg-neutral-800 border-neutral-700" />
              </div>
              <div>
                <Label className="text-neutral-300">Last name</Label>
                <Input value={info.lastName} onChange={e => setInfo({ ...info, lastName: e.target.value })} className="bg-neutral-800 border-neutral-700" />
              </div>
              <div className="col-span-2">
                <Label className="text-neutral-300">Phone</Label>
                <Input value={info.phone} onChange={e => setInfo({ ...info, phone: e.target.value })} placeholder="(205) 555-1234" className="bg-neutral-800 border-neutral-700" inputMode="tel" />
              </div>
              <div className="col-span-2">
                <Label className="text-neutral-300">Email</Label>
                <Input value={info.email} onChange={e => setInfo({ ...info, email: e.target.value })} type="email" className="bg-neutral-800 border-neutral-700" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              {!ctx.lockedDate && (
                <Button
                  variant="outline"
                  onClick={() => setStep('time')}
                  className="border-[#FDF7EA]/40 bg-transparent text-[#FDF7EA] hover:bg-[#FDF7EA]/10 hover:text-[#FDF7EA]"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              )}
              <Button
                className="flex-1 h-12 bg-[#E8540A] hover:bg-[#c94609] text-white font-semibold"
                onClick={handleBook}
                disabled={saving || friendResolutionPending || !!friendResolveError}
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Booking…</>
                  : friendResolutionPending
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying friend link…</>
                    : friendResolveError
                      ? 'Friend link invalid'
                      : <>Book my spot <Check className="w-4 h-4 ml-2" /></>}
              </Button>
            </div>
          </Card>
        )}

        {/* STEP: questions (inline questionnaire, dark theme, before calendar) */}
        {step === 'questions' && bookingId && (
          <InlineQuestionnaire
            bookingId={bookingId}
            firstName={info.firstName || 'friend'}
            onComplete={() => setStep('calendar')}
          />
        )}



        {/* STEP: calendar */}
        {step === 'calendar' && calendarEvent && (
          <Card className="bg-neutral-900 border-neutral-800 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-[#E8540A] flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-xl font-semibold">You're in.</h2>
            </div>
            <p className="text-neutral-300 mb-4">
              {longDayLabel(pickedDate!)} · {formatClassTimeDisplay(pickedTime!)}
            </p>
            <div className="rounded-lg bg-neutral-800 border border-neutral-700 p-4 mb-4">
              <p className="text-sm text-neutral-200 leading-relaxed">
                {buildIntroCalendarDescription(calendarEvent)}
              </p>
            </div>
            <p className="text-sm text-neutral-400 mb-3">Add it to your calendar so you don't forget. You'll get an automatic reminder 1 day before.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                onClick={() => downloadIntroIcs(calendarEvent)}
                className="h-12 bg-[#E8540A] hover:bg-[#c94609] text-white font-semibold"
              >
                <CalendarIcon className="w-4 h-4 mr-2" /> Add to Apple / Outlook
              </Button>
              <a
                href={buildGoogleCalendarUrl(calendarEvent)}
                target="_blank"
                rel="noreferrer"
                className="h-12 flex items-center justify-center rounded-md bg-[#FDF7EA] text-[#0A0A0A] hover:bg-white font-semibold transition-colors"
              >
                <CalendarIcon className="w-4 h-4 mr-2" /> Add to Google Calendar
              </a>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => toast.info('Your booking is confirmed — no need to redo it.')}
                className="border-[#FDF7EA]/40 bg-transparent text-[#FDF7EA] hover:bg-[#FDF7EA]/10 hover:text-[#FDF7EA]"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button
                className="flex-1 h-12 bg-[#E8540A] hover:bg-[#c94609] text-white font-semibold"
                onClick={() => setStep('friend')}
              >
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {/* STEP: friend */}
        {step === 'friend' && (
          <Card className="bg-neutral-900 border-neutral-800 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-[#E8540A]" />
              <h2 className="text-xl font-semibold">Bring a friend?</h2>
            </div>
            <p className="text-neutral-300 mb-4">
              It's always more fun to bring a friend. Want to invite someone to join this same class?
            </p>
            {!bookingId ? null : (
              <div className="space-y-3">
                <div className="rounded-lg bg-[#FDF7EA] p-3 flex items-center gap-2">
                  <code className="text-xs text-[#0A0A0A] flex-1 truncate font-medium">{friendUrl}</code>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(friendUrl);
                      toast.success('Link copied');
                    }}
                    className="p-2 rounded bg-[#0A0A0A] text-[#FDF7EA] hover:bg-[#E8540A] transition-colors"
                    aria-label="Copy link"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  {canShareNative && (
                    <button
                      onClick={() => (navigator as any).share({
                        title: 'Come to OTF with me',
                        text: `I'm booked for an OrangeTheory class on ${longDayLabel(pickedDate!)} at ${formatClassTimeDisplay(pickedTime!)}. Come with me!`,
                        url: friendUrl,
                      })}
                      className="p-2 rounded bg-[#0A0A0A] text-[#FDF7EA] hover:bg-[#E8540A] transition-colors"
                      aria-label="Share"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-neutral-400">Your friend is auto-booked into your same class time.</p>
              </div>
            )}
            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setStep('calendar')}
                className="border-[#FDF7EA]/40 bg-transparent text-[#FDF7EA] hover:bg-[#FDF7EA]/10 hover:text-[#FDF7EA]"
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button
                className="flex-1 h-12 bg-[#E8540A] hover:bg-[#c94609] text-white font-semibold"
                onClick={() => setStep('done')}
              >
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {step === 'done' && (
          <Card className="bg-neutral-900 border-neutral-800 p-5">
            <h2 className="text-xl font-semibold mb-2">See you soon!</h2>
            <p className="text-neutral-300">We'll text you before class with anything else you need.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
