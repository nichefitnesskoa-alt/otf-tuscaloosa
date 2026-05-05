import { useState, useCallback, useEffect, useRef } from 'react';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronRight, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { NON_RAN_BOOKING_STATUSES } from '@/lib/canon/introRules';

interface CoachBooking {
  id: string;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  coach_name: string;
  lead_source: string;
  intro_owner: string | null;
  originating_booking_id: string | null;
  sa_buying_criteria: string | null;
  sa_objection: string | null;
  coach_notes: string | null;
  booking_status_canon: string;
  is_vip: boolean;
  deleted_at: string | null;
  last_edited_by: string | null;
  last_edited_at: string | null;
  questionnaire_status_canon?: string;
  coach_brief_human_detail?: string | null;
  coach_brief_five_vision?: string | null;
  coach_referral_asked?: boolean | null;
  coach_referral_names?: string | null;
}

interface QuestionnaireData {
  q1_fitness_goal: string | null;
  q2_fitness_level: number | null;
  q3_obstacle: string | null;
  q5_emotional_driver: string | null;
  q6_weekly_commitment: string | null;
  q6b_available_days: string | null;
  q7_coach_notes: string | null;
}

interface Props {
  booking: CoachBooking;
  questionnaire: QuestionnaireData | null;
  onUpdateBooking: (id: string, updates: Partial<CoachBooking>) => void;
  userName: string;
  /** Status canon of the originating booking, if any. Used to decide
   *  whether this booking is a real 2nd intro or whether the originator
   *  was cancelled/rescheduled/no-show (in which case this IS the 1st intro). */
  originatingBookingStatus?: string | null;
}

function SavedIndicator({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-[10px] text-primary font-medium ml-2 animate-in fade-in">Saved</span>;
}


export function CoachIntroCard({ booking, questionnaire, onUpdateBooking, userName, originatingBookingStatus }: Props) {
  const { user } = useAuth();

  // Conversation fields (read-only for coach)
  const [convGoal, setConvGoal] = useState('');
  const [convMeaning, setConvMeaning] = useState('');
  const [convObstacle, setConvObstacle] = useState('');
  const [consent, setConsent] = useState<boolean | null>(null);

  // Post-class debrief state — placeholders kept for shape; FV Scorecard supersedes
  const [shoutoutStart] = useState<boolean | null>(null);
  const [shoutoutEnd] = useState<boolean | null>(null);
  const [usedWhy] = useState<boolean | null>(null);
  const [introducedMember] = useState<boolean | null>(null);
  const [memberName] = useState('');
  const [savedField, setSavedField] = useState<string | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Debrief submission state
  const [debriefSubmitted, setDebriefSubmitted] = useState(false);
  const [debriefSubmittedAt, setDebriefSubmittedAt] = useState<string | null>(null);
  const [debriefSubmittedBy, setDebriefSubmittedBy] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());

  const isSecondIntro = !!booking.originating_booking_id
    && !!originatingBookingStatus
    && !NON_RAN_BOOKING_STATUSES.has(originatingBookingStatus);
  const coachName = booking.coach_name;

  // Fetch conversation fields + debrief status
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('intros_booked')
        .select('sa_conversation_5_of_5, sa_conversation_meaning, sa_conversation_obstacle, coach_debrief_submitted, coach_debrief_submitted_at, coach_debrief_submitted_by' as any)
        .eq('id', booking.id)
        .single();

      if (data) {
        const d = data as any;
        setConvGoal(d.sa_conversation_5_of_5 || '');
        setConvMeaning(d.sa_conversation_meaning || '');
        setConvObstacle(d.sa_conversation_obstacle || '');
        setDebriefSubmitted(d.coach_debrief_submitted === true);
        setDebriefSubmittedAt(d.coach_debrief_submitted_at || null);
        setDebriefSubmittedBy(d.coach_debrief_submitted_by || null);
      }
    })();
  }, [booking.id, isSecondIntro]);

  // Realtime for conversation updates from SA
  useEffect(() => {
    const ch = supabase
      .channel(`coach-card-${booking.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'intros_booked',
        filter: `id=eq.${booking.id}`,
      }, (payload: any) => {
        const d = payload.new;
        if (d) {
          setConvGoal(d.sa_conversation_5_of_5 || '');
          setConvMeaning(d.sa_conversation_meaning || '');
          setConvObstacle(d.sa_conversation_obstacle || '');
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [booking.id]);

  const flashSaved = (field: string) => {
    setSavedField(field);
    setTimeout(() => setSavedField(null), 2000);
  };

  const saveBookingField = useCallback(async (field: string, value: any) => {
    await supabase.from('intros_booked').update({ [field]: value } as any).eq('id', booking.id);
    flashSaved(field);
  }, [booking.id]);

  const debounceSave = useCallback((key: string, fn: () => void, delay = 800) => {
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(fn, delay);
  }, []);

  const toggleConsent = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation();
  }, []);

  // Submit debrief — FV Scorecard supersedes detailed lead measures
  const handleSubmitDebrief = async () => {
    const now = new Date().toISOString();
    const submitter = userName || coachName;
    await supabase.from('intros_booked').update({
      coach_debrief_submitted: true,
      coach_debrief_submitted_at: now,
      coach_debrief_submitted_by: submitter,
    } as any).eq('id', booking.id);

    setDebriefSubmitted(true);
    setDebriefSubmittedAt(now);
    setDebriefSubmittedBy(submitter);
    setValidationErrors(new Set());
    onUpdateBooking(booking.id, { coach_debrief_submitted: true } as any);
  };

  const truncate = (s: string | null, max: number) => {
    if (!s) return null;
    return s.length > max ? s.slice(0, max) + '…' : s;
  };

  const consentLabel = consent === true
    ? 'Shoutout: YES — tap to change'
    : consent === false
      ? 'Shoutout: NO — tap to change'
      : 'Shoutout — tap to set';
  const consentBg = consent === true ? 'bg-success' : consent === false ? 'bg-[hsl(20,90%,47%)]' : 'bg-[hsl(40,91%,49%)]';

  const q = questionnaire;

  return (
    <>
      <div onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onFocus={e => e.stopPropagation()}>
        <div className="p-4 space-y-4" style={{ fontSize: '15px' }}>

          {/* ══════ SECTION 1 — THEIR STORY ══════ */}
          <h4 className="font-bold text-sm tracking-wide">THEIR STORY</h4>

          {/* ── SHOUTOUT CONSENT BAR ── */}
          <div
            className={cn('w-full flex items-center justify-between px-3 py-2.5 rounded-md cursor-pointer select-none hover:opacity-90 transition-opacity', consentBg)}
            style={{ minHeight: '44px' }}
            onClick={toggleConsent}
            onMouseDown={e => e.stopPropagation()}
          >
            <span className="text-white text-sm font-bold tracking-wide">{consentLabel}</span>
            <div className="flex items-center gap-1">
              <SavedIndicator show={savedField === 'shoutout_consent'} />
              <ChevronRight className="w-4 h-4 text-white" />
            </div>
          </div>

          {/* ── QUESTIONNAIRE REFERENCE ROW — 4 columns ── */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Fitness Level</p>
              <p className="text-sm font-medium">{q?.q2_fitness_level != null ? `${q.q2_fitness_level}/5` : '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Looking For</p>
              <p className="text-sm">{truncate(q?.q1_fitness_goal, 40) || <span className="text-muted-foreground italic">Not answered</span>}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Why They Came</p>
              <p className="text-sm">{truncate(q?.q5_emotional_driver, 40) || <span className="text-muted-foreground italic">Not answered</span>}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Availability</p>
              <p className="text-sm">
                {q?.q6_weekly_commitment || q?.q6b_available_days ? (
                  <>
                    {q?.q6_weekly_commitment && <>{q.q6_weekly_commitment} days</>}
                    {q?.q6_weekly_commitment && q?.q6b_available_days && ' · '}
                    {truncate(q?.q6b_available_days, 20)}
                  </>
                ) : (
                  <span className="text-muted-foreground italic">Not answered</span>
                )}
              </p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">From their questionnaire</p>

          {/* ── CONVERSATION ANSWERS ROW — 3 columns (editable) ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label className="text-xs font-semibold" style={{ color: 'hsl(20, 90%, 47%)' }}>
                  What a 5/5 looks like
                </Label>
                <SavedIndicator show={savedField === 'sa_conversation_5_of_5'} />
              </div>
              <Textarea
                value={convGoal}
                onChange={e => { setConvGoal(e.target.value); debounceSave('convGoal', () => saveBookingField('sa_conversation_5_of_5', e.target.value || null)); }}
                placeholder="Paint me a picture..."
                className="min-h-[60px] text-sm border border-input"
              />
              <p className="text-[10px] text-muted-foreground">
                {convGoal && booking.last_edited_by ? `Captured by ${booking.last_edited_by}` : 'Not yet captured — you can add this'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label className="text-xs font-semibold" style={{ color: 'hsl(20, 90%, 47%)' }}>
                  What would change
                </Label>
                <SavedIndicator show={savedField === 'sa_conversation_meaning'} />
              </div>
              <Textarea
                value={convMeaning}
                onChange={e => { setConvMeaning(e.target.value); debounceSave('convMeaning', () => saveBookingField('sa_conversation_meaning', e.target.value || null)); }}
                placeholder="What would actually be different?..."
                className="min-h-[60px] text-sm border border-input"
              />
              <p className="text-[10px] text-muted-foreground">
                {convMeaning && booking.last_edited_by ? `Captured by ${booking.last_edited_by}` : 'Not yet captured — you can add this'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label className="text-xs font-semibold" style={{ color: 'hsl(20, 90%, 47%)' }}>
                  What's holding them back
                </Label>
                <SavedIndicator show={savedField === 'sa_conversation_obstacle'} />
              </div>
              <Textarea
                value={convObstacle}
                onChange={e => { setConvObstacle(e.target.value); debounceSave('convObstacle', () => saveBookingField('sa_conversation_obstacle', e.target.value || null)); }}
                placeholder="Don't fix it. Just listen..."
                className="min-h-[60px] text-sm border border-input"
              />
              <p className="text-[10px] text-muted-foreground">
                {convObstacle && booking.last_edited_by ? `Captured by ${booking.last_edited_by}` : 'Not yet captured — you can add this'}
              </p>
            </div>
          </div>

          {/* Orange highlight line */}
          {convMeaning && (
            <div className="rounded-md px-3 py-2 border" style={{ borderColor: 'hsl(20, 90%, 47%)', backgroundColor: 'hsl(20, 90%, 47%, 0.08)' }}>
              <p className="text-sm font-semibold" style={{ color: 'hsl(20, 90%, 47%)' }}>↑ {convMeaning}</p>
            </div>
          )}


          {/* Coach Notes (if saved) */}
          {booking.coach_notes && (
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Coach Notes</p>
              <p className="text-sm">{booking.coach_notes}</p>
            </div>
          )}

          {/* ══════ SECTION 2 — POST-CLASS — DID YOU HIT YOUR LEAD MEASURES? ══════ */}
          {/* Hidden for 2nd intros — they don't count toward coach lead measures */}
          {!isSecondIntro && (
            <>
              <Separator />
              <div>
                <h4 className="font-bold text-sm tracking-wide">
                  {debriefSubmitted ? 'POST-CLASS — LEAD MEASURES ✓' : 'POST-CLASS — LEAD MEASURES'}
                </h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">Answer after every first-timer class.</p>
              </div>

              {/* Row 1 — Three toggles: shoutout permission, start, end */}
              <div className="grid grid-cols-3 gap-3">
                <YesNoToggle
                  label="Did you ask for shoutout permission?"
                  value={consent}
                  onChange={(val) => handleConsentToggle(val)}
                  savedKey="shoutout_consent"
                  savedField={savedField}
                  hasError={validationErrors.has('shoutout_consent')}
                />
                <YesNoToggle
                  label="Did you shout them out at the start of class?"
                  value={shoutoutStart}
                  onChange={(val) => handleShoutoutStart(val)}
                  savedKey="coach_shoutout_start"
                  savedField={savedField}
                  dimmed={consent === false}
                  hasError={validationErrors.has('coach_shoutout_start')}
                />
                <YesNoToggle
                  label="Did you shout them out at the end of class?"
                  value={shoutoutEnd}
                  onChange={(val) => handleShoutoutEnd(val)}
                  savedKey="coach_shoutout_end"
                  savedField={savedField}
                  dimmed={consent === false}
                  hasError={validationErrors.has('coach_shoutout_end')}
                />
              </div>

              {/* Row 2 — Two questions: curiosity + member intro */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs leading-tight block">Did you get curious — ask 1 or 2 follow-up questions about their goal and give personalized advice?</Label>
                  <YesNoToggle
                    label=""
                    value={usedWhy}
                    onChange={(val) => handleUsedWhy(val)}
                    savedKey="goal_why_captured"
                    savedField={savedField}
                    inline
                    hasError={validationErrors.has('goal_why_captured')}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs leading-tight block">Did you introduce them to a current member?</Label>
                    <SavedIndicator show={savedField === 'made_a_friend'} />
                  </div>
                  <YesNoToggle
                    label=""
                    value={introducedMember}
                    onChange={handleIntroducedMember}
                    savedKey="made_a_friend"
                    savedField={savedField}
                    inline
                    hasError={validationErrors.has('made_a_friend')}
                  />
                  {introducedMember && (
                    <div>
                      <div className="flex items-center">
                        <Label className="text-xs text-muted-foreground">Which member did you introduce them to?</Label>
                        <SavedIndicator show={savedField === 'relationship_experience'} />
                      </div>
                      <Input value={memberName} onChange={e => handleMemberNameChange(e.target.value)} placeholder="Member's full name" className="h-9 text-sm mt-1 border border-input" />
                      <p className="text-xs mt-1.5" style={{ color: 'hsl(40, 91%, 49%)' }}>
                        If this member refers someone who joins, they may qualify for the referral discount. Note their name so they get credit.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Validation error message */}
              {validationErrors.size > 0 && (
                <p className="text-sm font-medium" style={{ color: 'hsl(40, 91%, 49%)' }}>
                  Please answer all questions before submitting.
                </p>
              )}

              {/* Submit / Submitted button */}
              {debriefSubmitted ? (
                <div className="space-y-1">
                  <Button
                    disabled
                    className="w-full text-white font-bold bg-success hover:bg-success cursor-default"
                    style={{ minHeight: '44px' }}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Lead Measures Submitted ✓
                  </Button>
                  {debriefSubmittedBy && debriefSubmittedAt && (
                    <p className="text-[10px] text-muted-foreground text-center">
                      Submitted by {debriefSubmittedBy} at {format(new Date(debriefSubmittedAt), 'h:mm a')}
                    </p>
                  )}
                </div>
              ) : (
                <Button
                  onClick={handleSubmitDebrief}
                  className="w-full text-white font-bold hover:opacity-90"
                  style={{ minHeight: '44px', backgroundColor: '#E8540A' }}
                >
                  Submit Lead Measures
                </Button>
              )}
            </>
          )}

          {booking.last_edited_by && booking.last_edited_at && (
            <p className="text-[10px] text-muted-foreground text-right">
              Last edited by {booking.last_edited_by} · {new Date(booking.last_edited_at).toLocaleString()}
            </p>
          )}
        </div>
      </div>

    </>
  );
}

// ── Yes/No Toggle Button Pair ──
function YesNoToggle({ label, value, onChange, savedKey, savedField, dimmed, inline, hasError }: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  savedKey: string;
  savedField: string | null;
  dimmed?: boolean;
  inline?: boolean;
  hasError?: boolean;
}) {
  return (
    <div className={cn(dimmed && "opacity-50", !inline && "space-y-1.5")}>
      {label && <Label className="text-xs leading-tight block">{label}</Label>}
      <div className={cn("flex items-center gap-1.5 rounded-md p-0.5", hasError && "ring-2 ring-warning")}>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={cn(
            "px-3 rounded-md border text-xs font-semibold transition-colors cursor-pointer",
            value === true
              ? "bg-success text-white border-success"
              : "bg-background text-muted-foreground border-input hover:bg-muted"
          )}
          style={{ minHeight: '36px' }}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={cn(
            "px-3 rounded-md border text-xs font-semibold transition-colors cursor-pointer",
            value === false
              ? "bg-destructive text-white border-destructive"
              : "bg-background text-muted-foreground border-input hover:bg-muted"
          )}
          style={{ minHeight: '36px' }}
        >
          No
        </button>
        <SavedIndicator show={savedField === savedKey} />
      </div>
    </div>
  );
}