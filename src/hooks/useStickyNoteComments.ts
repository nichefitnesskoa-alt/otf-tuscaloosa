import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StickyNoteComment {
  id: string;
  note_id: string;
  author: string;
  content: string;
  created_at: string;
}

/** Loads ALL sticky_note_comments once and subscribes to realtime INSERTs,
 *  matching the exact pattern used by useTeamChat.ts. Exposes per-note
 *  slices + counts so a card can show a count without a per-note query. */
export function useStickyNoteComments() {
  const [comments, setComments] = useState<StickyNoteComment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('sticky_note_comments' as any)
      .select('*')
      .order('created_at', { ascending: true });
    setComments((data as any as StickyNoteComment[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('sticky-note-comments-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sticky_note_comments' },
        (payload) => {
          setComments(prev => {
            const row = payload.new as StickyNoteComment;
            if (prev.some(c => c.id === row.id)) return prev;
            return [...prev, row];
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const byNote = useMemo(() => {
    const map = new Map<string, StickyNoteComment[]>();
    for (const c of comments) {
      const arr = map.get(c.note_id) || [];
      arr.push(c);
      map.set(c.note_id, arr);
    }
    return map;
  }, [comments]);

  const forNote = useCallback((noteId: string) => byNote.get(noteId) || [], [byNote]);
  const countFor = useCallback((noteId: string) => byNote.get(noteId)?.length || 0, [byNote]);

  const send = useCallback(async (noteId: string, author: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed || !author || !noteId) return;
    await supabase.from('sticky_note_comments' as any).insert({
      note_id: noteId,
      author,
      content: trimmed,
    });
  }, []);

  return { comments, loading, forNote, countFor, send };
}
