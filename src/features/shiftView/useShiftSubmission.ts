import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { ShiftType } from './ShiftSelector';

export interface ShiftSubmission {
  id?: string;
  lead_forward_answer: string;
  member_experience_answer: string;
  ownership_lane_answer: string;
  submitted_at: string | null;
}

const EMPTY: ShiftSubmission = {
  lead_forward_answer: '',
  member_experience_answer: '',
  ownership_lane_answer: '',
  submitted_at: null,
};

export function useShiftSubmission(saName: string | undefined, shiftType: ShiftType) {
  const [data, setData] = useState<ShiftSubmission>(EMPTY);
  const [loading, setLoading] = useState(true);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const load = useCallback(async () => {
    if (!saName) return;
    setLoading(true);
    const { data: row } = await supabase
      .from('shift_submissions' as any)
      .select('id, lead_forward_answer, member_experience_answer, ownership_lane_answer, submitted_at')
      .eq('sa_name', saName)
      .eq('shift_date', todayStr)
      .eq('shift_type', shiftType)
      .maybeSingle();
    if (row) {
      const r = row as any;
      setData({
        id: r.id,
        lead_forward_answer: r.lead_forward_answer ?? '',
        member_experience_answer: r.member_experience_answer ?? '',
        ownership_lane_answer: r.ownership_lane_answer ?? '',
        submitted_at: r.submitted_at,
      });
    } else {
      setData(EMPTY);
    }
    setLoading(false);
  }, [saName, todayStr, shiftType]);

  useEffect(() => { load(); }, [load]);

  // Realtime: any change to this user's submission row reloads.
  useEffect(() => {
    if (!saName) return;
    const channel = supabase
      .channel(`shift-submission-${saName}-${todayStr}-${shiftType}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_submissions' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [saName, todayStr, shiftType, load]);

  const save = useCallback(async (patch: Partial<ShiftSubmission>) => {
    if (!saName) return;
    const merged = { ...data, ...patch };
    setData(merged);
    await supabase
      .from('shift_submissions' as any)
      .upsert(
        {
          sa_name: saName,
          shift_date: todayStr,
          shift_type: shiftType,
          lead_forward_answer: merged.lead_forward_answer || null,
          member_experience_answer: merged.member_experience_answer || null,
          ownership_lane_answer: merged.ownership_lane_answer || null,
          submitted_at: merged.submitted_at,
        },
        { onConflict: 'sa_name,shift_date,shift_type' },
      );
  }, [saName, todayStr, shiftType, data]);

  const submit = useCallback(async () => {
    const now = new Date().toISOString();
    await save({ submitted_at: now });
  }, [save]);

  const reopen = useCallback(async () => {
    await save({ submitted_at: null });
  }, [save]);

  return { data, loading, save, submit, reopen };
}
