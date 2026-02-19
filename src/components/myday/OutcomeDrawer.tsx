/**
 * Inline outcome drawer for intro cards on MyDay.
 * Routes through canonical applyIntroOutcomeUpdate. No duplicate logic.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { applyIntroOutcomeUpdate } from '@/lib/domain/outcomes/applyIntroOutcomeUpdate';
import { COACHES } from '@/types';
import { computeCommission, isSaleOutcome } from '@/lib/outcomes/commissionRules';
import { formatDateShort, formatTime12h } from '@/lib/datetime/formatTime';
import { toast } from 'sonner';
import { Loader2, CalendarIcon, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { autoCreateQuestionnaire } from '@/lib/introHelpers';

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
  { value: "Didn't Buy", label: "❌ Didn't Buy" },
  { value: 'No-show', label: '👻 No-show' },
  { value: 'Not interested', label: '🚫 Not interested' },
  { value: 'Follow-up needed', label: '📋 Follow-up needed' },
  { value: 'Booked 2nd intro', label: '🔄 Booked 2nd intro' },
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

interface OutcomeDrawerProps {
  bookingId: string;
  memberName: string;
  classDate: string;
  leadSource?: string;
  existingRunId?: string | null;
  currentResult?: string | null;
  editedBy: string;
  onSaved: () => void;
  onCancel: () => void;
}

export function OutcomeDrawer({
  bookingId,
  memberName,
  classDate,
  leadSource,
  existingRunId,
  currentResult,
  editedBy,
  onSaved,
  onCancel,
}: OutcomeDrawerProps) {
  const [outcome, setOutcome] = useState(currentResult || '');
  const [objection, setObjection] = useState('');
  const [notes, setNotes] = useState('');
  const [coachName, setCoachName] = useState('');
  const [saving, setSaving] = useState(false);

  // 2nd intro booking state
  const [secondIntroDate, setSecondIntroDate] = useState<Date | undefined>(undefined);
  const [secondIntroTime, setSecondIntroTime] = useState('');
  const [secondIntroCoach, setSecondIntroCoach] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);

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
  const needsObjection = outcome === "Didn't Buy" || outcome === 'No-show';
  const isNoShow = outcome === 'No-show';
  const coachRequired = !!outcome && !isNoShow && !isReschedule && !isPlanningToReschedule;

  // Computed commission — live recomputes on outcome change
  const commission = computeCommission({ membershipType: isSale ? outcome : null });

  const handleSave = async () => {
    if (!outcome) { toast.error('Select an outcome'); return; }

    // Reschedule: create new booking
    if (isReschedule) {
      if (!rescheduleDate || !rescheduleTime || !rescheduleCoach) {
        toast.error('Fill in date, time, and coach for the reschedule');
        return;
      }
      setSaving(true);
      try {
        // Mark original booking as RESCHEDULED
        await supabase.from('intros_booked').update({
          booking_status_canon: 'RESCHEDULED',
          last_edited_at: new Date().toISOString(),
          last_edited_by: editedBy,
          edit_reason: 'Rescheduled via MyDay outcome drawer',
        }).eq('id', bookingId);

        // Create new booking carrying over all fields
        const { data: originalBooking } = await supabase
          .from('intros_booked')
          .select('*')
          .eq('id', bookingId)
          .maybeSingle();

        if (!originalBooking) throw new Error('Could not load original booking');

        const newDateStr = format(rescheduleDate, 'yyyy-MM-dd');
        const { data: newBooking, error: insertError } = await supabase
          .from('intros_booked')
          .insert({
            member_name: originalBooking.member_name,
            class_date: newDateStr,
            intro_time: rescheduleTime,
            class_start_at: `${newDateStr}T${rescheduleTime}:00`,
            coach_name: rescheduleCoach,
            lead_source: originalBooking.lead_source,
            sa_working_shift: originalBooking.sa_working_shift,
            booked_by: originalBooking.booked_by,
            intro_owner: originalBooking.intro_owner,
            intro_owner_locked: originalBooking.intro_owner_locked,
            phone: originalBooking.phone,
            email: originalBooking.email,
            phone_e164: originalBooking.phone_e164,
            booking_type_canon: originalBooking.booking_type_canon,
            booking_status_canon: 'ACTIVE',
            questionnaire_status_canon: 'not_sent',
            is_vip: originalBooking.is_vip,
            originating_booking_id: originalBooking.originating_booking_id || bookingId,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;

        // Auto-create questionnaire for the new booking
        if (newBooking?.id) {
          autoCreateQuestionnaire({
            bookingId: newBooking.id,
            memberName,
            classDate: newDateStr,
          }).catch(() => {});
        }

        const newDateLabel = format(rescheduleDate, 'MMM d');
        const newTimeLabel = formatTime12h(rescheduleTime);
        toast.success(`${memberName} rescheduled to ${newDateLabel} at ${newTimeLabel}`);
        onSaved();
      } catch (err: any) {
        toast.error(err?.message || 'Failed to reschedule');
      } finally {
        setSaving(false);
      }
      return;
    }

    // Planning to Reschedule: mark booking + add to follow-up queue
    if (isPlanningToReschedule) {
      setSaving(true);
      try {
        await supabase.from('intros_booked').update({
          booking_status_canon: 'PLANNING_RESCHEDULE',
          last_edited_at: new Date().toISOString(),
          last_edited_by: editedBy,
          edit_reason: 'Planning to reschedule via MyDay outcome drawer',
        }).eq('id', bookingId);

        // Add to follow-up queue with planning_reschedule type
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        await supabase.from('follow_up_queue').insert({
          booking_id: bookingId,
          person_name: memberName,
          person_type: 'planning_reschedule',
          trigger_date: classDate,
          scheduled_date: todayStr,
          touch_number: 1,
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

  return (
    <div className="border-t bg-muted/30 p-3 space-y-3 rounded-b-lg">
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
            {NON_SALE_OUTCOMES.map(o => (
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

      {/* Reschedule fields */}
      {isReschedule && (
        <div className="space-y-2 border rounded-md p-2 bg-muted/20">
          <p className="text-xs font-medium text-muted-foreground">New Class Details</p>

          <div className="space-y-1">
            <Label className="text-xs">New Date <span className="text-destructive">*</span></Label>
            <Popover open={rescheduleCalendarOpen} onOpenChange={setRescheduleCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn('w-full h-8 text-sm justify-start font-normal', !rescheduleDate && 'text-muted-foreground')}
                >
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
            <Input
              type="time"
              value={rescheduleTime}
              onChange={e => setRescheduleTime(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Coach <span className="text-destructive">*</span></Label>
            <Select value={rescheduleCoach} onValueChange={setRescheduleCoach}>
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
        </div>
      )}

      {/* Planning to Reschedule — no date needed, just confirm */}
      {isPlanningToReschedule && (
        <div className="rounded-md p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-800 dark:text-blue-200 font-medium">
            📅 This person will enter the follow-up queue with a "Planning to Reschedule" tag. No date needed yet.
          </p>
        </div>
      )}

      {/* Coach who taught the class — hidden for reschedule outcomes */}
      {outcome && !isReschedule && !isPlanningToReschedule && (
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

      {/* 2nd intro booking fields */}
      {isBookedSecondIntro && (
        <>
          {savedSecondIntro ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-md p-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                2nd intro booked: {formatDateShort(savedSecondIntro.date)} at {formatTime12h(savedSecondIntro.time)} with {savedSecondIntro.coach}
              </span>
            </div>
          ) : (
            <div className="space-y-2 border rounded-md p-2 bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground">2nd Intro Details</p>

              {/* Date picker */}
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn('w-full h-8 text-sm justify-start font-normal', !secondIntroDate && 'text-muted-foreground')}
                    >
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

              {/* Time input */}
              <div className="space-y-1">
                <Label className="text-xs">Time (HH:MM)</Label>
                <Input
                  type="time"
                  value={secondIntroTime}
                  onChange={e => setSecondIntroTime(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              {/* Coach selector */}
              <div className="space-y-1">
                <Label className="text-xs">Coach</Label>
                <Select value={secondIntroCoach} onValueChange={setSecondIntroCoach}>
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
            </div>
          )}
        </>
      )}

      {/* Notes */}
      {!isReschedule && !isPlanningToReschedule && (
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
          {isReschedule ? 'Reschedule' : isPlanningToReschedule ? 'Move to Follow-Up' : 'Save Outcome'}
        </Button>
        <Button size="sm" variant="ghost" className="h-8" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
