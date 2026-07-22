import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type StickyPriority = 'normal' | 'important' | 'urgent';

/** Sentinel `assigned_to` value marking a note as team-wide. Each teammate
 *  acknowledges individually via `sticky_note_acks`; anyone can mark the whole
 *  note done. */
export const TEAM_ASSIGNEE = 'Team';

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

export interface StickyNoteAck {
  id: string;
  note_id: string;
  user_name: string;
  acknowledged_at: string;
}

export function isTeamNote(n: Pick<StickyNote, 'assigned_to'>) {
  return n.assigned_to === TEAM_ASSIGNEE;
}

/** State is timestamp-derived. For team notes it's per-viewer: viewer's ack
 *  row in `acks` upgrades their state to acknowledged. */
export function stickyState(
  n: Pick<StickyNote, 'assigned_to' | 'acknowledged_at' | 'completed_at'>,
  viewerName?: string,
  acks?: StickyNoteAck[],
): 'new' | 'acknowledged' | 'done' {
  if (n.completed_at) return 'done';
  if (isTeamNote(n)) {
    if (viewerName && acks?.some(a => a.user_name === viewerName)) return 'acknowledged';
    return 'new';
  }
  if (n.acknowledged_at) return 'acknowledged';
  return 'new';
}

export function useStickyNotes() {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [acks, setAcks] = useState<StickyNoteAck[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: n }, { data: a }] = await Promise.all([
      supabase.from('sticky_notes' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('sticky_note_acks' as any).select('*'),
    ]);
    setNotes((n as any as StickyNote[]) || []);
    setAcks((a as any as StickyNoteAck[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('sticky-notes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sticky_notes' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sticky_note_acks' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const acksByNote = useMemo(() => {
    const m = new Map<string, StickyNoteAck[]>();
    for (const a of acks) {
      const list = m.get(a.note_id) || [];
      list.push(a);
      m.set(a.note_id, list);
    }
    return m;
  }, [acks]);

  const acksFor = useCallback(
    (noteId: string): StickyNoteAck[] => acksByNote.get(noteId) || [],
    [acksByNote],
  );

  return { notes, acks, acksFor, loading, refresh: load };
}

/** "For me" open count: individual notes assigned to me that I haven't acked/done,
 *  plus team notes I haven't acked or seen closed. */
export function useMyOpenStickyCount(userName: string | undefined) {
  const { notes, acksFor } = useStickyNotes();
  if (!userName) return 0;
  return notes.filter(n => {
    if (n.completed_at) return false;
    if (isTeamNote(n)) {
      return !acksFor(n.id).some(a => a.user_name === userName);
    }
    return n.assigned_to === userName && !n.acknowledged_at;
  }).length;
}
