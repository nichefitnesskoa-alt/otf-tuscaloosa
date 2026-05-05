/**
 * TheirStory — Horizontal 3-column conversation fields with adaptive subtext.
 *
 * Questionnaire data (Zone 1) is removed as a standalone section.
 * Instead, Q answers appear as contextual subtext under each conversation field.
 *
 * Shoutout consent bar at top (orange, tappable).
 * Zone 2: Three side-by-side conversation inputs.
 * Zone 3 (optional): The Brief fields — passed as children.
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
  readOnly?: boolean;
  onFieldSaved?: () => void;
  afterWhySlot?: React.ReactNode;
  briefSlot?: React.ReactNode;
  editedBy?: string;
  onConsentChange?: (val: boolean | null) => void;

  /** Pre-fetched questionnaire data — avoids network on card expand */
  prefetchedQ?: {
    q2_fitness_level: number | null;
    q3_obstacle: string | null;
    q5_emotional_driver: string | null;
  } | null;

  /** Pre-fetched conversation fields — avoids network on card expand */
  prefetchedConv?: {
    sa_conversation_5_of_5: string | null;
    sa_conversation_meaning: string | null;
    sa_conversation_obstacle: string | null;
  } | null;
}

function SavedIndicator({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-[10px] text-primary font-medium ml-2 animate-in fade-in">Saved</span>;
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
  prefetchedQ,
  prefetchedConv,
}: TheirStoryProps) {
  // Zone 2 fields
  const [goalText, setGoalText] = useState('');
  const [driverText, setDriverText] = useState('');
  const [obstacleText, setObstacleText] = useState('');
  const [savedField, setSavedField] = useState<string | null>(null);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(!prefetchedConv);

  // Q data for adaptive subtext
  const [fitnessLevel, setFitnessLevel] = useState<number | null>(prefetchedQ?.q2_fitness_level ?? null);
  const [qObstacle, setQObstacle] = useState<string | null>(prefetchedQ?.q3_obstacle ?? null);
  const [qEmotionalDriver, setQEmotionalDriver] = useState<string | null>(prefetchedQ?.q5_emotional_driver ?? null);

  const flashSaved = (field: string) => {
    setSavedField(field);
    setTimeout(() => setSavedField(null), 2000);
  };

  // Init from pre-fetched data if available
  useEffect(() => {
    if (prefetchedConv) {
      setGoalText(prefetchedConv.sa_conversation_5_of_5 || '');
      setDriverText(prefetchedConv.sa_conversation_meaning || '');
      setObstacleText(prefetchedConv.sa_conversation_obstacle || '');
      // shoutout_consent removed
      setConsent(null);
      setLoading(false);
    }
    if (prefetchedQ) {
      setFitnessLevel(prefetchedQ.q2_fitness_level);
      setQObstacle(prefetchedQ.q3_obstacle);
      setQEmotionalDriver(prefetchedQ.q5_emotional_driver);
    }
  }, [bookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback fetch if no pre-fetched data
  useEffect(() => {
    if (prefetchedConv && prefetchedQ !== undefined) return; // already have data
    (async () => {
      const [qRes, bRes] = await Promise.all([
        !prefetchedQ ? supabase
          .from('intro_questionnaires')
          .select('q2_fitness_level, q3_obstacle, q5_emotional_driver')
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle() : null,
        !prefetchedConv ? supabase
          .from('intros_booked')
          .select('sa_conversation_5_of_5, sa_conversation_meaning, sa_conversation_obstacle')
          .eq('id', bookingId)
          .single() : null,
      ]);

      if (qRes?.data) {
        const d = qRes.data as any;
        setFitnessLevel(d.q2_fitness_level);
        setQObstacle(d.q3_obstacle);
        setQEmotionalDriver(d.q5_emotional_driver);
      }

      if (bRes?.data) {
        const b = bRes.data as any;
        setGoalText(b.sa_conversation_5_of_5 || '');
        setDriverText(b.sa_conversation_meaning || '');
        setObstacleText(b.sa_conversation_obstacle || '');
      }
      setLoading(false);
    })();
  }, [bookingId, prefetchedConv, prefetchedQ]);

  // Realtime subscription for coach view
  useEffect(() => {
    if (!readOnly) return;
    const ch = supabase
      .channel(`theirstory-b-${bookingId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'intros_booked', filter: `id=eq.${bookingId}` },
        (payload: any) => {
          const d = payload.new;
          if (d) {
            setGoalText(d.sa_conversation_5_of_5 || '');
            setDriverText(d.sa_conversation_meaning || '');
            setObstacleText(d.sa_conversation_obstacle || '');
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [bookingId, readOnly]);

  const saveZone2Field = useCallback(async (field: string, value: string) => {
    await supabase.from('intros_booked').update({ [field]: value || null } as any).eq('id', bookingId);
    flashSaved(field);
  }, [bookingId]);

  const toggleConsent = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = consent === true ? false : true;
    setConsent(next);
    onConsentChange?.(next);
    setSavedField('shoutout_consent');
    setTimeout(() => setSavedField(null), 1000);
  }, [consent, onConsentChange]);

  if (loading) return null;

  const truncate = (s: string | null, max: number) => {
    if (!s) return null;
    return s.length > max ? s.slice(0, max) + '…' : s;
  };

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
        style={{ backgroundColor: consentBg, minHeight: '44px' }}
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

      {/* ── ZONE 2: Three horizontal conversation fields with adaptive subtext ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Column 1 — What would a 5/5 look like */}
        <div className="space-y-1">
          <Label className="text-xs font-semibold" style={{ color: '#E8540A' }}>
            What would a 5/5 look like for you?
          </Label>
          <SavedIndicator show={savedField === 'sa_conversation_5_of_5'} />
          {fitnessLevel != null && (
            <p className="text-[10px] text-muted-foreground italic">They rated their current fitness {fitnessLevel}/5</p>
          )}
          <Textarea
            value={goalText}
            onChange={e => setGoalText(e.target.value)}
            onBlur={() => saveZone2Field('sa_conversation_5_of_5', goalText.trim())}
            placeholder="Paint me a picture. What does your life actually look like when you get there?"
            className="min-h-[80px] text-sm border border-input"
          />
        </div>

        {/* Column 2 — What would change */}
        <div className="space-y-1">
          <Label className="text-xs font-semibold" style={{ color: '#E8540A' }}>
            What would change for you if you got there?
          </Label>
          <SavedIndicator show={savedField === 'sa_conversation_meaning'} />
          {qEmotionalDriver && (
            <p className="text-[10px] text-muted-foreground italic">They mentioned: {truncate(qEmotionalDriver, 50)}</p>
          )}
          <Textarea
            value={driverText}
            onChange={e => setDriverText(e.target.value)}
            onBlur={() => saveZone2Field('sa_conversation_meaning', driverText.trim())}
            placeholder="What would actually be different? Like in their day to day?"
            className="min-h-[80px] text-sm border border-input"
          />
        </div>

        {/* Column 3 — What's been holding you back */}
        <div className="space-y-1">
          <Label className="text-xs font-semibold" style={{ color: '#E8540A' }}>
            What's been holding you back?
          </Label>
          <SavedIndicator show={savedField === 'sa_conversation_obstacle'} />
          {qObstacle && (
            <p className="text-[10px] text-muted-foreground italic">They mentioned: {truncate(qObstacle, 50)}</p>
          )}
          <Textarea
            value={obstacleText}
            onChange={e => setObstacleText(e.target.value)}
            onBlur={() => saveZone2Field('sa_conversation_obstacle', obstacleText.trim())}
            placeholder="Don't fix it. Just listen. Their answer is your close."
            className="min-h-[80px] text-sm border border-input"
          />
        </div>
      </div>

      {/* Coach WHY plan slot */}
      {afterWhySlot}

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
