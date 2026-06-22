import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { drawWinner, DrawEntry } from '../lib/weightedDraw';
import { type GiveawayPartner, getPartnerPrizeLabel } from '../hooks/useGiveawayPartners';
import {
  getDrawRuleStatement,
  isPerPrize,
  removesWinners,
  type WinnerStructure,
} from '../lib/winnerStructure';
import { getParticipantStudioName } from '@/lib/studioNames';

interface Prize {
  id: string;
  label: string;
  sublabel?: string;
}

interface DrawnState {
  winner: DrawEntry;
  removed: boolean;
}

export function DrawWinner({
  entries,
  partners,
  winnerStructure,
  studioSlug,
}: {
  entries: DrawEntry[];
  partners: GiveawayPartner[];
  winnerStructure: WinnerStructure;
  studioSlug: string;
}) {
  const prizes = useMemo<Prize[]>(() => {
    const list: Prize[] = [
      { id: 'membership', label: `${getParticipantStudioName(studioSlug)} Membership` },
    ];
    for (const p of partners) {
      const desc = (p.prize_description || '').trim();
      if (!desc) continue;
      const count = Math.max(1, Math.min(10, p.prize_count ?? 1));
      for (let i = 0; i < count; i++) {
        list.push({
          id: count > 1 ? `${p.id}__${i + 1}` : p.id,
          label: desc,
          sublabel: count > 1 ? `${p.partner_name} (winner ${i + 1} of ${count})` : p.partner_name,
        });
      }
    }
    return list;
  }, [partners, studioSlug]);

  const perPrize = isPerPrize(winnerStructure);

  // ===== single-mode state (legacy behavior) =====
  const [count, setCount] = useState<number | null>(null);
  const [winner, setWinner] = useState<DrawEntry | null>(null);

  const startSingle = () => {
    if (!entries.length) return;
    setWinner(null);
    setCount(3);
    const t1 = setTimeout(() => setCount(2), 800);
    const t2 = setTimeout(() => setCount(1), 1600);
    const t3 = setTimeout(() => {
      const w = drawWinner(entries);
      setCount(null);
      setWinner(w);
      if (w) {
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.4 }, colors: ['#E8540A', '#F5F2EE', '#ffffff'] });
        setTimeout(() => confetti({ particleCount: 150, spread: 120, origin: { y: 0.5 } }), 400);
      }
    }, 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  };

  // ===== per-prize state =====
  const [drawn, setDrawn] = useState<Record<string, DrawnState>>({});
  const [drawingPrize, setDrawingPrize] = useState<string | null>(null);
  const [countdownNum, setCountdownNum] = useState<number | null>(null);

  const removedIds = useMemo(() => {
    if (!removesWinners(winnerStructure)) return new Set<string>();
    return new Set(Object.values(drawn).map(d => d.winner.id));
  }, [drawn, winnerStructure]);

  const drawForPrize = (prizeId: string) => {
    if (drawingPrize || drawn[prizeId]) return;
    setDrawingPrize(prizeId);
    setCountdownNum(3);
    const t1 = setTimeout(() => setCountdownNum(2), 800);
    const t2 = setTimeout(() => setCountdownNum(1), 1600);
    const t3 = setTimeout(() => {
      const excl = removesWinners(winnerStructure) ? removedIds : undefined;
      const w = drawWinner(entries, excl);
      setCountdownNum(null);
      setDrawingPrize(null);
      if (w) {
        setDrawn(prev => ({ ...prev, [prizeId]: { winner: w, removed: removesWinners(winnerStructure) } }));
        confetti({ particleCount: 160, spread: 90, origin: { y: 0.4 }, colors: ['#E8540A', '#F5F2EE', '#ffffff'] });
      }
    }, 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  };

  if (!perPrize) {
    // ===== SINGLE GRAND PRIZE MODE =====
    return (
      <div className="rounded-xl border border-[#3a3a3c] bg-[#1f1f21] p-6">
        <h2 className="text-2xl font-black mb-2">Draw a Winner</h2>
        <p className="text-sm text-[#F5F2EE]/60 mb-1">Weighted random pick. Higher entries = higher odds.</p>
        <p className="text-xs text-[#E8540A] mb-4 italic">{getDrawRuleStatement(winnerStructure)}</p>
        <button
          onClick={startSingle}
          disabled={!entries.length || count !== null}
          className="min-h-[56px] px-8 rounded-xl bg-[#E8540A] hover:bg-[#ff6a1f] disabled:bg-[#3a3a3c] text-white font-black text-lg tracking-wider cursor-pointer"
        >
          DRAW WINNER
        </button>

        <AnimatePresence>
          {count !== null && (
            <motion.div
              className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.span
                key={count}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 2, opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="text-[12rem] font-black text-[#E8540A]"
              >
                {count}
              </motion.span>
            </motion.div>
          )}
          {winner && (
            <motion.div
              className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setWinner(null)}
            >
              <p className="text-sm uppercase tracking-[0.3em] text-[#E8540A] font-bold mb-4">🎉 Winner</p>
              <motion.h1
                initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
                className="text-6xl sm:text-9xl font-black text-[#F5F2EE] text-center leading-none"
              >
                {winner.name.toUpperCase()}
              </motion.h1>
              <div className="mt-6 max-w-md text-center">
                <p className="text-xs uppercase tracking-[0.25em] text-[#E8540A] font-bold mb-2">Wins all prizes</p>
                <ul className="text-[#F5F2EE]/80 text-sm space-y-1">
                  {prizes.map(p => (
                    <li key={p.id}>• {p.label}{p.sublabel ? ` (${p.sublabel})` : ''}</li>
                  ))}
                </ul>
              </div>
              <p className="text-sm text-[#F5F2EE]/50 mt-6">Tap anywhere to close</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ===== PER-PRIZE MODE =====
  const allAwarded = prizes.length > 0 && prizes.every(p => drawn[p.id]);

  return (
    <div className="rounded-xl border border-[#3a3a3c] bg-[#1f1f21] p-6">
      <h2 className="text-2xl font-black mb-2">Draw Winners</h2>
      <p className="text-sm text-[#F5F2EE]/60 mb-1">Weighted random pick per prize.</p>
      <p className="text-xs text-[#E8540A] mb-5 italic">{getDrawRuleStatement(winnerStructure)}</p>

      <ul className="space-y-2.5">
        {prizes.map(prize => {
          const drawnRow = drawn[prize.id];
          const isDrawing = drawingPrize === prize.id;
          return (
            <li key={prize.id} className="rounded-lg border border-[#3a3a3c] bg-[#2a2a2c] p-3 sm:p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[180px]">
                <p className="font-bold text-[#F5F2EE]">{prize.label}</p>
                {prize.sublabel && (
                  <p className="text-xs text-[#F5F2EE]/50">{prize.sublabel}</p>
                )}
              </div>
              <div className="flex-1 min-w-[160px]">
                {drawnRow ? (
                  <div>
                    <p className="text-emerald-400 font-bold text-sm">✓ {drawnRow.winner.name}</p>
                    {drawnRow.removed && (
                      <p className="text-[11px] text-[#F5F2EE]/50 mt-0.5">Removed from remaining draws</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-[#F5F2EE]/50">Not yet drawn</p>
                )}
              </div>
              <button
                onClick={() => drawForPrize(prize.id)}
                disabled={!!drawnRow || !!drawingPrize || !entries.length}
                className="min-h-[44px] px-5 rounded-lg bg-[#E8540A] hover:bg-[#ff6a1f] disabled:bg-[#3a3a3c] disabled:text-[#F5F2EE]/40 text-white font-bold cursor-pointer"
              >
                {isDrawing ? 'Drawing…' : drawnRow ? 'Drawn' : 'DRAW'}
              </button>
            </li>
          );
        })}
      </ul>

      {allAwarded && (
        <div className="mt-6 rounded-lg border-2 border-emerald-500/40 bg-emerald-500/5 p-4">
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-400 font-black mb-2">All prizes awarded</p>
          <ul className="space-y-1 text-sm text-[#F5F2EE]">
            {prizes.map(p => (
              <li key={p.id}><span className="font-bold">{p.label}</span> → {drawn[p.id].winner.name}</li>
            ))}
          </ul>
        </div>
      )}

      <AnimatePresence>
        {countdownNum !== null && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.span
              key={countdownNum}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="text-[12rem] font-black text-[#E8540A]"
            >
              {countdownNum}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
