import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type StickyPriority = 'low' | 'medium' | 'high' | 'urgent';
export type StickyStatus = 'open' | 'acknowledged' | 'done';

export interface StickyNote {
  id: string;
  content: string;
  created_by: string;
  assigned_to: string;
  due_date: string | null;
  priority: StickyPriority;
  status: StickyStatus;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
}

export function useStickyNotes() {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('sticky_notes' as any)
      .select('*')
      .order('created_at', { ascending: false });
    setNotes((data as any as StickyNote[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('sticky-notes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sticky_notes' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return { notes, loading, refresh: load };
}

/** Count of notes assigned to `userName` awaiting their acknowledgment. */
export function useMyOpenStickyCount(userName: string | undefined) {
  const { notes } = useStickyNotes();
  if (!userName) return 0;
  return notes.filter(n => n.assigned_to === userName && n.status === 'open').length;
}
