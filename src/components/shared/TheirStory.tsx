/**
 * TheirStory — shared 3-field section for SA and Coach intro cards.
 * Fields: fitness level (1-5), what 5/5 looks like, what it would mean.
 * Auto-creates questionnaire record if none exists on first save.
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
  /** If true, fields are read-only when questionnaire data exists */
  readOnly?: boolean;
  /** Called after any field is saved */
  onFieldSaved?: () => void;
}

function SavedIndicator({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-[10px] text-primary font-medium ml-2 animate-in fade-in">Saved</span>;
}

export function TheirStory({ bookingId, memberName, classDate, readOnly = false, onFieldSaved }: TheirStoryProps) {
  const [qId, setQId] = useState<string | null>(null);
  const [qComplete, setQComplete] = useState(false);
  const [fitnessLevel, setFitnessLevel] = useState<number | null>(null);
  const [fitnessGoal, setFitnessGoal] = useState('');
  const [emotionalDriver, setEmotionalDriver] = useState('');
  const [loading, setLoading] = useState(true);
  const [savedField, setSavedField] = useState<string | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const flashSaved = (field: string) => {
    setSavedField(field);
    setTimeout(() => setSavedField(null), 2000);
  };

  // Fetch questionnaire data
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('intro_questionnaires')
        .select('id, status, q1_fitness_goal, q2_fitness_level, q5_emotional_driver')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setQId(data.id);
        const s = (data as any).status;
        setQComplete(s === 'completed' || s === 'submitted');
        setFitnessLevel((data as any).q2_fitness_level ?? null);
        setFitnessGoal((data as any).q1_fitness_goal || '');
        setEmotionalDriver((data as any).q5_emotional_driver || '');
      }
      setLoading(false);
    })();
  }, [bookingId]);

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

  const debounceSave = useCallback((key: string, fn: () => void, delay = 800) => {
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(fn, delay);
  }, []);

  const isEditable = !readOnly || !qComplete;

  const handleFitnessLevel = (val: string) => {
    const n = parseInt(val);
    if (val === '') { setFitnessLevel(null); saveField('q2_fitness_level', null); return; }
    if (!isNaN(n) && n >= 1 && n <= 5) { setFitnessLevel(n); saveField('q2_fitness_level', n); }
  };

  const handleGoalChange = (val: string) => {
    setFitnessGoal(val);
    debounceSave('goal', () => saveField('q1_fitness_goal', val || null));
  };

  const handleDriverChange = (val: string) => {
    setEmotionalDriver(val);
    debounceSave('driver', () => saveField('q5_emotional_driver', val || null));
  };

  if (loading) return null;

  return (
    <div className="space-y-2.5">
      <h4 className="font-bold text-sm">THEIR STORY</h4>

      {/* Field 1 — Fitness level */}
      <div className="space-y-0.5">
        <div className="flex items-center">
          <Label className="text-xs font-medium text-muted-foreground">Current fitness level</Label>
          <SavedIndicator show={savedField === 'q2_fitness_level'} />
        </div>
        {isEditable ? (
          <Input
            type="number"
            min={1}
            max={5}
            value={fitnessLevel ?? ''}
            onChange={e => handleFitnessLevel(e.target.value)}
            placeholder="Ask: 1 to 5 — where are you today?"
            className="h-8 text-sm w-full"
          />
        ) : (
          <p className="text-sm font-semibold">{fitnessLevel}/5</p>
        )}
      </div>

      {/* Field 2 — What 5/5 looks like */}
      <div className="space-y-0.5">
        <div className="flex items-center">
          <Label className="text-xs font-medium text-muted-foreground">What would a 5/5 look like for you?</Label>
          <SavedIndicator show={savedField === 'q1_fitness_goal'} />
        </div>
        {isEditable ? (
          <Textarea
            value={fitnessGoal}
            onChange={e => handleGoalChange(e.target.value)}
            placeholder="Write their exact words."
            className="min-h-[48px] text-sm"
          />
        ) : (
          <p className="text-sm">"{fitnessGoal}"</p>
        )}
      </div>

      {/* Field 3 — What it would mean (orange highlight) */}
      <div className="space-y-0.5">
        <div className="flex items-center">
          <Label className="text-xs font-medium text-muted-foreground">What would it mean to you if you got there?</Label>
          <SavedIndicator show={savedField === 'q5_emotional_driver'} />
        </div>
        {isEditable ? (
          <Textarea
            value={emotionalDriver}
            onChange={e => handleDriverChange(e.target.value)}
            placeholder="Write their exact words. This is what the coach uses."
            className="min-h-[48px] text-sm"
          />
        ) : null}
        {emotionalDriver ? (
          <p className={cn('text-sm font-semibold', isEditable ? 'mt-1' : '')} style={{ color: '#E8540A' }}>
            {!isEditable && `"${emotionalDriver}"`}
            {isEditable && null}
          </p>
        ) : null}
        {/* In read-only mode show orange text */}
        {!isEditable && emotionalDriver && null}
      </div>
    </div>
  );
}
