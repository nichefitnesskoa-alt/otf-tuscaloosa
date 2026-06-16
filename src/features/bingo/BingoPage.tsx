import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  BINGO_TASKS,
  FREE_SQUARE_ID,
  REQUIRED_TASK_IDS,
  TOTAL_REQUIRED,
  TOTAL_LINES,
  raffleEntriesFor,
} from './bingoTasks';
import { useBingoPlayer } from './useBingoPlayer';
import { toast } from 'sonner';
import otfLogo from '@/assets/otf-logo.jpg';

const BRAND_ORANGE = '#FF6F0D';
const BRAND_INK = '#0A0A0A';
const BRAND_CREAM = '#FDF7EA';
const BRAND_GREY = '#D7D7D7';
const FONT = "'PP Right Grotesk', 'Arial Black', 'Helvetica Neue', Arial, sans-serif";

export default function BingoPage() {
  const { player, loading, startOrResume, findByPhone, toggleSquare, lastBingoDelta, clearBingoDelta } = useBingoPlayer();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BRAND_CREAM, color: BRAND_INK }}>
        <p className="text-sm opacity-60">Loading…</p>
      </div>
    );
  }

  if (!player) return <EntryGate onSubmit={startOrResume} onFind={findByPhone} />;
  return (
    <BingoCard
      player={player}
      onToggle={toggleSquare}
      lastBingoDelta={lastBingoDelta}
      clearBingoDelta={clearBingoDelta}
    />
  );
}

function EntryGate({ onSubmit, onFind }: {
  onSubmit: (i: { first_name: string; last_name: string; phone: string; email: string }) => Promise<any>;
  onFind: (phone: string) => Promise<any>;
}) {
  const [mode, setMode] = useState<'start' | 'find'>('start');
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '' });
  const [findPhone, setFindPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim() || !form.email.trim()) {
      toast.error('Please fill in everything so we can find you if you win.');
      return;
    }
    setSubmitting(true);
    try { await onSubmit(form); }
    catch (err: any) { toast.error(err?.message || 'Something went wrong.'); }
    finally { setSubmitting(false); }
  };

  const handleFind = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!findPhone.trim()) { toast.error('Enter your phone number.'); return; }
    setSubmitting(true);
    try {
      const found = await onFind(findPhone);
      if (!found) {
        toast.error("We don't see a card with that number. Start a new one below.");
        setMode('start');
        setForm(f => ({ ...f, phone: findPhone }));
      }
    } catch (err: any) { toast.error(err?.message || 'Something went wrong.'); }
    finally { setSubmitting(false); }
  };

  const inputCls = 'w-full rounded-sm border-2 px-4 py-3 text-base bg-white focus:outline-none focus:ring-2';
  const tabBtn = (active: boolean) => ({
    background: active ? BRAND_ORANGE : 'transparent',
    color: active ? BRAND_INK : BRAND_CREAM,
    borderColor: active ? BRAND_ORANGE : BRAND_CREAM,
  });

  return (
    <div className="min-h-screen px-4 py-8 flex items-center justify-center" style={{ background: BRAND_INK, color: BRAND_CREAM, fontFamily: FONT }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src={otfLogo} alt="Orangetheory Fitness" className="h-10 mx-auto mb-5 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
          <p className="text-[11px] uppercase tracking-[0.45em] font-bold mb-3" style={{ color: BRAND_ORANGE }}>Tuscaloosa</p>
          <h1 className="text-6xl font-black leading-[0.9] uppercase tracking-tight mb-3" style={{ color: BRAND_CREAM }}>Summer<br/>Bingo</h1>
          <p className="text-sm" style={{ color: BRAND_GREY }}>Every bingo earns you something. Stay moving all summer.</p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => setMode('start')}
            className="rounded-xl py-3 text-sm font-black uppercase tracking-wide border-2"
            style={tabBtn(mode === 'start')}
          >
            Start my card
          </button>
          <button
            type="button"
            onClick={() => setMode('find')}
            className="rounded-xl py-3 text-sm font-black uppercase tracking-wide border-2"
            style={tabBtn(mode === 'find')}
          >
            Find my card
          </button>
        </div>

        {mode === 'start' ? (
          <form onSubmit={handleStart} className="rounded-2xl p-5 space-y-3 border-2" style={{ borderColor: BRAND_INK, background: 'white' }}>
            <div className="grid grid-cols-2 gap-3">
              <input className={inputCls} style={{ borderColor: BRAND_INK }} placeholder="First name" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
              <input className={inputCls} style={{ borderColor: BRAND_INK }} placeholder="Last name" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
            </div>
            <input className={inputCls} style={{ borderColor: BRAND_INK }} placeholder="Phone" inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <input className={inputCls} style={{ borderColor: BRAND_INK }} placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <p className="text-xs opacity-70 pt-1">We just need this so we can reach you if you win.</p>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl py-4 text-base font-black uppercase tracking-wide disabled:opacity-60"
              style={{ background: BRAND_ORANGE, color: 'white' }}
            >
              {submitting ? 'Starting…' : 'Start my card'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleFind} className="rounded-2xl p-5 space-y-3 border-2" style={{ borderColor: BRAND_INK, background: 'white' }}>
            <p className="text-sm font-semibold">Already started a card? Type the phone number you used.</p>
            <input className={inputCls} style={{ borderColor: BRAND_INK }} placeholder="Phone" inputMode="tel" value={findPhone} onChange={e => setFindPhone(e.target.value)} />
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl py-4 text-base font-black uppercase tracking-wide disabled:opacity-60"
              style={{ background: BRAND_ORANGE, color: 'white' }}
            >
              {submitting ? 'Looking…' : 'Find my card'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function BingoCard({
  player,
  onToggle,
  lastBingoDelta,
  clearBingoDelta,
}: {
  player: NonNullable<ReturnType<typeof useBingoPlayer>['player']>;
  onToggle: (id: string) => Promise<void>;
  lastBingoDelta: number;
  clearBingoDelta: () => void;
}) {
  const marked = new Set(player.marked_squares);
  const completedLines = new Set(player.completed_lines);
  const progress = REQUIRED_TASK_IDS.filter(id => marked.has(id)).length;
  const bingos = player.bingo_count;
  const entries = raffleEntriesFor(bingos);
  const isBlackout = !!player.blackout_completed_at;
  const hasLateCancel = bingos >= 1;

  // Celebration overlay
  const [celebration, setCelebration] = useState<null | { kind: 'first' | 'more'; bingos: number; entries: number }>(null);
  const prevBingos = useRef(bingos);
  // Pulse animation flags
  const [pulseBingos, setPulseBingos] = useState(false);
  const [pulseEntries, setPulseEntries] = useState(false);

  useEffect(() => {
    if (lastBingoDelta > 0) {
      const wasFirst = prevBingos.current === 0 && bingos >= 1;
      setCelebration({ kind: wasFirst ? 'first' : 'more', bingos, entries });
      setPulseBingos(true);
      if (entries > 0) setPulseEntries(true);
      confetti({
        particleCount: wasFirst ? 260 : 160,
        spread: 100,
        origin: { y: 0.45 },
        colors: [BRAND_ORANGE, BRAND_INK, BRAND_CREAM, '#FFFFFF'],
      });
      const t1 = setTimeout(() => setCelebration(null), wasFirst ? 3400 : 2400);
      const t2 = setTimeout(() => { setPulseBingos(false); setPulseEntries(false); }, 900);
      const t3 = setTimeout(() => clearBingoDelta(), 100);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
    prevBingos.current = bingos;
  }, [lastBingoDelta, bingos, entries, clearBingoDelta]);

  useEffect(() => { prevBingos.current = bingos; }, [bingos]);

  const handleTap = async (id: string) => {
    if (id === FREE_SQUARE_ID) return;
    try { await onToggle(id); }
    catch (e: any) { toast.error(e?.message || 'Could not save.'); }
  };

  // Which grid indices belong to a completed line (for green-glow highlight)
  const winningIndices = new Set<number>();
  if (completedLines.size > 0) {
    for (let r = 0; r < 5; r++) if (completedLines.has(`row-${r}`)) for (let c = 0; c < 5; c++) winningIndices.add(r * 5 + c);
    for (let c = 0; c < 5; c++) if (completedLines.has(`col-${c}`)) for (let r = 0; r < 5; r++) winningIndices.add(r * 5 + c);
    if (completedLines.has('diag-0')) [0, 6, 12, 18, 24].forEach(i => winningIndices.add(i));
    if (completedLines.has('diag-1')) [4, 8, 12, 16, 20].forEach(i => winningIndices.add(i));
  }

  const nextNudge = bingos === 0
    ? 'One full line = free late cancel.'
    : `One more line = ${entries + 1} raffle ${entries + 1 === 1 ? 'entry' : 'entries'}.`;

  return (
    <div className="min-h-screen px-3 sm:px-4 py-5" style={{ background: BRAND_INK, color: BRAND_CREAM, fontFamily: FONT }}>
      <div className="max-w-3xl mx-auto">
        {/* Header with real OTF logo */}
        <div className="flex items-center justify-between mb-4">
          <img src={otfLogo} alt="Orangetheory Fitness" className="h-7 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
          <p className="text-[10px] uppercase tracking-[0.4em] font-bold" style={{ color: BRAND_GREY }}>Tuscaloosa</p>
        </div>

        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-[0.4em] font-bold mb-1" style={{ color: BRAND_ORANGE }}>Hi {player.first_name}</p>
          <h1 className="text-5xl sm:text-6xl font-black leading-[0.9] uppercase tracking-tight" style={{ color: BRAND_CREAM }}>
            Summer<br/>Bingo
          </h1>
        </div>

        {/* SCORE PANEL — scoreboard hero */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <Scoreboard
            label="Bingos"
            value={bingos}
            outOf={TOTAL_LINES}
            pulsing={pulseBingos}
            primary
          />
          <Scoreboard
            label="Raffle entries"
            value={entries}
            pulsing={pulseEntries}
          />
        </div>

        <div className="mb-3 px-3 py-2.5 text-center text-[13px] font-bold uppercase tracking-wide border-2" style={{ background: 'transparent', color: BRAND_CREAM, borderColor: BRAND_ORANGE }}>
          {hasLateCancel ? (
            <>Free late cancel <span style={{ color: BRAND_ORANGE }}>unlocked</span> · {nextNudge}</>
          ) : (
            <>{nextNudge}</>
          )}
        </div>

        {isBlackout && (
          <div className="mb-3 px-3 py-3 text-center font-black uppercase tracking-wide" style={{ background: BRAND_ORANGE, color: BRAND_INK }}>
            <p className="text-[10px] tracking-[0.3em] mb-1">Blackout</p>
            <p className="text-lg leading-none">Full card. Max entries locked in.</p>
          </div>
        )}

        <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
          {BINGO_TASKS.map((task, idx) => {
            const isFree = task.id === FREE_SQUARE_ID;
            const isMarked = marked.has(task.id);
            const done = isMarked || isFree;
            const winning = winningIndices.has(idx);
            // Visual hierarchy:
            //   - Free square: charcoal with orange mark
            //   - Marked (hit): orange STRIKE with ink text
            //   - Unmarked: bone with ink text
            //   - Winning line: thick orange outline + glow
            const bg = isFree ? BRAND_INK : (isMarked ? BRAND_ORANGE : BRAND_CREAM);
            const fg = isFree ? BRAND_ORANGE : BRAND_INK;
            const borderColor = winning ? BRAND_ORANGE : (isFree ? BRAND_ORANGE : BRAND_INK);
            return (
              <button
                key={task.id}
                onClick={() => handleTap(task.id)}
                className={`aspect-square p-1 sm:p-2 text-[9px] sm:text-xs font-black uppercase leading-tight flex items-center justify-center text-center transition-all active:scale-95 ${winning ? 'animate-pulse' : ''}`}
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
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-3 mt-5">
          <button
            onClick={async () => {
              const url = `https://otf-tuscaloosa.lovable.app/bingo/s/${player.share_slug}`;
              try { await navigator.clipboard.writeText(url); toast.success('Share link copied — text it to a friend!'); }
              catch { toast.error('Could not copy. Long-press to copy: ' + url); }
            }}
            className="px-6 py-3 text-xs font-black uppercase tracking-[0.2em] border-2"
            style={{ background: 'transparent', color: BRAND_CREAM, borderColor: BRAND_CREAM, fontFamily: FONT }}
          >
            Share my progress
          </button>
          <p className="text-center text-[11px] uppercase tracking-wider" style={{ color: BRAND_GREY }}>
            {progress} of {TOTAL_REQUIRED} squares marked · Tap a square when you finish it
          </p>
        </div>
      </div>

      {celebration && (
        <CelebrationOverlay
          kind={celebration.kind}
          bingos={celebration.bingos}
          entries={celebration.entries}
          onClose={() => setCelebration(null)}
        />
      )}
    </div>
  );
}

function Scoreboard({ label, value, outOf, pulsing, primary }: { label: string; value: number; outOf?: number; pulsing: boolean; primary?: boolean }) {
  // Athletic scoreboard tile: bone surface, ink label, orange (or ink) strike numeral
  const numColor = primary ? BRAND_ORANGE : BRAND_INK;
  return (
    <div className="px-3 py-3 sm:py-4 text-center relative overflow-hidden" style={{ background: BRAND_CREAM, border: `2px solid ${BRAND_INK}`, fontFamily: FONT }}>
      <p className="text-[10px] uppercase tracking-[0.3em] font-black" style={{ color: BRAND_INK }}>{label}</p>
      <p
        className={`text-5xl sm:text-6xl font-black tabular-nums leading-none mt-1.5 transition-transform ${pulsing ? 'scale-125' : 'scale-100'}`}
        style={{ color: numColor, transitionDuration: '300ms', letterSpacing: '-0.04em' }}
      >
        {value}
        {typeof outOf === 'number' && (
          <span className="text-base font-black opacity-40 ml-1" style={{ color: BRAND_INK }}>/{outOf}</span>
        )}
      </p>
    </div>
  );
}

function CelebrationOverlay({
  kind, bingos, entries, onClose,
}: { kind: 'first' | 'more'; bingos: number; entries: number; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-fade-in"
      style={{ background: 'rgba(10,10,10,0.55)' }}
      onClick={onClose}
    >
      <div
        className="p-6 sm:p-8 max-w-sm w-full text-center animate-scale-in"
        style={{ background: BRAND_CREAM, border: `3px solid ${BRAND_INK}`, fontFamily: FONT }}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[11px] uppercase tracking-[0.4em] font-black mb-2" style={{ color: BRAND_ORANGE }}>
          {kind === 'first' ? 'First bingo' : `Bingo #${bingos}`}
        </p>
        <p className="text-6xl sm:text-7xl font-black leading-none mb-3 uppercase tracking-tight" style={{ color: BRAND_INK }}>
          BINGO!
        </p>
        {kind === 'first' ? (
          <p className="text-base font-semibold" style={{ color: BRAND_INK }}>
            You earned a <span style={{ color: BRAND_ORANGE }}>free late cancel</span>.
            <br />
            <span className="text-sm font-normal opacity-80">Text the studio when you need to use it.</span>
          </p>
        ) : (
          <p className="text-base font-semibold" style={{ color: BRAND_INK }}>
            That's <span style={{ color: BRAND_ORANGE }}>{entries}</span> raffle {entries === 1 ? 'entry' : 'entries'} for OTF gear.
          </p>
        )}
        <button
          className="mt-5 rounded-xl px-5 py-3 text-sm font-black uppercase tracking-wide"
          style={{ background: BRAND_ORANGE, color: 'white' }}
          onClick={onClose}
        >
          Keep playing
        </button>
      </div>
    </div>
  );
}
