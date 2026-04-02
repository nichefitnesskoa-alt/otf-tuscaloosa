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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, generateSlug } from '@/lib/utils';

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
  const [qId, setQId] = useState<string | null>(null);
  const [qData, setQData] = useState<QData | null>(null);
  const [loading, setLoading] = useState(true);

  // Zone 2 fields — persist after save, never clear
  const [goalText, setGoalText] = useState('');
  const [driverText, setDriverText] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [savedField, setSavedField] = useState<string | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const flashSaved = (field: string) => {
    setSavedField(field);
    setTimeout(() => setSavedField(null), 2000);
  };

  // Load questionnaire data
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('intro_questionnaires')
        .select('id, status, q1_fitness_goal, q2_fitness_level, q5_emotional_driver, q6_weekly_commitment, q6b_available_days')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        const d = data as any;
        setQId(d.id);
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
      setLoading(false);
    })();
  }, [bookingId]);

  // Realtime subscription for coach view live updates
  useEffect(() => {
    if (!readOnly) return; // Only subscribe in coach/read-only mode
    const channel = supabase
      .channel(`theirstory-${bookingId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'intro_questionnaires', filter: `booking_id=eq.${bookingId}` },
        (payload: any) => {
          const d = payload.new;
          if (d) {
            setQId(d.id);
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

    return () => { supabase.removeChannel(channel); };
  }, [bookingId, readOnly]);

  const ensureQRecord = useCallback(async (): Promise<string> => {
    if (qId) return qId;
    const nameParts = memberName.trim().split(/\s+/);
    const firstName = nameParts[0] || memberName;
    const lastName = nameParts.slice(1).join(' ') || '';
    const slug = generateSlug(firstName, lastName, classDate);
    const { data } = await supabase.from('intro_questionnaires').insert({
      booking_id: bookingId,
      client_first_name: firstName,
      client_last_name: lastName,
      scheduled_class_date: classDate,
      status: 'not_sent',
      slug,
    } as any).select('id').single();
    const newId = data?.id as string;
    setQId(newId);
    return newId;
  }, [qId, bookingId, memberName, classDate]);

  const saveField = useCallback(async (field: string, value: any) => {
    const id = await ensureQRecord();
    await supabase.from('intro_questionnaires').update({ [field]: value } as any).eq('id', id);
    flashSaved(field);
    onFieldSaved?.();
  }, [ensureQRecord, onFieldSaved]);

  const handleGoalBlur = () => {
    if (goalText.trim()) {
      saveField('q1_fitness_goal', goalText.trim());
    }
  };

  const handleDriverBlur = () => {
    if (driverText.trim()) {
      saveField('q5_emotional_driver', driverText.trim());
    }
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
              <SavedIndicator show={savedField === 'q1_fitness_goal'} />
            </div>
            {!readOnly ? (
              <>
                <p className="text-[10px] text-muted-foreground">Ask this. Write their exact words.</p>
                <Textarea
                  value={goalText}
                  onChange={e => setGoalText(e.target.value)}
                  onBlur={handleGoalBlur}
                  className="min-h-[80px] text-sm"
                />
              </>
            ) : (
              <p className="text-sm">
                {fitnessGoal || <span className="text-muted-foreground italic">SA will capture during intro.</span>}
              </p>
            )}
          </div>

          {/* Field 2 — What would it mean */}
          <div className="space-y-0.5">
            <div className="flex items-center">
              <Label className="text-xs font-semibold" style={{ color: '#E8540A' }}>
                What would it mean to you if you got there?
              </Label>
              <SavedIndicator show={savedField === 'q5_emotional_driver'} />
            </div>
            {!readOnly ? (
              <>
                <p className="text-[10px] text-muted-foreground">Let them dream. Write exactly what they say.</p>
                <Textarea
                  value={driverText}
                  onChange={e => setDriverText(e.target.value)}
                  onBlur={handleDriverBlur}
                  className="min-h-[80px] text-sm"
                />
              </>
            ) : (
              <p className="text-sm">
                {emotionalDriver || <span className="text-muted-foreground italic">SA will capture during intro.</span>}
              </p>
            )}

            {/* Orange highlight line — show saved value (from DB, not from local input) */}
            {(readOnly ? emotionalDriver : driverText.trim()) && (
              <p className="text-sm font-semibold mt-1.5" style={{ color: '#E8540A' }}>
                ↑ {readOnly ? emotionalDriver : driverText.trim()}
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
