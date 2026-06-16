import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  BINGO_TASKS,
  FREE_SQUARE_ID,
  REQUIRED_TASK_IDS,
  TOTAL_REQUIRED,
  TOTAL_LINES,
  raffleEntriesFor,
} from './bingoTasks';

const BRAND_ORANGE = '#FF6F0D';
const BRAND_INK = '#0A0A0A';
const BRAND_CREAM = '#FDF7EA';

interface PublicPlayer {
  first_name: string;
  marked_squares: string[];
  completed_lines: string[];
  bingo_count: number;
  blackout_completed_at: string | null;
  share_slug: string;
}

export default function BingoSharePage() {
  const { slug } = useParams<{ slug: string }>();
  const [player, setPlayer] = useState<PublicPlayer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from('bingo_players' as any)
        .select('first_name, marked_squares, completed_lines, bingo_count, blackout_completed_at, share_slug')
        .eq('share_slug', slug)
        .maybeSingle();
      setPlayer((data as any as PublicPlayer) || null);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BRAND_CREAM, color: BRAND_INK }}>
        <p className="text-sm opacity-60">Loading…</p>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: BRAND_CREAM, color: BRAND_INK }}>
        <h1 className="text-3xl font-black mb-2">Card not found</h1>
        <p className="opacity-70 mb-6">This share link doesn't match any card.</p>
        <Link to="/bingo" className="rounded-xl px-5 py-3 text-sm font-black uppercase tracking-wide" style={{ background: BRAND_ORANGE, color: 'white' }}>
          Start your own card
        </Link>
      </div>
    );
  }

  const marked = new Set(player.marked_squares || []);
  const completedLines = new Set(player.completed_lines || []);
  const progress = REQUIRED_TASK_IDS.filter(id => marked.has(id)).length;
  const bingos = player.bingo_count || 0;
  const entries = raffleEntriesFor(bingos);
  const isBlackout = !!player.blackout_completed_at;

  const winningIndices = new Set<number>();
  if (completedLines.size > 0) {
    for (let r = 0; r < 5; r++) if (completedLines.has(`row-${r}`)) for (let c = 0; c < 5; c++) winningIndices.add(r * 5 + c);
    for (let c = 0; c < 5; c++) if (completedLines.has(`col-${c}`)) for (let r = 0; r < 5; r++) winningIndices.add(r * 5 + c);
    if (completedLines.has('diag-0')) [0, 6, 12, 18, 24].forEach(i => winningIndices.add(i));
    if (completedLines.has('diag-1')) [4, 8, 12, 16, 20].forEach(i => winningIndices.add(i));
  }

  return (
    <div className="min-h-screen px-4 py-6" style={{ background: BRAND_ORANGE, color: BRAND_INK }}>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-3" style={{ color: 'white' }}>
          <p className="text-xs uppercase tracking-[0.3em] font-bold mb-1">{player.first_name}'s card</p>
          <h1 className="text-4xl sm:text-5xl font-black leading-none">Summer Bingo</h1>
        </div>

        <div
          className="rounded-2xl border-4 mb-3 p-3 grid grid-cols-2 gap-2"
          style={{ borderColor: BRAND_INK, background: BRAND_CREAM }}
        >
          <div className="rounded-xl px-3 py-2 text-center" style={{ background: 'white', border: `2px solid ${BRAND_INK}` }}>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold">Bingos</p>
            <p className="text-4xl sm:text-5xl font-black tabular-nums leading-none mt-1" style={{ color: BRAND_ORANGE }}>
              {bingos}<span className="text-sm font-bold opacity-50 ml-1">/ {TOTAL_LINES}</span>
            </p>
          </div>
          <div className="rounded-xl px-3 py-2 text-center" style={{ background: 'white', border: `2px solid ${BRAND_INK}` }}>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold">Raffle entries</p>
            <p className="text-4xl sm:text-5xl font-black tabular-nums leading-none mt-1" style={{ color: BRAND_INK }}>{entries}</p>
          </div>
        </div>

        {isBlackout && (
          <div className="rounded-2xl border-4 p-3 mb-3 text-center font-black" style={{ borderColor: BRAND_INK, background: BRAND_CREAM }}>
            <p className="text-xs uppercase tracking-[0.25em] mb-1" style={{ color: BRAND_ORANGE }}>Blackout!</p>
            <p className="text-lg">Full card complete.</p>
          </div>
        )}

        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {BINGO_TASKS.map((task, idx) => {
            const isFree = task.id === FREE_SQUARE_ID;
            const done = marked.has(task.id) || isFree;
            const winning = winningIndices.has(idx);
            return (
              <div
                key={task.id}
                className="aspect-square rounded-lg sm:rounded-xl p-1 sm:p-2 text-[9px] sm:text-xs font-bold leading-tight flex items-center justify-center text-center"
                style={{
                  background: isFree ? BRAND_INK : (done ? BRAND_INK : 'white'),
                  color: isFree ? BRAND_ORANGE : (done ? BRAND_ORANGE : BRAND_INK),
                  border: `2px solid ${winning ? BRAND_ORANGE : BRAND_INK}`,
                  boxShadow: winning ? `0 0 0 3px ${BRAND_ORANGE}, 0 0 18px rgba(255,111,13,0.55)` : undefined,
                }}
              >
                <span className={isFree ? 'text-base sm:text-2xl font-black' : ''}>{task.label}</span>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'white' }}>
          {progress} of {TOTAL_REQUIRED} squares marked. (Read-only view.)
        </p>

        <div className="mt-6 rounded-2xl border-4 p-4 text-center" style={{ borderColor: BRAND_INK, background: BRAND_CREAM }}>
          <p className="text-sm font-semibold mb-3">Want your own card?</p>
          <Link
            to="/bingo"
            className="inline-block rounded-xl px-5 py-3 text-sm font-black uppercase tracking-wide"
            style={{ background: BRAND_ORANGE, color: 'white' }}
          >
            Start my card
          </Link>
        </div>
      </div>
    </div>
  );
}
