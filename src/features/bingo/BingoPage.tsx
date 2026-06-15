import { useState } from 'react';
import confetti from 'canvas-confetti';
import { BINGO_TASKS, FREE_SQUARE_ID, REQUIRED_TASK_IDS, TOTAL_REQUIRED } from './bingoTasks';
import { useBingoPlayer } from './useBingoPlayer';
import { toast } from 'sonner';

const BRAND_ORANGE = '#FF6F0D';
const BRAND_INK = '#0A0A0A';
const BRAND_CREAM = '#FDF7EA';

export default function BingoPage() {
  const { player, loading, startOrResume, toggleSquare } = useBingoPlayer();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BRAND_CREAM, color: BRAND_INK }}>
        <p className="text-sm opacity-60">Loading…</p>
      </div>
    );
  }

  if (!player) return <EntryGate onSubmit={startOrResume} />;
  return <BingoCard player={player} onToggle={toggleSquare} />;
}

function EntryGate({ onSubmit }: { onSubmit: (i: { first_name: string; last_name: string; phone: string; email: string }) => Promise<any> }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '' });
  const [submitting, setSubmitting] = useState(false);

  const handle = async (e: React.FormEvent) => {
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

  const inputCls = 'w-full rounded-xl border-2 px-4 py-3 text-base bg-white focus:outline-none focus:ring-2';
  return (
    <div className="min-h-screen px-4 py-8 flex items-center justify-center" style={{ background: BRAND_CREAM, color: BRAND_INK }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-[0.3em] font-bold mb-2" style={{ color: BRAND_ORANGE }}>OTF Tuscaloosa</p>
          <h1 className="text-5xl font-black leading-none mb-3">Summer Bingo</h1>
          <p className="text-base opacity-80">Stay moving, stay connected, win OTF gear.</p>
        </div>
        <form onSubmit={handle} className="rounded-2xl p-5 space-y-3 border-2" style={{ borderColor: BRAND_INK, background: 'white' }}>
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
      </div>
    </div>
  );
}

function BingoCard({ player, onToggle }: { player: ReturnType<typeof useBingoPlayer>['player']; onToggle: (id: string) => Promise<void> }) {
  if (!player) return null;
  const marked = new Set(player.marked_squares);
  const progress = REQUIRED_TASK_IDS.filter(id => marked.has(id)).length;
  const isBlackout = !!player.blackout_completed_at;

  const handleTap = async (id: string) => {
    if (id === FREE_SQUARE_ID) return;
    const wasBlackout = isBlackout;
    try {
      await onToggle(id);
      const willBeBlackout = REQUIRED_TASK_IDS.every(t =>
        t === id ? !marked.has(t) : marked.has(t)
      );
      if (!wasBlackout && willBeBlackout) {
        confetti({ particleCount: 200, spread: 90, origin: { y: 0.5 }, colors: [BRAND_ORANGE, BRAND_INK, BRAND_CREAM] });
      }
    } catch (e: any) { toast.error(e?.message || 'Could not save.'); }
  };

  return (
    <div className="min-h-screen px-4 py-6" style={{ background: BRAND_ORANGE, color: BRAND_INK }}>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-4" style={{ color: 'white' }}>
          <p className="text-xs uppercase tracking-[0.3em] font-bold mb-1">Hi {player.first_name}</p>
          <h1 className="text-4xl sm:text-5xl font-black leading-none">Summer Bingo</h1>
          <p className="mt-2 text-sm">
            <span className="font-bold tabular-nums">{progress}</span> of {TOTAL_REQUIRED} done
          </p>
        </div>

        {isBlackout && (
          <div className="rounded-2xl border-4 p-4 mb-4 text-center font-black" style={{ borderColor: BRAND_INK, background: BRAND_CREAM }}>
            <p className="text-xs uppercase tracking-[0.25em] mb-1" style={{ color: BRAND_ORANGE }}>Blackout!</p>
            <p className="text-xl">You're entered to win OTF gear.</p>
          </div>
        )}

        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {BINGO_TASKS.map((task) => {
            const isFree = task.id === FREE_SQUARE_ID;
            const done = marked.has(task.id) || isFree;
            return (
              <button
                key={task.id}
                onClick={() => handleTap(task.id)}
                className="aspect-square rounded-lg sm:rounded-xl p-1 sm:p-2 text-[9px] sm:text-xs font-bold leading-tight flex items-center justify-center text-center transition-all active:scale-95"
                style={{
                  background: isFree ? BRAND_INK : (done ? BRAND_INK : 'white'),
                  color: isFree ? BRAND_ORANGE : (done ? BRAND_ORANGE : BRAND_INK),
                  border: `2px solid ${BRAND_INK}`,
                }}
              >
                <span className={isFree ? 'text-base sm:text-2xl font-black' : ''}>{task.label}</span>
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'white' }}>
          Tap a square when you finish it. Blackout the whole card to enter the raffle.
        </p>
      </div>
    </div>
  );
}
