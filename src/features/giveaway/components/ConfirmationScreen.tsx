import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';

export function ConfirmationScreen({ firstName, totalEntries }: { firstName: string; totalEntries: number }) {
  useEffect(() => {
    const fire = () => {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#E8540A', '#F5F2EE', '#ffffff'] });
    };
    fire();
    const t1 = setTimeout(fire, 300);
    const t2 = setTimeout(fire, 700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-lg"
      >
        <p className="text-sm uppercase tracking-[0.3em] text-[#E8540A] font-bold mb-3">You're In</p>
        <h1 className="text-5xl sm:text-7xl font-black text-[#F5F2EE] leading-none mb-6">{firstName.toUpperCase()}!</h1>
        <div className="rounded-2xl border-2 border-[#E8540A] bg-[#E8540A]/10 p-6 mb-6">
          <p className="text-sm text-[#F5F2EE]/70 uppercase tracking-wider">You earned</p>
          <p className="text-6xl font-black text-[#E8540A] tabular-nums my-2">{totalEntries}</p>
          <p className="text-sm text-[#F5F2EE]/70">{totalEntries === 1 ? 'entry' : 'entries'}</p>
        </div>
        <p className="text-lg text-[#F5F2EE]/80">Good luck. We'll be in touch if you win.</p>
      </motion.div>
    </div>
  );
}
