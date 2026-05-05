/**
 * SABriefFields — editable Brief field for SA intro card Zone 3.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  bookingId: string;
  editedBy: string;
  onSaved?: () => void;
}

function SavedIndicator({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-[10px] text-primary font-medium ml-2 animate-in fade-in">Saved</span>;
}

export function SABriefFields({ bookingId, editedBy, onSaved }: Props) {
  const [humanDetail, setHumanDetail] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [savedField, setSavedField] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('intros_booked')
        .select('coach_brief_human_detail')
        .eq('id', bookingId)
        .single();
      if (data) {
        setHumanDetail((data as any).coach_brief_human_detail || '');
      }
      setLoaded(true);
    })();
  }, [bookingId]);

  const flashSaved = (f: string) => {
    setSavedField(f);
    setTimeout(() => setSavedField(null), 2000);
  };

  const saveField = useCallback(async (field: string, value: any) => {
    await supabase.from('intros_booked').update({
      [field]: value,
      last_edited_at: new Date().toISOString(),
      last_edited_by: editedBy,
    } as any).eq('id', bookingId);
    flashSaved(field);
    onSaved?.();
  }, [bookingId, editedBy, onSaved]);

  const debounce = (key: string, fn: () => void) => {
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, 800);
  };

  if (!loaded) return null;

  return (
    <div className="space-y-2.5">
      <div className="space-y-0.5">
        <div className="flex items-center">
          <Label className="text-xs font-medium text-muted-foreground">Any additional notes</Label>
          <SavedIndicator show={savedField === 'coach_brief_human_detail'} />
        </div>
        <Textarea
          value={humanDetail}
          onChange={e => { setHumanDetail(e.target.value); debounce('hd', () => saveField('coach_brief_human_detail', e.target.value || null)); }}
          placeholder="Dog's name, where they're from, what they do…"
          className="min-h-[48px] text-sm"
        />
      </div>
    </div>
  );
}
