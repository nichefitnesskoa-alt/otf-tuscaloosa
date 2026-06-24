import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { ReactNode } from 'react';

interface Props {
  number: number;
  title: string;
  description: string;
  unlocked: boolean;
  children: ReactNode;
  badge?: 'required' | 'bonus';
}

export function AchievementCard({ number, title, description, unlocked, children, badge }: Props) {
  const isRequired = badge === 'required';
  return (
    <motion.div
      initial={false}
      animate={{
        borderColor: unlocked ? '#E8540A' : isRequired ? '#E8540A' : '#3a3a3c',
        backgroundColor: unlocked
          ? 'rgba(232,84,10,0.08)'
          : isRequired ? 'rgba(232,84,10,0.04)' : '#1f1f21',
      }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border-2 p-4 sm:p-5"
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center font-display font-black text-base transition-colors ${
            unlocked ? 'bg-[#E8540A] text-white' : 'bg-[#2a2a2c] text-[#E8540A]'
          }`}
        >
          {unlocked ? <Check className="h-5 w-5" /> : number}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h3 className="font-display font-bold text-[#F5F2EE] text-base md:text-lg leading-tight uppercase" style={{ letterSpacing: '0.01em' }}>{title}</h3>
              {badge === 'required' && (
                <span className="font-display text-[10px] font-black bg-[#E8540A] text-white px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap">
                  Required to win
                </span>
              )}
              {badge === 'bonus' && (
                <span className="font-display text-[10px] font-black border border-[#E8540A] text-[#E8540A] px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap">
                  Bonus entry
                </span>
              )}
            </div>
            <AnimatePresence>
              {unlocked && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="flex-shrink-0 font-display text-[11px] font-black bg-[#E8540A] text-white px-2 py-1 rounded uppercase tracking-wider"
                >
                  +1 Entry
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <p className="font-body text-[12px] md:text-[13px] text-[#8E8E93] mt-1">{description}</p>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </motion.div>
  );
}
