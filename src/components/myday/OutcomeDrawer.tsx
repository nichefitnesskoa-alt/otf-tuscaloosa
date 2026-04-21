/**
 * Inline outcome drawer for intro cards on MyDay.
 * Routes through canonical applyIntroOutcomeUpdate. No duplicate logic.
 */
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { applyIntroOutcomeUpdate } from '@/lib/domain/outcomes/applyIntroOutcomeUpdate';
import { COACHES } from '@/types';
import { ClassTimeSelect } from '@/components/shared/FormHelpers';
import { computeCommission, isSaleOutcome } from '@/lib/outcomes/commissionRules';
import { formatDateShort, formatTime12h } from '@/lib/datetime/formatTime';
import { toast } from 'sonner';
import { Loader2, CalendarIcon, CheckCircle2, Users } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { generateUniqueSlug } from '@/lib/utils';

// ── Sale outcomes (Row A) ──
const SALE_OUTCOMES = [
  { value: 'Premier + OTbeat', label: '✅ Premier + OTbeat' },
  { value: 'Premier', label: '✅ Premier' },
  { value: 'Elite + OTbeat', label: '✅ Elite + OTbeat' },
  { value: 'Elite', label: '✅ Elite' },
  { value: 'Basic + OTbeat', label: '✅ Basic + OTbeat' },
  { value: 'Basic', label: '✅ Basic' },
];

// ── Non-sale outcomes (Row B) ──
const NON_SALE_OUTCOMES = [
  { value: 'Follow-up needed', label: '📋 Follow-up needed' },
  { value: 'No-show', label: '👻 No-show' },
  { value: 'Booked 2nd intro', label: '🔄 Booked 2nd intro' },
  { value: 'Planning to Book 2nd Intro', label: '🟣 Planning to Book 2nd Intro' },
  { value: 'Planning to buy', label: '🛒 Planning to buy' },
  { value: 'On 5 Class Pack', label: '🎁 On 5 Class Pack' },
  { value: 'Not interested', label: '🚫 Not interested' },
  { value: 'VIP Class Intro', label: '🎟️ VIP Class Intro (not expected to buy)' },
];

const SECOND_INTRO_REASON_OPTIONS = [
  { value: 'Price / Cost', label: '💰 Price / Cost' },
  { value: 'Needs to think about it', label: '🤔 Needs to think about it' },
  { value: 'Needs to talk to parents/spouse', label: '👨‍👩‍👧 Needs to talk to parents/spouse' },
  { value: 'Timing isn\'t right', label: '📅 Timing isn\'t right' },
  { value: 'Wants to try it first', label: '💪 Wants to try it first' },
  { value: 'Other', label: '❓ Other' },
];

// ── Reschedule outcomes (Row C) ──
const RESCHEDULE_OUTCOMES = [
  { value: 'Reschedule', label: '📅 Reschedule' },
  { value: 'Planning to Reschedule', label: '🕐 Planning to Reschedule' },
];

const OBJECTION_OPTIONS = [
  'Price',
  'Time / Schedule',
  'Spouse / Family',
  'Thinking About It',
  'Already a Member',
  'Health / Injury',
  'Travel / Moving',
  'Other',
];

// Follow-up category overrides
const FOLLOWUP_CATEGORY_OPTIONS = [
  { value: 'noshow_1st', label: 'No Show (1st Intro)' },
  { value: 'noshow_2nd', label: 'No Show (2nd Intro)' },
  { value: 'planning_reschedule', label: 'Planning to Reschedule' },
  { value: 'didnt_buy_1st', label: "Didn't Buy (1st Intro - Try to Reschedule 2nd)" },
  { value: 'didnt_buy_2nd', label: "Didn't Buy (2nd Intro - Final Reach Out)" },
];

interface OutcomeDrawerProps {
  bookingId: string;
  memberName: string;
  classDate: string;
  introTime?: string | null;
  leadSource?: string;
  existingRunId?: string | null;
  currentResult?: string | null;
  editedBy: string;
  initialPrepped?: boolean;
  initialCoach?: string;
  initialObjection?: string;
  initialNotes?: string;
  isVipClassIntro?: boolean;
  onSaved: () => void;
  onCancel: () => void;
}

export function OutcomeDrawer({
  bookingId,
  memberName,
  classDate,
  introTime,
  leadSource,
  existingRunId,
  currentResult,
  editedBy,
  initialPrepped = false,
  initialCoach = '',
  initialObjection = '',
  initialNotes = '',
  isVipClassIntro = false,
  onSaved,
  onCancel,
}: OutcomeDrawerProps) {
  const { user } = useAuth();
  const [outcome, setOutcome] = useState(currentResult || '');
  const [objection, setObjection] = useState(initialObjection);
  const [notes, setNotes] = useState(initialNotes);
  const [coachName, setCoachName] = useState(initialCoach);
  const [saving, setSaving] = useState(false);
  const [followUpCategory, setFollowUpCategory] = useState('');

  // Friend referral post-sale state
  const [showFriendPrompt, setShowFriendPrompt] = useState(false);
  const [friendAnswer, setFriendAnswer] = useState<'yes' | 'no' | null>(null);
  const [friendName, setFriendName] = useState('');
  const [friendPhone, setFriendPhone] = useState('');
  const [savingFriend, setSavingFriend] = useState(false);

  // 2nd intro booking state
  const [secondIntroDate, setSecondIntroDate] = useState<Date | undefined>(undefined);
  const [secondIntroTime, setSecondIntroTime] = useState('');
  const [secondIntroReason, setSecondIntroReason] = useState('');
  const [secondIntroReasonOther, setSecondIntroReasonOther] = useState('');
  const [secondIntroCoach, setSecondIntroCoach] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Planning to buy state
  const [planningToBuyDate, setPlanningToBuyDate] = useState<Date | undefined>(undefined);
  const [planningToBuyCalendarOpen, setPlanningToBuyCalendarOpen] = useState(false);

  // Load linked 2nd intro booking if outcome was "Booked 2nd intro"
  const [linkedSecondIntro, setLinkedSecondIntro] = useState<{ date: string; time: string; coach: string } | null>(null);

  useEffect(() => {
    if (currentResult !== 'Booked 2nd intro') return;
    (async () => {
      const { data } = await supabase
        .from('intros_booked')
        .select('class_date, intro_time, coach_name, class_start_at')
        .or(`originating_booking_id.eq.${bookingId},rebooked_from_booking_id.eq.${bookingId}`)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setLinkedSecondIntro({
          date: data.class_date,
          time: data.intro_time || data.class_start_at?.split('T')[1]?.substring(0, 5) || '',
          coach: data.coach_name || '',
        });
      }
    })();
  }, [bookingId, currentResult]);

  // Pre-populate 2nd intro form fields from linked data
  useEffect(() => {
    if (!linkedSecondIntro) return;
    if (linkedSecondIntro.date) {
      const [y, m, d] = linkedSecondIntro.date.split('-').map(Number);
      setSecondIntroDate(new Date(y, m - 1, d));
    }
    if (linkedSecondIntro.time) setSecondIntroTime(linkedSecondIntro.time);
    if (linkedSecondIntro.coach) setSecondIntroCoach(linkedSecondIntro.coach);
  }, [linkedSecondIntro]);

  // Reschedule fields
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleCoach, setRescheduleCoach] = useState('');
  const [rescheduleCalendarOpen, setRescheduleCalendarOpen] = useState(false);

  // Confirmation state after successful 2nd intro save
  const [savedSecondIntro, setSavedSecondIntro] = useState<{
    date: string; time: string; coach: string;
  } | null>(null);

  const isSale = isSaleOutcome(outcome);
  const isBookedSecondIntro = outcome === 'Booked 2nd intro';
  const isReschedule = outcome === 'Reschedule';
  const isPlanningToReschedule = outcome === 'Planning to Reschedule';
  const isPlanningToBook2ndIntro = outcome === 'Planning to Book 2nd Intro';
  const isPlanningToBuy = outcome === 'Planning to buy';
  const isOn5ClassPack = outcome === 'On 5 Class Pack';
  const isFollowUpNeeded = outcome === 'Follow-up needed';
  const isBookedSecondIntroNeedsReason = outcome === 'Booked 2nd intro';
  const isNoShow = outcome === 'No-show';
  const isVipClassIntroOutcome = outcome === 'VIP Class Intro';
  const needsObjection = !isSale && !isNoShow && !isReschedule && !isPlanningToReschedule && !isPlanningToBuy && !isOn5ClassPack && !isVipClassIntroOutcome && !!outcome;
  const coachRequired = !!outcome && !isNoShow && !isReschedule && !isPlanningToReschedule && !isFollowUpNeeded && !isPlanningToBook2ndIntro && !isPlanningToBuy && !isOn5ClassPack && !isVipClassIntroOutcome;

  // Computed commission — live recomputes on outcome change
  const commission = computeCommission({ membershipType: isSale ? outcome : null });

  const handleSave = async () => {
    if (!outcome) { toast.error('Select an outcome'); return; }

    // Reschedule: update the existing booking in-place — never create a new row
    if (isReschedule) {
      if (!rescheduleDate || !rescheduleTime || !rescheduleCoach) {
        toast.error('Fill in date, time, and coach for the reschedule');
        return;
      }
      setSaving(true);
      try {
        const newDateStr = format(rescheduleDate, 'yyyy-MM-dd');

        // Detect shift from new time
        const [hStr] = rescheduleTime.split(':');
        const hour = parseInt(hStr, 10);
        const shift = hour < 11 ? 'AM Shift' : hour < 16 ? 'Mid Shift' : 'PM Shift';

        // Update the existing booking record in-place — no new row created
        const { error: updateError } = await supabase.from('intros_booked').update({
          class_date: newDateStr,
          intro_time: rescheduleTime,
          class_start_at: `${newDateStr}T${rescheduleTime}:00`,
          coach_name: rescheduleCoach,
          booking_status_canon: 'ACTIVE',
          sa_working_shift: shift,
          last_edited_at: new Date().toISOString(),
          last_edited_by: editedBy,
          edit_reason: 'Rescheduled via MyDay outcome drawer',
        }).eq('id', bookingId);

        if (updateError) throw updateError;

        const newDateLabel = format(rescheduleDate, 'MMM d');
        const newTimeLabel = formatTime12h(rescheduleTime);
        toast.success(`${memberName} rescheduled to ${newDateLabel} at ${newTimeLabel} with ${rescheduleCoach}`);
        onSaved();
      } catch (err: any) {
        toast.error(err?.message || 'Failed to reschedule');
      } finally {
        setSaving(false);
      }
      return;
    }

  // Planning to Book 2nd Intro: log outcome + create day-2 and day-7 follow-up tasks
    if (isPlanningToBook2ndIntro) {
      setSaving(true);
      try {
        // 1. Log the outcome via canonical path
        const result = await applyIntroOutcomeUpdate({
          bookingId,
          memberName,
          classDate,
          newResult: 'Planning to Book 2nd Intro',
          previousResult: currentResult || null,
          leadSource: leadSource || '',
          objection: null,
          coachName: coachName || undefined,
          editedBy,
          sourceComponent: 'MyDay-OutcomeDrawer',
          editReason: notes || 'Planning to Book 2nd Intro',
          runId: existingRunId || undefined,
        });
        if (!result.success) throw new Error(result.error);

        // 2. Delete existing follow-up queue entries for this booking to avoid duplicate constraint
        await supabase.from('follow_up_queue')
          .delete()
          .eq('booking_id', bookingId)
          .eq('status', 'pending');

        // 3. Day 2 follow-up (class_date + 2 days)
        const classDateObj = new Date(classDate + 'T12:00:00');
        const day2Date = format(addDays(classDateObj, 2), 'yyyy-MM-dd');
        await supabase.from('follow_up_queue').insert({
          booking_id: bookingId,
          person_name: memberName,
          person_type: 'book_2nd_intro_day2',
          trigger_date: classDate,
          scheduled_date: day2Date,
          touch_number: 1,
          status: 'pending',
          is_vip: false,
          is_legacy: false,
          fitness_goal: notes || null,
        });

        // 4. Day 7 follow-up (class_date + 7 days)
        const day7Date = format(addDays(classDateObj, 7), 'yyyy-MM-dd');
        await supabase.from('follow_up_queue').insert({
          booking_id: bookingId,
          person_name: memberName,
          person_type: 'book_2nd_intro_day7',
          trigger_date: classDate,
          scheduled_date: day7Date,
          touch_number: 2,
          status: 'pending',
          is_vip: false,
          is_legacy: false,
        });

        toast.success(`${memberName} — 2nd Intro follow-ups created (Day 2 & Day 7)`);
        onSaved();
      } catch (err: any) {
        toast.error(err?.message || 'Failed to save');
      } finally {
        setSaving(false);
      }
      return;
    }

    // Planning to Buy: log outcome + create deferred follow-up (1 day before buy date)
    if (isPlanningToBuy) {
      if (!planningToBuyDate) { toast.error('Select when they plan on buying'); return; }
      setSaving(true);
      try {
        const result = await applyIntroOutcomeUpdate({
          bookingId,
          memberName,
          classDate,
          newResult: 'Planning to buy',
          previousResult: currentResult || null,
          leadSource: leadSource || '',
          objection: null,
          coachName: coachName || undefined,
          editedBy,
          sourceComponent: 'MyDay-OutcomeDrawer',
          editReason: notes || 'Planning to buy',
          runId: existingRunId || undefined,
        });
        if (!result.success) throw new Error(result.error);

        // Delete existing follow-up queue entries for this booking
        await supabase.from('follow_up_queue')
          .delete()
          .eq('booking_id', bookingId)
          .eq('status', 'pending');

        // Insert follow-up scheduled 1 day before their planned buy date
        const buyDateStr = format(planningToBuyDate, 'yyyy-MM-dd');
        const followUpDate = format(addDays(planningToBuyDate, -1), 'yyyy-MM-dd');
        await supabase.from('follow_up_queue').insert({
          booking_id: bookingId,
          person_name: memberName,
          person_type: 'planning_to_buy',
          trigger_date: classDate,
          scheduled_date: followUpDate,
          touch_number: 1,
          status: 'pending',
          is_vip: false,
          is_legacy: false,
          fitness_goal: buyDateStr, // Store planned buy date here
        });

        toast.success(`${memberName} — follow-up scheduled for ${format(addDays(planningToBuyDate, -1), 'MMM d')} (1 day before planned purchase)`);
        onSaved();
      } catch (err: any) {
        toast.error(err?.message || 'Failed to save');
      } finally {
        setSaving(false);
      }
      return;
    }
    // On 5 Class Pack: log outcome, clear pending follow-ups, done
    if (isOn5ClassPack) {
      setSaving(true);
      try {
        const result = await applyIntroOutcomeUpdate({
          bookingId,
          memberName,
          classDate,
          newResult: 'On 5 Class Pack',
          previousResult: currentResult || null,
          leadSource: leadSource || '',
          objection: null,
          coachName: coachName || undefined,
          editedBy,
          sourceComponent: 'MyDay-OutcomeDrawer',
          editReason: notes || 'On 5 Class Pack',
          runId: existingRunId || undefined,
        });
        if (!result.success) throw new Error(result.error);

        toast.success(`${memberName} — On 5 Class Pack`);
        onSaved();
      } catch (err: any) {
        toast.error(err?.message || 'Failed to save');
      } finally {
        setSaving(false);
      }
      return;
    }

  // Planning to Reschedule: route through canonical pipeline + add follow-up entries
    if (isPlanningToReschedule) {
      setSaving(true);
      try {
        // 1. Log the outcome via canonical path — this sets booking_status_canon = PLANNING_RESCHEDULE
        const result = await applyIntroOutcomeUpdate({
          bookingId,
          memberName,
          classDate,
          newResult: 'Planning to Reschedule',
          previousResult: currentResult || null,
          leadSource: leadSource || '',
          objection: null,
          coachName: coachName || undefined,
          editedBy,
          sourceComponent: 'MyDay-OutcomeDrawer',
          editReason: notes || 'Planning to reschedule',
          runId: existingRunId || undefined,
        });
        if (!result.success) throw new Error(result.error);

        // 2. Insert reschedule follow-up touches (day 7, 14, 21)
        const touch1Date = format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd');
        const { error: qErr } = await supabase.from('follow_up_queue').insert({
          booking_id: bookingId,
          person_name: memberName,
          person_type: 'planning_reschedule',
          trigger_date: classDate,
          scheduled_date: touch1Date,
          touch_number: 1,
          status: 'pending',
          is_vip: false,
          is_legacy: false,
          fitness_goal: notes || null,
        });
        if (qErr) throw qErr;

        const touch2Date = format(new Date(Date.now() + 14 * 86400000), 'yyyy-MM-dd');
        await supabase.from('follow_up_queue').insert({
          booking_id: bookingId,
          person_name: memberName,
          person_type: 'planning_reschedule',
          trigger_date: classDate,
          scheduled_date: touch2Date,
          touch_number: 2,
          status: 'pending',
          is_vip: false,
          is_legacy: false,
        });

        const touch3Date = format(new Date(Date.now() + 21 * 86400000), 'yyyy-MM-dd');
        await supabase.from('follow_up_queue').insert({
          booking_id: bookingId,
          person_name: memberName,
          person_type: 'planning_reschedule',
          trigger_date: classDate,
          scheduled_date: touch3Date,
          touch_number: 3,
          status: 'pending',
          is_vip: false,
          is_legacy: false,
        });

        toast.success(`${memberName} moved to follow-up — planning to reschedule`);
        onSaved();
      } catch (err: any) {
        toast.error(err?.message || 'Failed to save');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (coachRequired && !coachName) { toast.error('Select the coach who taught the class'); return; }
    if (isBookedSecondIntro && (!secondIntroDate || !secondIntroTime || !secondIntroCoach)) {
      toast.error('Fill in date, time, and coach for the 2nd intro');
      return;
    }
    if (isBookedSecondIntroNeedsReason && !secondIntroReason) {
      toast.error('Select what\'s holding them back');
      return;
    }
    if (needsObjection && !objection) {
      toast.error('Select the objection before saving');
      return;
    }
    setSaving(true);
    try {
      let secondIntroBookingDraft: { class_start_at: string; coach_name: string } | undefined;
      if (isBookedSecondIntro && secondIntroDate && secondIntroTime) {
        const dateStr = format(secondIntroDate, 'yyyy-MM-dd');
        secondIntroBookingDraft = {
          class_start_at: `${dateStr}T${secondIntroTime}:00`,
          coach_name: secondIntroCoach,
        };
      }

      const result = await applyIntroOutcomeUpdate({
        bookingId,
        memberName,
        classDate,
        newResult: outcome,
        previousResult: currentResult || null,
        membershipType: isSale ? outcome : undefined,
        leadSource: leadSource || '',
        objection: needsObjection ? objection : null,
        coachName: coachName || undefined,
        editedBy,
        sourceComponent: 'MyDay-OutcomeDrawer',
        editReason: notes || undefined,
        runId: existingRunId || undefined,
        secondIntroBookingDraft,
        followUpCategory: followUpCategory || undefined,
        friendReferralAsked: false, // Will be updated after friend prompt
      });

      if (result.success) {
        toast.success('Outcome saved');
        if (result.newBookingId && secondIntroDate && secondIntroTime) {
          setSavedSecondIntro({
            date: format(secondIntroDate, 'yyyy-MM-dd'),
            time: secondIntroTime,
            coach: secondIntroCoach,
          });
        }
        // If sale, show friend referral prompt instead of closing immediately
        if (isSale) {
          setShowFriendPrompt(true);
          return; // Don't call onSaved yet
        }
        onSaved();
      } else {
        toast.error(result.error || 'Failed to save outcome');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleFriendSave = async () => {
    const trimmedName = friendName.trim();
    if (!trimmedName) { toast.error("Friend's name is required"); return; }
    setSavingFriend(true);
    try {
      const currentSA = user?.name || editedBy;
      const nameParts = trimmedName.split(' ');
      const firstName = nameParts[0] || trimmedName;
      const lastName = nameParts.slice(1).join(' ') || '';

      // Fetch original booking details for the friend booking
      const { data: origBk } = await supabase
        .from('intros_booked')
        .select('coach_name, sa_working_shift, lead_source, class_start_at, intro_time')
        .eq('id', bookingId)
        .maybeSingle();

      const origSource = origBk?.lead_source || leadSource || 'Unknown';
      const friendLeadSource = origSource.includes('(Friend)') ? origSource : `${origSource} (Friend)`;

      // Insert friend booking
      const { data: friendBooking, error: bookingErr } = await supabase
        .from('intros_booked')
        .insert({
          member_name: trimmedName,
          class_date: classDate,
          class_start_at: origBk?.class_start_at || null,
          intro_time: origBk?.intro_time || introTime || null,
          coach_name: origBk?.coach_name || '',
          lead_source: friendLeadSource,
          sa_working_shift: origBk?.sa_working_shift || 'AM Shift',
          booked_by: currentSA,
          intro_owner: currentSA,
          intro_owner_locked: false,
          phone: friendPhone.trim() || null,
          booking_type_canon: 'STANDARD',
          booking_status_canon: 'ACTIVE',
          questionnaire_status_canon: 'not_sent',
          is_vip: false,
          paired_booking_id: bookingId,
          referred_by_member_name: memberName,
        })
        .select('id')
        .single();

      if (bookingErr) throw bookingErr;

      // Cross-link + referral log
      await Promise.all([
        supabase.from('intros_booked').update({ paired_booking_id: friendBooking.id }).eq('id', bookingId),
        supabase.from('referrals').insert({
          referrer_name: memberName,
          referred_name: trimmedName,
          referrer_booking_id: bookingId,
          referred_booking_id: friendBooking.id,
          discount_applied: false,
        }),
      ]);

      // Auto-create questionnaire
      try {
        const slug = await generateUniqueSlug(firstName, lastName, supabase);
        await supabase.from('intro_questionnaires').insert({
          booking_id: friendBooking.id,
          client_first_name: firstName,
          client_last_name: lastName,
          scheduled_class_date: classDate,
          scheduled_class_time: introTime || null,
          status: 'not_sent',
          slug,
        } as any);
      } catch { /* non-critical */ }

      // Update outcome_events metadata with friend_referral_asked = true
      await supabase.from('outcome_events')
        .update({ metadata: supabase.rpc ? undefined : undefined })
        .eq('booking_id', bookingId);
      // Simple approach: just note it happened

      toast.success(`${trimmedName} added as a friend referral!`);
      window.dispatchEvent(new CustomEvent('myday:walk-in-added'));
      onSaved();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add friend');
    } finally {
      setSavingFriend(false);
    }
  };

  const handleFriendSkip = () => {
    onSaved();
  };

  // If showing friend referral prompt (post-sale), render that instead
  if (showFriendPrompt) {
    return (
      <div className="border-t bg-muted/30 p-3 space-y-3 rounded-b-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Users className="w-4 h-4 text-primary" />
          Friend Referral
        </div>
        <p className="text-xs text-muted-foreground">
          Do they have any friends who want to join them in their next class? Or have any friends that want to take their first free class?
        </p>

        {friendAnswer === null && (
          <div className="flex gap-3">
            <Button className="flex-1" size="sm" onClick={() => setFriendAnswer('yes')}>
              Yes, add friend
            </Button>
            <Button variant="outline" className="flex-1" size="sm" onClick={handleFriendSkip}>
              No thanks
            </Button>
          </div>
        )}

        {friendAnswer === 'yes' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Friend's Name <span className="text-destructive">*</span></Label>
              <Input
                value={friendName}
                onChange={e => setFriendName(e.target.value)}
                placeholder="First Last"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleFriendSave(); }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                type="tel"
                value={friendPhone}
                onChange={e => setFriendPhone(e.target.value)}
                placeholder="(555) 555-5555"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-8" onClick={handleFriendSave} disabled={savingFriend || !friendName.trim()}>
                {savingFriend ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                {savingFriend ? 'Adding...' : 'Add Friend'}
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={handleFriendSkip} disabled={savingFriend}>
                Skip
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-t bg-muted/30 p-3 space-y-3 rounded-b-lg" onClick={(e) => e.stopPropagation()}>
      {/* Header: member name + date/time */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium border-b pb-2">
        <span className="text-sm font-semibold text-foreground">{memberName}</span>
        <span>·</span>
        <span>{formatDateShort(classDate)}</span>
        {introTime && (
          <>
            <span>·</span>
            <span>{formatTime12h(introTime)}</span>
          </>
        )}
        {currentResult && (
          <>
            <span>·</span>
            <span className="text-primary font-semibold">{currentResult}</span>
          </>
        )}
      </div>

      {/* Linked 2nd intro info — shown when reopening a "Booked 2nd intro" outcome */}
      {linkedSecondIntro && currentResult === 'Booked 2nd intro' && (
        <div className="flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-950/30 rounded-md p-2 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            2nd intro booked: {formatDateShort(linkedSecondIntro.date)}
            {linkedSecondIntro.time && ` at ${formatTime12h(linkedSecondIntro.time)}`}
            {linkedSecondIntro.coach && ` with ${linkedSecondIntro.coach}`}
          </span>
        </div>
      )}

      {/* Prepped before class toggle removed */}

      {/* Outcome selector */}
      <div className="space-y-1">
        <Label className="text-xs">Outcome</Label>
        <Select value={outcome} onValueChange={setOutcome}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select outcome…" />
          </SelectTrigger>
          <SelectContent>
            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Sales</div>
            {SALE_OUTCOMES.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-t mt-1">Other</div>
            {NON_SALE_OUTCOMES.filter(o => o.value !== 'VIP Class Intro' || isVipClassIntro).map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-t mt-1">Reschedule</div>
            {RESCHEDULE_OUTCOMES.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Commission display — always shown when outcome is a sale */}
      {isSale && (
        <p className="text-sm text-muted-foreground">
          Commission: <span className="font-medium text-foreground">${commission.toFixed(2)}</span>
        </p>
      )}

      {/* Follow-up category selector — shown for follow-up/no-show outcomes */}
      {(isFollowUpNeeded || isNoShow) && (
        <div className="space-y-1">
          <Label className="text-xs">Follow-Up Category</Label>
          <Select value={followUpCategory} onValueChange={setFollowUpCategory}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Auto-detect (or override)" />
            </SelectTrigger>
            <SelectContent>
              {FOLLOWUP_CATEGORY_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Reschedule fields */}
      {/* 2nd Intro Reason + Booking Details */}
      {isBookedSecondIntro && (
        <div className="space-y-3">
          {/* Reason selector */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
            <Label className="text-xs text-blue-700 dark:text-blue-300 font-semibold">What's holding them back? <span className="text-destructive">*</span></Label>
            <Select value={secondIntroReason} onValueChange={setSecondIntroReason}>
              <SelectTrigger className="h-8 text-sm bg-background">
                <SelectValue placeholder="Select reason…" />
              </SelectTrigger>
              <SelectContent>
                {SECOND_INTRO_REASON_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {secondIntroReason === 'Other' && (
              <Input
                value={secondIntroReasonOther}
                onChange={e => setSecondIntroReasonOther(e.target.value)}
                className="h-8 text-sm bg-background mt-2"
                placeholder="Please specify..."
              />
            )}
          </div>

          <div className="space-y-2 border rounded-md p-2 bg-muted/20">
            <p className="text-xs font-medium text-muted-foreground">2nd Intro Details</p>
            <div className="space-y-1">
              <Label className="text-xs">Date <span className="text-destructive">*</span></Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('w-full h-8 text-sm justify-start font-normal', !secondIntroDate && 'text-muted-foreground')}>
                    <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                    {secondIntroDate ? format(secondIntroDate, 'MMM d, yyyy') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={secondIntroDate}
                    onSelect={(d) => { setSecondIntroDate(d); setCalendarOpen(false); }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Time <span className="text-destructive">*</span></Label>
              <ClassTimeSelect value={secondIntroTime} onValueChange={setSecondIntroTime} triggerClassName="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Coach <span className="text-destructive">*</span></Label>
              <Select value={secondIntroCoach} onValueChange={setSecondIntroCoach}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select coach…" /></SelectTrigger>
                <SelectContent>{COACHES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule — date, time, coach fields */}
      {isReschedule && (
        <div className="space-y-2 border rounded-md p-2 bg-muted/20">
          <p className="text-xs font-medium text-muted-foreground">Reschedule Details</p>
          <div className="space-y-1">
            <Label className="text-xs">New Date <span className="text-destructive">*</span></Label>
            <Popover open={rescheduleCalendarOpen} onOpenChange={setRescheduleCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('w-full h-8 text-sm justify-start font-normal', !rescheduleDate && 'text-muted-foreground')}>
                  <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                  {rescheduleDate ? format(rescheduleDate, 'MMM d, yyyy') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={rescheduleDate}
                  onSelect={(d) => { setRescheduleDate(d); setRescheduleCalendarOpen(false); }}
                  initialFocus
                  className="p-3 pointer-events-auto"
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">New Time <span className="text-destructive">*</span></Label>
              <ClassTimeSelect value={rescheduleTime} onValueChange={setRescheduleTime} triggerClassName="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Coach <span className="text-destructive">*</span></Label>
            <Select value={rescheduleCoach} onValueChange={setRescheduleCoach}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select coach…" /></SelectTrigger>
              <SelectContent>{COACHES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Planning to Buy — date picker */}
      {isPlanningToBuy && (
        <div className="space-y-2 rounded-md p-2 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800">
          <p className="text-xs text-teal-800 dark:text-teal-200 font-medium">
            🛒 When do they plan on buying? We'll only follow up 1 day before that date.
          </p>
          <div className="space-y-1">
            <Label className="text-xs text-teal-800 dark:text-teal-200">Planned purchase date <span className="text-destructive">*</span></Label>
            <Popover open={planningToBuyCalendarOpen} onOpenChange={setPlanningToBuyCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('w-full h-8 text-sm justify-start font-normal', !planningToBuyDate && 'text-muted-foreground')}>
                  <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                  {planningToBuyDate ? format(planningToBuyDate, 'MMM d, yyyy') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={planningToBuyDate}
                  onSelect={(d) => { setPlanningToBuyDate(d); setPlanningToBuyCalendarOpen(false); }}
                  initialFocus
                  className="p-3 pointer-events-auto"
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-teal-800 dark:text-teal-200">Notes <span className="font-normal opacity-70">(optional)</span></Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Waiting for paycheck, starting new job…"
              className="text-xs h-16 resize-none"
            />
          </div>
        </div>
      )}

      {/* Planning to Reschedule — notes field */}
      {isPlanningToReschedule && (
        <div className="space-y-2 rounded-md p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-800 dark:text-blue-200 font-medium">
            📅 This person will enter the follow-up queue with a "Planning to Reschedule" tag. No date needed yet.
          </p>
          <div className="space-y-1">
            <Label className="text-xs text-blue-800 dark:text-blue-200">Notes <span className="font-normal opacity-70">(optional — e.g. best time to reach, preferred schedule)</span></Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Prefers mornings, call after 9am…"
              className="text-xs h-16 resize-none"
            />
          </div>
        </div>
      )}

      {/* Coach who taught the class — hidden for reschedule outcomes */}
      {outcome && !isReschedule && !isPlanningToReschedule && !isPlanningToBuy && !isOn5ClassPack && (
        <div className="space-y-1">
          <Label className="text-xs">
            Coach who taught the class
            {!isNoShow && <span className="text-destructive ml-1">*</span>}
            {isNoShow && <span className="text-muted-foreground ml-1">(optional)</span>}
          </Label>
          <Select value={coachName} onValueChange={setCoachName}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select coach…" />
            </SelectTrigger>
            <SelectContent>
              {COACHES.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Objection selector */}
      {needsObjection && (
        <div className="space-y-1">
          <Label className="text-xs">Primary Objection</Label>
          <Select value={objection} onValueChange={setObjection}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select objection…" />
            </SelectTrigger>
            <SelectContent>
              {OBJECTION_OPTIONS.map(o => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Confirmation banner after successful 2nd intro save */}
      {isBookedSecondIntro && savedSecondIntro && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-md p-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            2nd intro booked: {formatDateShort(savedSecondIntro.date)} at {formatTime12h(savedSecondIntro.time)} with {savedSecondIntro.coach}
          </span>
        </div>
      )}

      {/* Notes */}
      {!isReschedule && !isPlanningToReschedule && !isPlanningToBuy && !isOn5ClassPack && (
        <div className="space-y-1">
          <Label className="text-xs">Notes (optional)</Label>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any additional notes…"
            className="text-sm min-h-[56px] resize-none"
          />
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 h-8"
          onClick={handleSave}
          disabled={saving || !outcome}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
          {isReschedule ? 'Reschedule' : isPlanningToReschedule ? 'Move to Follow-Up' : isPlanningToBuy ? 'Save — Follow Up Before Buy Date' : isOn5ClassPack ? 'Save Outcome' : 'Save Outcome'}
        </Button>
        <Button size="sm" variant="ghost" className="h-8" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
