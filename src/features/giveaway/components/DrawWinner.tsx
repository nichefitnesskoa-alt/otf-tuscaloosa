import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { drawWinner, DrawEntry } from '../lib/weightedDraw';

export function DrawWinner({ entries }: { entries: DrawEntry[] }) {
  const [count, setCount] = useState<number | null>(null);
  const [winner, setWinner] = useState<DrawEntry | null>(null);

  const start = () => {
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

  return (
    <div className="rounded-xl border border-[#3a3a3c] bg-[#1f1f21] p-6">
      <h2 className="text-2xl font-black mb-2">Draw a Winner</h2>
      <p className="text-sm text-[#F5F2EE]/60 mb-4">Weighted random pick. Higher entries = higher odds.</p>
      <button
        onClick={start}
        disabled={!entries.length || count !== null}
        className="min-h-[56px] px-8 rounded-xl bg-[#E8540A] hover:bg-[#ff6a1f] disabled:bg-[#3a3a3c] text-white font-black text-lg tracking-wider"
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
            <p className="text-lg text-[#F5F2EE]/70 mt-6">Tap anywhere to close</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
