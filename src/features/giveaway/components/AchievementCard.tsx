import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { ReactNode } from 'react';

interface Props {
  number: number;
  title: string;
  description: string;
  unlocked: boolean;
  children: ReactNode;
}

export function AchievementCard({ number, title, description, unlocked, children }: Props) {
  return (
    <motion.div
      initial={false}
      animate={{
        borderColor: unlocked ? '#E8540A' : '#3a3a3c',
        backgroundColor: unlocked ? 'rgba(232,84,10,0.08)' : '#1f1f21',
      }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border-2 p-4 sm:p-5"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center font-black text-sm transition-colors ${unlocked ? 'bg-[#E8540A] text-white' : 'bg-[#2a2a2c] text-[#F5F2EE]/70'}`}>
          {unlocked ? <Check className="h-5 w-5" /> : number}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-[#F5F2EE] text-base sm:text-lg leading-tight">{title}</h3>
            <AnimatePresence>
              {unlocked && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="flex-shrink-0 text-[11px] font-black bg-[#E8540A] text-white px-2 py-1 rounded uppercase tracking-wider"
                >
                  +1 Entry
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <p className="text-sm text-[#F5F2EE]/70 mt-1">{description}</p>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </motion.div>
  );
}
