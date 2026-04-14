/**
 * Shared dropdown to pick a VIP session.
 * Used in booking forms and edit dialogs when lead_source = 'VIP Class'.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { formatDisplayTime } from '@/lib/time/timeUtils';

const sb = supabase as any;

interface VipSessionOption {
  id: string;
  reserved_by_group: string | null;
  session_date: string;
  session_time: string;
  status: string;
}

interface VipSessionPickerProps {
  value: string;
  onValueChange: (id: string) => void;
  required?: boolean;
  /** Show amber warning when empty and required */
  showWarning?: boolean;
}

export function VipSessionPicker({ value, onValueChange, required, showWarning }: VipSessionPickerProps) {
  const [sessions, setSessions] = useState<VipSessionOption[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await sb
        .from('vip_sessions')
        .select('id, reserved_by_group, session_date, session_time, status')
        .in('status', ['reserved', 'completed'])
        .is('archived_at', null)
        .order('session_date', { ascending: false });
      setSessions((data as VipSessionOption[]) || []);
    })();
  }, []);

  const isEmpty = !value;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Which VIP class? {required && <span className="text-destructive">*</span>}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={isEmpty && showWarning ? 'border-amber-500' : ''}>
          <SelectValue placeholder="Select VIP class..." />
        </SelectTrigger>
        <SelectContent>
          {sessions.map(s => (
            <SelectItem key={s.id} value={s.id}>
              {s.reserved_by_group || 'VIP'} — {format(new Date(s.session_date + 'T00:00:00'), 'MMM d, yyyy')} at {formatDisplayTime(s.session_time)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isEmpty && showWarning && required && (
        <p className="text-xs text-amber-600">Please select which VIP class</p>
      )}
    </div>
  );
}
