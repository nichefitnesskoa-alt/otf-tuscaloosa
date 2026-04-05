import { useState, useCallback, useEffect, useRef } from 'react';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

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
  shoutout_consent: boolean | null;
  coach_notes: string | null;
  booking_status_canon: string;
  is_vip: boolean;
  deleted_at: string | null;
  last_edited_by: string | null;
  last_edited_at: string | null;
  questionnaire_status_canon?: string;
  coach_brief_human_detail?: string | null;
  coach_brief_why_moment?: string | null;
  coach_brief_five_vision?: string | null;
  coach_shoutout_start?: boolean | null;
  coach_shoutout_end?: boolean | null;
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
}

function SavedIndicator({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-[10px] text-primary font-medium ml-2 animate-in fade-in">Saved</span>;
}


export function CoachIntroCard({ booking, questionnaire, onUpdateBooking, userName }: Props) {
  const { user } = useAuth();
  const [runData, setRunData] = useState<{ id: string; goal_why_captured: string | null; made_a_friend: boolean | null; relationship_experience: string | null } | null>(null);

  // Conversation fields (read-only for coach)
  const [convGoal, setConvGoal] = useState('');
  const [convMeaning, setConvMeaning] = useState('');
  const [convObstacle, setConvObstacle] = useState('');
  const [consent, setConsent] = useState<boolean | null>(booking.shoutout_consent ?? null);

  // Post-class debrief state
  const [shoutoutStart, setShoutoutStart] = useState(booking.coach_shoutout_start ?? false);
  const [shoutoutEnd, setShoutoutEnd] = useState(booking.coach_shoutout_end ?? false);
  const [usedWhy, setUsedWhy] = useState(false);
  const [introducedMember, setIntroducedMember] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [savedField, setSavedField] = useState<string | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});


  const isSecondIntro = !!booking.originating_booking_id;
  const coachName = booking.coach_name;

  // Fetch conversation fields + run data + pair plan + follow-ups
  useEffect(() => {
    (async () => {
      const [convRes, runRes, bookingRes] = await Promise.all([
        supabase
          .from('intros_booked')
          .select('sa_conversation_5_of_5, sa_conversation_meaning, sa_conversation_obstacle, shoutout_consent, coach_member_pair_plan, coach_brief_why_moment')
          .eq('id', booking.id)
          .single(),
        !isSecondIntro ? supabase
          .from('intros_run')
          .select('id, goal_why_captured, made_a_friend, relationship_experience')
          .eq('linked_intro_booked_id', booking.id)
          .limit(1)
          .maybeSingle() : Promise.resolve({ data: null }),
        Promise.resolve(null),
      ]);

      if (convRes.data) {
        const d = convRes.data as any;
        setConvGoal(d.sa_conversation_5_of_5 || '');
        setConvMeaning(d.sa_conversation_meaning || '');
        setConvObstacle(d.sa_conversation_obstacle || '');
        setConsent(d.shoutout_consent ?? null);
      }

      if (runRes.data) {
        const rd = runRes.data as any;
        setRunData(rd);
        setUsedWhy(rd.goal_why_captured === 'yes');
        setIntroducedMember(rd.made_a_friend ?? false);
        setMemberName(rd.relationship_experience || '');
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
          setConsent(d.shoutout_consent ?? null);
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

  const saveRunField = useCallback(async (fields: Record<string, any>) => {
    if (!runData?.id) return;
    await supabase.from('intros_run').update(fields as any).eq('id', runData.id);
    flashSaved(Object.keys(fields)[0]);
  }, [runData?.id]);

  const debounceSave = useCallback((key: string, fn: () => void, delay = 800) => {
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(fn, delay);
  }, []);


  // Post-class handlers
  const handleShoutoutStart = (val: boolean) => { setShoutoutStart(val); saveBookingField('coach_shoutout_start', val); };
  const handleShoutoutEnd = (val: boolean) => { setShoutoutEnd(val); saveBookingField('coach_shoutout_end', val); };
  const handleUsedWhy = (val: boolean) => { setUsedWhy(val); saveRunField({ goal_why_captured: val ? 'yes' : 'no' }); };
  const handleIntroducedMember = (val: boolean) => {
    setIntroducedMember(val);
    if (!val) { setMemberName(''); saveRunField({ made_a_friend: false, relationship_experience: null }); }
    else { saveRunField({ made_a_friend: true }); }
  };
  const handleMemberNameChange = (val: string) => {
    setMemberName(val);
    debounceSave('memberName', () => saveRunField({ relationship_experience: val || null }));
  };

  const toggleConsent = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = consent === true ? false : true;
    setConsent(next);
    await supabase.from('intros_booked').update({
      shoutout_consent: next,
      last_edited_at: new Date().toISOString(),
      last_edited_by: userName,
    } as any).eq('id', booking.id);
    flashSaved('shoutout_consent');
  }, [booking.id, consent, userName]);


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
              <Separator />
              <div>
                <h4 className="font-bold text-sm tracking-wide">POST-CLASS — LEAD MEASURES</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">Answer after every first-timer class.</p>
              </div>

              {/* Row 1 — Three toggles: shoutout permission, start, end */}
              <div className="grid grid-cols-3 gap-3">
                <YesNoToggle
                  label="Did you ask for shoutout permission?"
                  value={consent}
                  onChange={(val) => { setConsent(val); saveBookingField('shoutout_consent', val); }}
                  savedKey="shoutout_consent"
                  savedField={savedField}
                />
                <YesNoToggle
                  label="Did you shout them out at the start of class?"
                  value={shoutoutStart ? true : shoutoutStart === false ? false : null}
                  onChange={(val) => { setShoutoutStart(val); saveBookingField('coach_shoutout_start', val); }}
                  savedKey="coach_shoutout_start"
                  savedField={savedField}
                  dimmed={consent === false}
                />
                <YesNoToggle
                  label="Did you shout them out at the end of class?"
                  value={shoutoutEnd ? true : shoutoutEnd === false ? false : null}
                  onChange={(val) => { setShoutoutEnd(val); saveBookingField('coach_shoutout_end', val); }}
                  savedKey="coach_shoutout_end"
                  savedField={savedField}
                  dimmed={consent === false}
                />
              </div>

              {/* Row 2 — Two questions: curiosity + member intro */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs leading-tight block">Did you get curious — ask 1 or 2 follow-up questions about their goal and give personalized advice?</Label>
                  <YesNoToggle
                    label=""
                    value={usedWhy ? true : usedWhy === false && runData ? false : null}
                    onChange={(val) => { setUsedWhy(val); saveRunField({ goal_why_captured: val ? 'yes' : 'no' }); }}
                    savedKey="goal_why_captured"
                    savedField={savedField}
                    inline
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs leading-tight block">Did you introduce them to a current member?</Label>
                    <SavedIndicator show={savedField === 'made_a_friend'} />
                  </div>
                  <YesNoToggle
                    label=""
                    value={introducedMember ? true : introducedMember === false && runData ? false : null}
                    onChange={handleIntroducedMember}
                    savedKey="made_a_friend"
                    savedField={savedField}
                    inline
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
function YesNoToggle({ label, value, onChange, savedKey, savedField, dimmed, inline }: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  savedKey: string;
  savedField: string | null;
  dimmed?: boolean;
  inline?: boolean;
}) {
  return (
    <div className={cn(dimmed && "opacity-50", !inline && "space-y-1.5")}>
      {label && <Label className="text-xs leading-tight block">{label}</Label>}
      <div className="flex items-center gap-1.5">
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
