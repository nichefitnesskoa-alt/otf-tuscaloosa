import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FREE_SQUARE_ID, REQUIRED_TASK_IDS, normalizePhone } from './bingoTasks';

export interface BingoPlayer {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  phone_normalized: string;
  email: string;
  marked_squares: string[];
  blackout_completed_at: string | null;
  created_at: string;
}

const LS_KEY = 'otf_bingo_player_id';

export function useBingoPlayer() {
  const [player, setPlayer] = useState<BingoPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Resume on mount via localStorage id
  useEffect(() => {
    const id = localStorage.getItem(LS_KEY);
    if (!id) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from('bingo_players' as any).select('*').eq('id', id).maybeSingle();
      if (data) setPlayer(data as any as BingoPlayer);
      else localStorage.removeItem(LS_KEY);
      setLoading(false);
    })();
  }, []);

  const startOrResume = useCallback(async (input: {
    first_name: string; last_name: string; phone: string; email: string;
  }) => {
    const phone_normalized = normalizePhone(input.phone);
    if (phone_normalized.length !== 10) {
      throw new Error('Please enter a valid 10-digit phone number.');
    }
    // Dedup by phone — resume existing
    const existing = await supabase.from('bingo_players' as any)
      .select('*').eq('phone_normalized', phone_normalized).maybeSingle();
    if (existing.data) {
      const p = existing.data as any as BingoPlayer;
      localStorage.setItem(LS_KEY, p.id);
      setPlayer(p);
      return p;
    }
    // Always seed with FREE marked
    const { data, error } = await supabase.from('bingo_players' as any).insert({
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      phone: input.phone.trim(),
      phone_normalized,
      email: input.email.trim(),
      marked_squares: [FREE_SQUARE_ID],
    }).select().single();
    if (error) throw error;
    const p = data as any as BingoPlayer;
    localStorage.setItem(LS_KEY, p.id);
    setPlayer(p);
    return p;
  }, []);

  const toggleSquare = useCallback(async (taskId: string) => {
    if (!player || taskId === FREE_SQUARE_ID) return;
    const has = player.marked_squares.includes(taskId);
    const next = has
      ? player.marked_squares.filter(s => s !== taskId)
      : [...player.marked_squares, taskId];

    // Compute blackout
    const allDone = REQUIRED_TASK_IDS.every(id => next.includes(id));
    const blackout_completed_at =
      allDone ? (player.blackout_completed_at || new Date().toISOString()) : null;

    // Optimistic
    const prev = player;
    setPlayer({ ...player, marked_squares: next, blackout_completed_at });
    setSaving(true);
    const { error } = await supabase.from('bingo_players' as any)
      .update({ marked_squares: next, blackout_completed_at })
      .eq('id', player.id);
    setSaving(false);
    if (error) { setPlayer(prev); throw error; }
  }, [player]);

  const reset = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    setPlayer(null);
  }, []);

  return { player, loading, saving, startOrResume, toggleSquare, reset };
}
