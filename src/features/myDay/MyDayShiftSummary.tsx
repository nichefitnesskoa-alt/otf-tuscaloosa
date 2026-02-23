import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { FileText, Check } from 'lucide-react';

type ShiftType = 'AM Shift' | 'Mid Shift' | 'PM Shift';

interface MyDayShiftSummaryProps {
  compact?: boolean;
}

export function MyDayShiftSummary({ compact }: MyDayShiftSummaryProps = {}) {
  const { user } = useAuth();
  const [shiftType, setShiftType] = useState<ShiftType>('AM Shift');
  const [calls, setCalls] = useState('');
  const [texts, setTexts] = useState('');
  const [dms, setDms] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const userName = user?.name || '';

  // Load existing row when shift type changes
  useEffect(() => {
    if (!userName) return;
    loadedRef.current = false;
    const load = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from('shift_recaps')
        .select('calls_made, texts_sent, dms_sent')
        .eq('staff_name', userName)
        .eq('shift_date', todayStr)
        .eq('shift_type', shiftType)
        .maybeSingle();

      if (data) {
        setCalls(String(data.calls_made ?? ''));
        setTexts(String(data.texts_sent ?? ''));
        setDms(String(data.dms_sent ?? ''));
      } else {
        setCalls('');
        setTexts('');
        setDms('');
      }
      setIsLoading(false);
      // Mark loaded so autosave doesn't fire on initial load
      setTimeout(() => { loadedRef.current = true; }, 100);
    };
    load();
  }, [shiftType, userName, todayStr]);

  // Autosave with 1.5s debounce
  const doAutosave = useCallback(async (c: string, t: string, d: string) => {
    if (!userName) return;
    // Skip if all fields empty
    if (!c && !t && !d) return;
    try {
      await supabase
        .from('shift_recaps')
        .upsert(
          {
            staff_name: userName,
            shift_date: todayStr,
            shift_type: shiftType,
            calls_made: parseInt(c || '0', 10),
            texts_sent: parseInt(t || '0', 10),
            dms_sent: parseInt(d || '0', 10),
          },
          { onConflict: 'staff_name,shift_date,shift_type' },
        );
      setSavedIndicator(true);
      setTimeout(() => setSavedIndicator(false), 1500);
    } catch (err) {
      console.error('Shift autosave error:', err);
    }
  }, [userName, todayStr, shiftType]);

  useEffect(() => {
    if (!loadedRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doAutosave(calls, texts, dms);
    }, 1500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [calls, texts, dms, doAutosave]);

  const inner = (
    <div className="space-y-2">
      <div className={compact ? 'flex items-center gap-2' : ''}>
        <Select value={shiftType} onValueChange={(v) => setShiftType(v as ShiftType)}>
          <SelectTrigger className={compact ? 'h-7 text-xs flex-shrink-0 w-28' : 'h-9'}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM Shift">AM Shift</SelectItem>
            <SelectItem value="Mid Shift">Mid Shift</SelectItem>
            <SelectItem value="PM Shift">PM Shift</SelectItem>
          </SelectContent>
        </Select>

        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : (
          <div className={`${compact ? 'flex items-center gap-1.5 flex-1' : 'grid grid-cols-3 gap-2'} border-2 border-primary rounded-lg p-2`}>
            <div className={compact ? 'flex items-center gap-1' : ''}>
              {compact && <Label className="text-[10px] text-muted-foreground shrink-0">Calls</Label>}
              {!compact && <Label className="text-xs text-muted-foreground mb-1 block">Calls</Label>}
              <Input
                type="number"
                min="0"
                value={calls}
                onChange={(e) => setCalls(e.target.value)}
                placeholder="0"
                className={compact ? 'h-7 w-14 text-xs text-center' : 'h-9 text-center'}
              />
            </div>
            <div className={compact ? 'flex items-center gap-1' : ''}>
              {compact && <Label className="text-[10px] text-muted-foreground shrink-0">Texts</Label>}
              {!compact && <Label className="text-xs text-muted-foreground mb-1 block">Texts</Label>}
              <Input
                type="number"
                min="0"
                value={texts}
                onChange={(e) => setTexts(e.target.value)}
                placeholder="0"
                className={compact ? 'h-7 w-14 text-xs text-center' : 'h-9 text-center'}
              />
            </div>
            <div className={compact ? 'flex items-center gap-1' : ''}>
              {compact && <Label className="text-[10px] text-muted-foreground shrink-0">DMs</Label>}
              {!compact && <Label className="text-xs text-muted-foreground mb-1 block">DMs</Label>}
              <Input
                type="number"
                min="0"
                value={dms}
                onChange={(e) => setDms(e.target.value)}
                placeholder="0"
                className={compact ? 'h-7 w-14 text-xs text-center' : 'h-9 text-center'}
              />
            </div>
            {savedIndicator && (
              <span className={`flex items-center gap-0.5 text-emerald-600 ${compact ? 'text-[10px]' : 'text-xs'}`}>
                <Check className="w-3 h-3" /> Saved
              </span>
            )}
          </div>
        )}
      </div>

      {!compact && savedIndicator && (
        <p className="text-xs text-emerald-600 flex items-center gap-1 justify-center">
          <Check className="w-3 h-3" /> Saved
        </p>
      )}
    </div>
  );

  if (compact) return inner;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Shift Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {inner}
      </CardContent>
    </Card>
  );
}
