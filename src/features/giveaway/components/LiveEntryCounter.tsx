import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function LiveEntryCounter({ entries, max = 6 }: { entries: number; max?: number }) {
  const [displayed, setDisplayed] = useState(entries);
  useEffect(() => {
    if (displayed === entries) return;
    const start = displayed;
    const startTime = performance.now();
    const dur = 500;
    const step = (now: number) => {
      const p = Math.min(1, (now - startTime) / dur);
      setDisplayed(Math.round(start + (entries - start) * p));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [entries]); // eslint-disable-line

  const pct = Math.min(100, (entries / max) * 100);

  return (
    <div className="rounded-2xl border-2 border-[#E8540A]/40 bg-gradient-to-b from-[#E8540A]/10 to-transparent p-6 text-center">
      <p className="text-xs uppercase tracking-[0.25em] text-[#F5F2EE]/70 font-bold">Your Entries</p>
      <motion.div
        key={entries}
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 0.4 }}
        className="text-7xl sm:text-8xl font-black text-[#E8540A] leading-none my-2 tabular-nums"
      >
        {displayed}
      </motion.div>
      <p className="text-sm text-[#F5F2EE]/70 mb-3">of {max} possible</p>
      <div className="h-3 bg-[#2a2a2c] rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-[#E8540A]"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
