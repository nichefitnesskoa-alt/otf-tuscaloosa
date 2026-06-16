import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  FREE_SQUARE_ID,
  REQUIRED_TASK_IDS,
  computeCompletedLines,
  normalizePhone,
} from './bingoTasks';

export interface BingoPlayer {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  phone_normalized: string;
  email: string;
  marked_squares: string[];
  blackout_completed_at: string | null;
  bingo_count: number;
  completed_lines: string[];
  first_bingo_at: string | null;
  late_cancel_used: boolean;
  share_slug: string;
  created_at: string;
}

const LS_KEY = 'otf_bingo_player_id';

export function useBingoPlayer() {
  const [player, setPlayer] = useState<BingoPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  /** Number of NEW bingos created by the last toggle (for celebration UI). */
  const [lastBingoDelta, setLastBingoDelta] = useState(0);

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
    const existing = await supabase.from('bingo_players' as any)
      .select('*').eq('phone_normalized', phone_normalized).maybeSingle();
    if (existing.data) {
      const p = existing.data as any as BingoPlayer;
      localStorage.setItem(LS_KEY, p.id);
      setPlayer(p);
      return p;
    }
    const { data, error } = await supabase.from('bingo_players' as any).insert({
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      phone: input.phone.trim(),
      phone_normalized,
      email: input.email.trim(),
      marked_squares: [FREE_SQUARE_ID],
      bingo_count: 0,
      completed_lines: [],
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

    const completed_lines = computeCompletedLines(next);
    const bingo_count = completed_lines.length;

    const allDone = REQUIRED_TASK_IDS.every(id => next.includes(id));
    const blackout_completed_at =
      allDone ? (player.blackout_completed_at || new Date().toISOString()) : null;

    const first_bingo_at =
      bingo_count > 0 ? (player.first_bingo_at || new Date().toISOString()) : player.first_bingo_at;

    const delta = bingo_count - player.bingo_count;
    setLastBingoDelta(delta > 0 ? delta : 0);

    const prev = player;
    setPlayer({
      ...player,
      marked_squares: next,
      blackout_completed_at,
      bingo_count,
      completed_lines,
      first_bingo_at,
    });
    setSaving(true);
    const { error } = await supabase.from('bingo_players' as any)
      .update({
        marked_squares: next,
        blackout_completed_at,
        bingo_count,
        completed_lines,
        first_bingo_at,
      })
      .eq('id', player.id);
    setSaving(false);
    if (error) { setPlayer(prev); throw error; }
  }, [player]);

  const clearBingoDelta = useCallback(() => setLastBingoDelta(0), []);

  const findByPhone = useCallback(async (phone: string) => {
    const phone_normalized = normalizePhone(phone);
    if (phone_normalized.length !== 10) {
      throw new Error('Please enter a valid 10-digit phone number.');
    }
    const { data } = await supabase.from('bingo_players' as any)
      .select('*').eq('phone_normalized', phone_normalized).maybeSingle();
    if (!data) return null;
    const p = data as any as BingoPlayer;
    localStorage.setItem(LS_KEY, p.id);
    setPlayer(p);
    return p;
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    setPlayer(null);
  }, []);

  return { player, loading, saving, startOrResume, findByPhone, toggleSquare, reset, lastBingoDelta, clearBingoDelta };
}
