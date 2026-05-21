import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function LiveEntryCounter({ entries, max }: { entries: number; max: number }) {
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

  const safeMax = Math.max(max, 1);
  const pct = Math.min(100, (entries / safeMax) * 100);

  return (
    <div className="rounded-2xl border-2 border-[#E8540A]/40 bg-gradient-to-b from-[#E8540A]/10 to-transparent p-6 text-center">
      <p className="font-display text-[11px] md:text-[13px] uppercase tracking-[0.25em] text-[#F5F2EE]/70 font-bold">Your Entries</p>
      <motion.div
        key={entries}
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 0.4 }}
        className="font-display font-black text-[#E8540A] leading-none my-2 tabular-nums"
        style={{ fontSize: 'clamp(72px, 10vw, 96px)' }}
      >
        {displayed}
      </motion.div>
      <p className="font-body text-sm text-[#F5F2EE]/70 mb-3">of {max} possible</p>
      <div className="h-2 md:h-2 bg-[#2a2a2c] rounded-full overflow-hidden">
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
