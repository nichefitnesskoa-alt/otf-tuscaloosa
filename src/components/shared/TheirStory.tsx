/**
 * TheirStory — 3-zone section for SA and Coach intro cards.
 *
 * Shoutout consent bar at top (orange, tappable).
 * Zone 1 (left): Read-only questionnaire answers — "Before the Conversation"
 * Zone 2 (right): Live conversation inputs — "The Conversation"
 * Zone 3 (full width): The Brief fields — "After the Conversation"
 *
 * Desktop two-column layout for Zone 1 + Zone 2.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ChevronRight } from 'lucide-react';

interface TheirStoryProps {
  bookingId: string;
  memberName: string;
  classDate: string;
  /** If true, realtime subscription is active; Zone 2 is still editable */
  readOnly?: boolean;
  /** Called after any field is saved */
  onFieldSaved?: () => void;
  /** Optional: slot rendered after Zone 2 Field 2 (coach WHY plan) */
  afterWhySlot?: React.ReactNode;
  /** The Brief fields — passed as children of Zone 3 */
  briefSlot?: React.ReactNode;
  /** SA user name for edit tracking */
  editedBy?: string;
  /** Fires when consent value changes */
  onConsentChange?: (val: boolean | null) => void;
}

interface QData {
  id: string;
  status: string;
  q1_fitness_goal: string | null;
  q2_fitness_level: number | null;
  q3_obstacle: string | null;
  q5_emotional_driver: string | null;
  q6_weekly_commitment: string | null;
  q6b_available_days: string | null;
}

function SavedIndicator({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-[10px] text-primary font-medium ml-2 animate-in fade-in">Saved</span>;
}

function ReadOnlyField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-sm">{value || <span className="text-muted-foreground italic">Not answered</span>}</p>
    </div>
  );
}

export function TheirStory({
  bookingId,
  memberName,
  classDate,
  readOnly = false,
  onFieldSaved,
  afterWhySlot,
  briefSlot,
  editedBy,
  onConsentChange,
}: TheirStoryProps) {
  const [qData, setQData] = useState<QData | null>(null);
  const [loading, setLoading] = useState(true);

  // Zone 2 fields — read from/write to intros_booked ONLY
  const [goalText, setGoalText] = useState('');
  const [driverText, setDriverText] = useState('');
  const [obstacleText, setObstacleText] = useState('');
  const [savedGoal, setSavedGoal] = useState<string | null>(null);
  const [savedMeaning, setSavedMeaning] = useState<string | null>(null);
  const [savedObstacle, setSavedObstacle] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);

  // Shoutout consent
  const [consent, setConsent] = useState<boolean | null>(null);

  const flashSaved = (field: string) => {
    setSavedField(field);
    setTimeout(() => setSavedField(null), 2000);
  };

  // Load Zone 1 data from intro_questionnaires (read-only) + Zone 2 from intros_booked
  useEffect(() => {
    (async () => {
      const [qRes, bRes] = await Promise.all([
        supabase
          .from('intro_questionnaires')
          .select('id, status, q1_fitness_goal, q2_fitness_level, q3_obstacle, q5_emotional_driver, q6_weekly_commitment, q6b_available_days')
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('intros_booked')
          .select('sa_conversation_5_of_5, sa_conversation_meaning, sa_conversation_obstacle, shoutout_consent')
          .eq('id', bookingId)
          .single(),
      ]);

      if (qRes.data) {
        const d = qRes.data as any;
        setQData({
          id: d.id,
          status: d.status,
          q1_fitness_goal: d.q1_fitness_goal,
          q2_fitness_level: d.q2_fitness_level,
          q3_obstacle: d.q3_obstacle,
          q5_emotional_driver: d.q5_emotional_driver,
          q6_weekly_commitment: d.q6_weekly_commitment,
          q6b_available_days: d.q6b_available_days,
        });
      }

      // Zone 2 + consent: load from intros_booked (always populate for both SA and Coach)
      if (bRes.data) {
        const b = bRes.data as any;
        setSavedGoal(b.sa_conversation_5_of_5);
        setSavedMeaning(b.sa_conversation_meaning);
        setSavedObstacle(b.sa_conversation_obstacle);
        setConsent(b.shoutout_consent ?? null);
        // Always populate text fields so both SA and Coach can edit
        setGoalText(b.sa_conversation_5_of_5 || '');
        setDriverText(b.sa_conversation_meaning || '');
        setObstacleText(b.sa_conversation_obstacle || '');
      }

      setLoading(false);
    })();
  }, [bookingId]);

  // Realtime subscription for coach view
  useEffect(() => {
    if (!readOnly) return;
    const ch1 = supabase
      .channel(`theirstory-q-${bookingId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'intro_questionnaires', filter: `booking_id=eq.${bookingId}` },
        (payload: any) => {
          const d = payload.new;
          if (d) {
            setQData({
              id: d.id,
              status: d.status,
              q1_fitness_goal: d.q1_fitness_goal,
              q2_fitness_level: d.q2_fitness_level,
              q3_obstacle: d.q3_obstacle,
              q5_emotional_driver: d.q5_emotional_driver,
              q6_weekly_commitment: d.q6_weekly_commitment,
              q6b_available_days: d.q6b_available_days,
            });
          }
        }
      )
      .subscribe();

    const ch2 = supabase
      .channel(`theirstory-b-${bookingId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'intros_booked', filter: `id=eq.${bookingId}` },
        (payload: any) => {
          const d = payload.new;
          if (d) {
            setSavedGoal(d.sa_conversation_5_of_5);
            setSavedMeaning(d.sa_conversation_meaning);
            setSavedObstacle(d.sa_conversation_obstacle);
            setConsent(d.shoutout_consent ?? null);
            // Update text fields for coach real-time view
            setGoalText(d.sa_conversation_5_of_5 || '');
            setDriverText(d.sa_conversation_meaning || '');
            setObstacleText(d.sa_conversation_obstacle || '');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [bookingId, readOnly]);

  const saveZone2Field = useCallback(async (field: string, value: string) => {
    await supabase.from('intros_booked').update({ [field]: value || null } as any).eq('id', bookingId);
    if (field === 'sa_conversation_5_of_5') setSavedGoal(value || null);
    if (field === 'sa_conversation_meaning') setSavedMeaning(value || null);
    if (field === 'sa_conversation_obstacle') setSavedObstacle(value || null);
    flashSaved(field);
    // Do NOT call onFieldSaved here — prevents parent refresh from
    // unmounting the card and losing focus / collapsing the section.
  }, [bookingId]);

  const toggleConsent = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    // Cycle: null → true, true → false, false → true
    const next = consent === true ? false : true;
    setConsent(next);
    onConsentChange?.(next);
    await supabase.from('intros_booked').update({
      shoutout_consent: next,
      last_edited_at: new Date().toISOString(),
      last_edited_by: editedBy || null,
    } as any).eq('id', bookingId);
    setSavedField('shoutout_consent');
    setTimeout(() => setSavedField(null), 1000);
    // Do NOT call onFieldSaved here — prevents parent re-render that collapses the card
  }, [bookingId, consent, editedBy, onConsentChange]);

  if (loading) return null;

  // Zone 1 read-only values
  const fitnessLevel = qData?.q2_fitness_level;
  const fitnessGoal = qData?.q1_fitness_goal;
  const emotionalDriver = qData?.q5_emotional_driver;
  const commitment = qData?.q6_weekly_commitment;
  const availDays = qData?.q6b_available_days;
  const commitmentDisplay = [commitment, availDays].filter(Boolean).join(' | ') || null;
  const qObstacle = qData?.q3_obstacle;

  // Shoutout bar display
  const consentLabel = consent === true
    ? 'Shoutout: YES — tap to change'
    : consent === false
      ? 'Shoutout: NO — tap to change'
      : 'Shoutout — tap to set';
  const consentBg = consent === true ? '#22c55e' : consent === false ? '#E8540A' : '#F59E0B';

  return (
    <div className="space-y-3" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
      <h4 className="font-bold text-sm">THEIR STORY</h4>

      {/* ── SHOUTOUT CONSENT — tappable bar ── */}
      <div
        className="w-full flex items-center justify-between px-3 py-2 rounded-md cursor-pointer select-none hover:opacity-90 transition-opacity"
        style={{ backgroundColor: consentBg, minHeight: '36px' }}
        onClick={toggleConsent}
        onMouseDown={e => e.stopPropagation()}
      >
        <span className="text-white text-sm font-bold tracking-wide">
          {consentLabel}
        </span>
        <div className="flex items-center gap-1">
          <SavedIndicator show={savedField === 'shoutout_consent'} />
          <ChevronRight className="w-4 h-4 text-white" />
        </div>
      </div>

      {/* Zone 1 + Zone 2: side-by-side on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── ZONE 1: Before the Conversation (read-only) ── */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            What they shared before arriving
          </p>
          <div className="space-y-2 pl-0.5">
            <ReadOnlyField
              label="Fitness level"
              value={fitnessLevel != null ? `${fitnessLevel}/5` : null}
            />
            <ReadOnlyField
              label="Looking for"
              value={fitnessGoal}
            />
            <ReadOnlyField
              label="Their why"
              value={emotionalDriver}
            />
            <ReadOnlyField
              label="Commitment"
              value={commitmentDisplay}
            />
          </div>
          <p className="text-[10px] text-muted-foreground italic mt-1">
            This is what they typed. The real answer comes from the conversation.
          </p>
        </div>

        {/* ── ZONE 2: The Conversation (always editable) ── */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            In their own words
          </p>

          {/* Field 1 — What would 5/5 look like */}
          <div className="space-y-0.5">
            <div className="flex items-center">
              <Label className="text-xs font-semibold" style={{ color: '#E8540A' }}>
                What would a 5/5 look like for you?
              </Label>
              <SavedIndicator show={savedField === 'sa_conversation_5_of_5'} />
            </div>
            <p className="text-[10px] text-muted-foreground">Ask this. Write their exact words.</p>
            <Textarea
              value={goalText}
              onChange={e => setGoalText(e.target.value)}
              onBlur={() => saveZone2Field('sa_conversation_5_of_5', goalText.trim())}
              placeholder="They said they want to [goal] — ask: 'Paint me a picture. What does your life actually look like when you get there?'"
              className="min-h-[80px] text-sm"
            />
          </div>

          {/* Field 2 — What would it mean */}
          <div className="space-y-0.5">
            <div className="flex items-center">
              <Label className="text-xs font-semibold" style={{ color: '#E8540A' }}>
                What would it mean to you if you got there?
              </Label>
              <SavedIndicator show={savedField === 'sa_conversation_meaning'} />
            </div>
            <p className="text-[10px] text-muted-foreground">Let them dream. Write exactly what they say.</p>
            <Textarea
              value={driverText}
              onChange={e => setDriverText(e.target.value)}
              onBlur={() => saveZone2Field('sa_conversation_meaning', driverText.trim())}
              placeholder="Now go deeper. Ask: 'What would that mean to you? Like really mean to you?' Then stop talking. Let them sit in it."
              className="min-h-[80px] text-sm"
            />

            {/* Orange highlight line — from intros_booked.sa_conversation_meaning */}
            {savedMeaning && (
              <p className="text-sm font-semibold mt-1.5" style={{ color: '#E8540A' }}>
                ↑ {savedMeaning}
              </p>
            )}
          </div>

          {/* Field 3 — What's been holding you back */}
          <div className="space-y-0.5">
            <div className="flex items-center">
              <Label className="text-xs font-semibold" style={{ color: '#E8540A' }}>
                What's been the biggest thing holding you back from getting there?
              </Label>
              <SavedIndicator show={savedField === 'sa_conversation_obstacle'} />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Don't fix it yet. Just listen. Nod. Say 'that makes sense.' Their exact words become your close.
            </p>
            <Textarea
              value={obstacleText}
              onChange={e => setObstacleText(e.target.value)}
              onBlur={() => saveZone2Field('sa_conversation_obstacle', obstacleText.trim())}
              placeholder="Don't ask this like a form question. Ask it like you genuinely want to know. Then stop talking completely. Whatever they say — nod. Say 'that makes sense.' Their exact words are your close after class."
              className="min-h-[80px] text-sm"
            />

            {/* Questionnaire reference line — read-only context */}
            {qObstacle && (
              <p className="text-[11px] text-muted-foreground italic mt-1">
                They mentioned in their questionnaire: {qObstacle}
              </p>
            )}
          </div>

          {/* Coach WHY plan slot — sits directly below the fields */}
          {afterWhySlot}
        </div>
      </div>

      {/* ── ZONE 3: After the Conversation (The Brief) ── */}
      {briefSlot && (
        <div className="space-y-2 pt-2 border-t border-border/50">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            After dig deeper — hand to coach
          </p>
          {briefSlot}
        </div>
      )}
    </div>
  );
}
