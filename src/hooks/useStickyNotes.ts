import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type StickyPriority = 'normal' | 'important' | 'urgent';

export interface StickyNote {
  id: string;
  content: string;
  created_by: string;
  assigned_to: string;
  due_date: string | null;
  priority: StickyPriority;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
}

/** A note is "done" once completed_at is set; "acknowledged" once
 *  acknowledged_at is set; otherwise "new". Timestamp-driven state
 *  matches the rest of the schema (mindbody_imported_at, applied_at, etc). */
export function stickyState(n: Pick<StickyNote, 'acknowledged_at' | 'completed_at'>):
  'new' | 'acknowledged' | 'done' {
  if (n.completed_at) return 'done';
  if (n.acknowledged_at) return 'acknowledged';
  return 'new';
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

/** Count of notes assigned to `userName` awaiting their acknowledgment.
 *  Self-notes are auto-acknowledged by DB trigger, so this is exactly
 *  "someone else asked me for something and I haven't seen it yet." */
export function useMyOpenStickyCount(userName: string | undefined) {
  const { notes } = useStickyNotes();
  if (!userName) return 0;
  return notes.filter(
    n => n.assigned_to === userName && !n.acknowledged_at && !n.completed_at,
  ).length;
}
