/**
 * TheirStory — 3-zone section for SA and Coach intro cards.
 *
 * Zone 1 (left): Read-only questionnaire answers — "Before the Conversation"
 * Zone 2 (right): Live conversation inputs — "The Conversation"
 * Zone 3 (full width): The Brief fields — "After the Conversation"
 *
 * Desktop two-column layout for Zone 1 + Zone 2.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface TheirStoryProps {
  bookingId: string;
  memberName: string;
  classDate: string;
  /** If true, Zone 2 fields show read-only */
  readOnly?: boolean;
  /** Called after any field is saved */
  onFieldSaved?: () => void;
  /** Optional: slot rendered after Zone 2 Field 2 (coach WHY plan) */
  afterWhySlot?: React.ReactNode;
  /** The Brief fields — passed as children of Zone 3 */
  briefSlot?: React.ReactNode;
}

interface QData {
  id: string;
  status: string;
  q1_fitness_goal: string | null;
  q2_fitness_level: number | null;
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
}: TheirStoryProps) {
  const [qData, setQData] = useState<QData | null>(null);
  const [loading, setLoading] = useState(true);

  // Zone 2 fields — read from/write to intros_booked ONLY
  const [goalText, setGoalText] = useState('');
  const [driverText, setDriverText] = useState('');
  const [savedGoal, setSavedGoal] = useState<string | null>(null);
  const [savedMeaning, setSavedMeaning] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);

  const flashSaved = (field: string) => {
    setSavedField(field);
    setTimeout(() => setSavedField(null), 2000);
  };

  // Load Zone 1 data from intro_questionnaires (read-only)
  useEffect(() => {
    (async () => {
      const [qRes, bRes] = await Promise.all([
        supabase
          .from('intro_questionnaires')
          .select('id, status, q1_fitness_goal, q2_fitness_level, q5_emotional_driver, q6_weekly_commitment, q6b_available_days')
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('intros_booked')
          .select('sa_conversation_5_of_5, sa_conversation_meaning')
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
          q5_emotional_driver: d.q5_emotional_driver,
          q6_weekly_commitment: d.q6_weekly_commitment,
          q6b_available_days: d.q6b_available_days,
        });
      }

      // Zone 2: load from intros_booked
      if (bRes.data) {
        const b = bRes.data as any;
        const g = b.sa_conversation_5_of_5 || '';
        const m = b.sa_conversation_meaning || '';
        setSavedGoal(b.sa_conversation_5_of_5);
        setSavedMeaning(b.sa_conversation_meaning);
        if (!readOnly) {
          setGoalText(g);
          setDriverText(m);
        }
      }

      setLoading(false);
    })();
  }, [bookingId]);

  // Realtime subscription for coach view — Zone 1 (questionnaire) + Zone 2 (intros_booked)
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
    flashSaved(field);
    onFieldSaved?.();
  }, [bookingId, onFieldSaved]);

  const handleGoalBlur = () => {
    saveZone2Field('sa_conversation_5_of_5', goalText.trim());
  };

  const handleDriverBlur = () => {
    saveZone2Field('sa_conversation_meaning', driverText.trim());
  };

  if (loading) return null;

  // Zone 1 read-only values
  const fitnessLevel = qData?.q2_fitness_level;
  const fitnessGoal = qData?.q1_fitness_goal;
  const emotionalDriver = qData?.q5_emotional_driver;
  const commitment = qData?.q6_weekly_commitment;
  const availDays = qData?.q6b_available_days;
  const commitmentDisplay = [commitment, availDays].filter(Boolean).join(' | ') || null;

  return (
    <div className="space-y-3">
      <h4 className="font-bold text-sm">THEIR STORY</h4>

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

        {/* ── ZONE 2: The Conversation (live inputs or read-only) ── */}
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
            {!readOnly ? (
              <>
                <p className="text-[10px] text-muted-foreground">Ask this. Write their exact words.</p>
                <Textarea
                  value={goalText}
                  onChange={e => setGoalText(e.target.value)}
                  onBlur={handleGoalBlur}
                  placeholder="They said they want to [goal] — ask: 'Paint me a picture. What does your life actually look like when you get there?'"
                  className="min-h-[80px] text-sm"
                />
              </>
            ) : (
              <p className="text-sm">
                {savedGoal || <span className="text-muted-foreground italic">SA will capture during intro.</span>}
              </p>
            )}
          </div>

          {/* Field 2 — What would it mean */}
          <div className="space-y-0.5">
            <div className="flex items-center">
              <Label className="text-xs font-semibold" style={{ color: '#E8540A' }}>
                What would it mean to you if you got there?
              </Label>
              <SavedIndicator show={savedField === 'sa_conversation_meaning'} />
            </div>
            {!readOnly ? (
              <>
                <p className="text-[10px] text-muted-foreground">Let them dream. Write exactly what they say.</p>
                <Textarea
                  value={driverText}
                  onChange={e => setDriverText(e.target.value)}
                  onBlur={handleDriverBlur}
                  placeholder="Now go deeper. Ask: 'What would that mean to you? Like really mean to you?' Then stop talking. Let them sit in it."
                  className="min-h-[80px] text-sm"
                />
              </>
            ) : (
              <p className="text-sm">
                {savedMeaning || <span className="text-muted-foreground italic">SA will capture during intro.</span>}
              </p>
            )}

            {/* Orange highlight line — from intros_booked.sa_conversation_meaning */}
            {(readOnly ? savedMeaning : savedMeaning) && (
              <p className="text-sm font-semibold mt-1.5" style={{ color: '#E8540A' }}>
                ↑ {savedMeaning}
              </p>
            )}
          </div>

          {/* Coach WHY plan slot — sits directly below the orange line */}
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
