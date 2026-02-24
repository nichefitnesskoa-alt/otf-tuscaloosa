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
import { computeCommission, isSaleOutcome } from '@/lib/outcomes/commissionRules';
import { formatDateShort, formatTime12h } from '@/lib/datetime/formatTime';
import { toast } from 'sonner';
import { Loader2, CalendarIcon, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

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
  introTime?: string | null;
  leadSource?: string;
  existingRunId?: string | null;
  currentResult?: string | null;
  editedBy: string;
  initialPrepped?: boolean;
  initialCoach?: string;
  initialObjection?: string;
  initialNotes?: string;
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
  onSaved,
  onCancel,
}: OutcomeDrawerProps) {
  const [outcome, setOutcome] = useState(currentResult || '');
  const [objection, setObjection] = useState(initialObjection);
  const [notes, setNotes] = useState(initialNotes);
  const [coachName, setCoachName] = useState(initialCoach);
  const [saving, setSaving] = useState(false);
  const [preppedBeforeClass, setPreppedBeforeClass] = useState(initialPrepped);

  // 2nd intro booking state
  const [secondIntroDate, setSecondIntroDate] = useState<Date | undefined>(undefined);
  const [secondIntroTime, setSecondIntroTime] = useState('');
  const [secondIntroCoach, setSecondIntroCoach] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Load linked 2nd intro booking if outcome was "Booked 2nd intro"
  const [linkedSecondIntro, setLinkedSecondIntro] = useState<{ date: string; time: string; coach: string } | null>(null);

  useEffect(() => {
    if (currentResult !== 'Booked 2nd intro') return;
    (async () => {
      const { data } = await supabase
        .from('intros_booked')
        .select('class_date, intro_time, coach_name')
        .or(`originating_booking_id.eq.${bookingId},rebooked_from_booking_id.eq.${bookingId}`)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setLinkedSecondIntro({
          date: data.class_date,
          time: data.intro_time || '',
          coach: data.coach_name || '',
        });
      }
    })();
  }, [bookingId, currentResult]);

  // Pre-populate 2nd intro form fields from linked data
  useEffect(() => {
    if (!linkedSecondIntro) return;
    if (linkedSecondIntro.date) {
      setSecondIntroDate(new Date(linkedSecondIntro.date + 'T00:00:00'));
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
  const needsObjection = outcome === "Didn't Buy" || outcome === 'No-show';
  const isNoShow = outcome === 'No-show';
  const coachRequired = !!outcome && !isNoShow && !isReschedule && !isPlanningToReschedule;

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

  // Planning to Reschedule: mark booking + add to follow-up queue
    if (isPlanningToReschedule) {
      setSaving(true);
      try {
        // 1. Mark the booking
        const { error: bookingErr } = await supabase.from('intros_booked').update({
          booking_status_canon: 'PLANNING_RESCHEDULE',
          last_edited_at: new Date().toISOString(),
          last_edited_by: editedBy,
          edit_reason: 'Planning to reschedule via MyDay outcome drawer',
        }).eq('id', bookingId);
        if (bookingErr) throw bookingErr;

        // 2. Remove any existing pending queue entries for this booking
        await supabase.from('follow_up_queue')
          .update({ status: 'dormant' })
          .eq('booking_id', bookingId)
          .eq('status', 'pending');

        // 3. Insert Touch 1 — next week (7 days out)
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

        // 4. Touch 2 — 14 days out
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

        // 5. Touch 3 — 21 days out
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

      {/* Prepped before class toggle */}
      <div className={cn(
        'flex items-center gap-2 px-2 py-2 rounded-md border transition-colors',
        preppedBeforeClass ? 'bg-success/10 border-success/30' : 'bg-muted/20 border-border'
      )}>
        <input
          type="checkbox"
          id="prepped-outcome-toggle"
          checked={preppedBeforeClass}
          onChange={async (e) => {
            const val = e.target.checked;
            setPreppedBeforeClass(val);
            await supabase.from('intros_booked').update({
              prepped: val,
              prepped_at: val ? new Date().toISOString() : null,
              prepped_by: val ? editedBy : null,
            }).eq('id', bookingId);
          }}
          className="w-4 h-4 accent-green-600"
        />
        <label htmlFor="prepped-outcome-toggle" className={cn('text-xs font-medium cursor-pointer', preppedBeforeClass ? 'text-success' : 'text-muted-foreground')}>
          Prepped before class
        </label>
      </div>

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
