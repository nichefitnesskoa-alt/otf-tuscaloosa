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

const OUTCOME_OPTIONS = [...SALE_OUTCOMES, ...NON_SALE_OUTCOMES];

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

  // Confirmation state after successful 2nd intro save
  const [savedSecondIntro, setSavedSecondIntro] = useState<{
    date: string; time: string; coach: string;
  } | null>(null);

  const isSale = isSaleOutcome(outcome);
  const isBookedSecondIntro = outcome === 'Booked 2nd intro';
  const needsObjection = outcome === "Didn't Buy" || outcome === 'No-show';
  const isNoShow = outcome === 'No-show';
  const coachRequired = !!outcome && !isNoShow;

  // Computed commission — live recomputes on outcome change
  const commission = computeCommission({ membershipType: isSale ? outcome : null });

  const handleSave = async () => {
    if (!outcome) { toast.error('Select an outcome'); return; }
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
          </SelectContent>
        </Select>
      </div>

      {/* Commission display — always shown when outcome is selected */}
      {outcome && (
        <p className="text-sm text-muted-foreground">
          Commission: <span className="font-medium text-foreground">${commission.toFixed(2)}</span>
        </p>
      )}

      {/* Coach who taught the class */}
      {outcome && (
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
      <div className="space-y-1">
        <Label className="text-xs">Notes (optional)</Label>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any additional notes…"
          className="text-sm min-h-[56px] resize-none"
        />
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 h-8"
          onClick={handleSave}
          disabled={saving || !outcome}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
          Save Outcome
        </Button>
        <Button size="sm" variant="ghost" className="h-8" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
