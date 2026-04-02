/**
 * SABriefFields — editable Brief fields for SA intro card Zone 3.
 * Auto-fetches current values from intros_booked on mount.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
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
  const [lookingFor, setLookingFor] = useState('');
  const [objection, setObjection] = useState('');
  const [fiveVision, setFiveVision] = useState('');
  const [humanDetail, setHumanDetail] = useState('');
  const [consent, setConsent] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [savedField, setSavedField] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('intros_booked')
        .select('sa_buying_criteria, sa_objection, coach_brief_five_vision, coach_brief_human_detail, shoutout_consent')
        .eq('id', bookingId)
        .single();
      if (data) {
        const d = data as any;
        setLookingFor(d.sa_buying_criteria || '');
        setObjection(d.sa_objection || '');
        setFiveVision(d.coach_brief_five_vision || '');
        setHumanDetail(d.coach_brief_human_detail || '');
        setConsent(d.shoutout_consent ?? false);
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
          <Label className="text-xs font-medium text-muted-foreground">Looking for</Label>
          <SavedIndicator show={savedField === 'sa_buying_criteria'} />
        </div>
        <Textarea
          value={lookingFor}
          onChange={e => { setLookingFor(e.target.value); debounce('lf', () => saveField('sa_buying_criteria', e.target.value || null)); }}
          placeholder="Use their exact words…"
          className="min-h-[48px] text-sm"
        />
      </div>

      <div className="space-y-0.5">
        <div className="flex items-center">
          <Label className="text-xs font-medium text-muted-foreground">Potential objection</Label>
          <SavedIndicator show={savedField === 'sa_objection'} />
        </div>
        <Textarea
          value={objection}
          onChange={e => { setObjection(e.target.value); debounce('obj', () => saveField('sa_objection', e.target.value || null)); }}
          placeholder="What might hold them back?"
          className="min-h-[48px] text-sm"
        />
      </div>

      <div className="space-y-0.5">
        <div className="flex items-center">
          <Label className="text-xs font-medium text-muted-foreground">What would 5/5 look like (for coach)</Label>
          <SavedIndicator show={savedField === 'coach_brief_five_vision'} />
        </div>
        <Textarea
          value={fiveVision}
          onChange={e => { setFiveVision(e.target.value); debounce('fv', () => saveField('coach_brief_five_vision', e.target.value || null)); }}
          placeholder="Their answer to 'What would being a 5 look like to you?'"
          className="min-h-[48px] text-sm"
        />
      </div>

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

      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Label className="text-xs font-medium text-muted-foreground">Shoutout consent</Label>
          <SavedIndicator show={savedField === 'shoutout_consent'} />
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs", !consent && "font-semibold")}>No</span>
          <Switch checked={consent} onCheckedChange={v => { setConsent(v); saveField('shoutout_consent', v); }} />
          <span className={cn("text-xs", consent && "font-semibold")}>Yes</span>
        </div>
      </div>
    </div>
  );
}
