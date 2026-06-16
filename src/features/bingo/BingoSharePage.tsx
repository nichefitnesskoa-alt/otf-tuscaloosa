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
import otfLogo from '@/assets/otf-logo-orange.png.asset.json';

const BRAND_ORANGE = '#FF6F0D';
const BRAND_INK = '#0A0A0A';
const BRAND_CREAM = '#FDF7EA';
const BRAND_GREY = '#D7D7D7';
const FONT = "'PP Right Grotesk', 'Arial Black', 'Helvetica Neue', Arial, sans-serif";

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: BRAND_INK, color: BRAND_CREAM, fontFamily: FONT }}>
        <p className="text-sm opacity-60 uppercase tracking-[0.3em]">Loading…</p>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: BRAND_INK, color: BRAND_CREAM, fontFamily: FONT }}>
        <img src={otfLogo.url} alt="Orangetheory Fitness" className="h-8 mb-6 object-contain" />
        <h1 className="text-4xl font-black mb-2 uppercase tracking-tight">Card not found</h1>
        <p className="mb-6" style={{ color: BRAND_GREY }}>This share link doesn't match any card.</p>
        <Link to="/bingo" className="px-6 py-3 text-xs font-black uppercase tracking-[0.2em]" style={{ background: BRAND_ORANGE, color: BRAND_INK }}>
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
    <div className="min-h-screen px-3 sm:px-4 py-5" style={{ background: BRAND_INK, color: BRAND_CREAM, fontFamily: FONT }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <img src={otfLogo} alt="Orangetheory Fitness" className="h-7 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
          <p className="text-[10px] uppercase tracking-[0.4em] font-bold" style={{ color: BRAND_GREY }}>Tuscaloosa</p>
        </div>

        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-[0.4em] font-bold mb-1" style={{ color: BRAND_ORANGE }}>{player.first_name}'s card</p>
          <h1 className="text-5xl sm:text-6xl font-black leading-[0.9] uppercase tracking-tight" style={{ color: BRAND_CREAM }}>
            Summer<br/>Bingo
          </h1>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="px-3 py-3 sm:py-4 text-center" style={{ background: BRAND_CREAM, border: `2px solid ${BRAND_INK}` }}>
            <p className="text-[10px] uppercase tracking-[0.3em] font-black" style={{ color: BRAND_INK }}>Bingos</p>
            <p className="text-5xl sm:text-6xl font-black tabular-nums leading-none mt-1.5" style={{ color: BRAND_ORANGE, letterSpacing: '-0.04em' }}>
              {bingos}<span className="text-base font-black opacity-40 ml-1" style={{ color: BRAND_INK }}>/{TOTAL_LINES}</span>
            </p>
          </div>
          <div className="px-3 py-3 sm:py-4 text-center" style={{ background: BRAND_CREAM, border: `2px solid ${BRAND_INK}` }}>
            <p className="text-[10px] uppercase tracking-[0.3em] font-black" style={{ color: BRAND_INK }}>Raffle entries</p>
            <p className="text-5xl sm:text-6xl font-black tabular-nums leading-none mt-1.5" style={{ color: BRAND_INK, letterSpacing: '-0.04em' }}>{entries}</p>
          </div>
        </div>

        {isBlackout && (
          <div className="mb-3 px-3 py-3 text-center font-black uppercase tracking-wide" style={{ background: BRAND_ORANGE, color: BRAND_INK }}>
            <p className="text-[10px] tracking-[0.3em] mb-1">Blackout</p>
            <p className="text-lg leading-none">Full card complete.</p>
          </div>
        )}

        <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
          {BINGO_TASKS.map((task, idx) => {
            const isFree = task.id === FREE_SQUARE_ID;
            const isMarked = marked.has(task.id);
            const winning = winningIndices.has(idx);
            const bg = isFree ? BRAND_INK : (isMarked ? BRAND_ORANGE : BRAND_CREAM);
            const fg = isFree ? BRAND_ORANGE : BRAND_INK;
            const borderColor = winning ? BRAND_ORANGE : (isFree ? BRAND_ORANGE : BRAND_INK);
            return (
              <div
                key={task.id}
                className="aspect-square p-1 sm:p-2 text-[9px] sm:text-xs font-black uppercase leading-tight flex items-center justify-center text-center"
                style={{
                  background: bg,
                  color: fg,
                  border: `${winning ? 3 : 1.5}px solid ${borderColor}`,
                  fontFamily: FONT,
                  letterSpacing: '0.02em',
                  boxShadow: winning ? `0 0 0 2px ${BRAND_INK}, 0 0 22px rgba(255,111,13,0.7)` : undefined,
                }}
              >
                <span className={isFree ? 'text-lg sm:text-3xl font-black' : ''}>
                  {isFree ? 'FREE' : task.label}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-center text-[11px] uppercase tracking-wider mt-5" style={{ color: BRAND_GREY }}>
          {progress} of {TOTAL_REQUIRED} squares marked · Read-only view
        </p>

        <div className="mt-6 p-5 text-center" style={{ background: BRAND_CREAM, color: BRAND_INK, border: `2px solid ${BRAND_ORANGE}` }}>
          <p className="text-sm font-black uppercase tracking-wide mb-3">Want your own card?</p>
          <Link
            to="/bingo"
            className="inline-block px-6 py-3 text-xs font-black uppercase tracking-[0.2em]"
            style={{ background: BRAND_ORANGE, color: BRAND_INK, fontFamily: FONT }}
          >
            Start my card
          </Link>
        </div>
      </div>
    </div>
  );
}
