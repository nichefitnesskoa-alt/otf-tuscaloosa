/**
 * TbdCoachAlert — bright red banner shown on any intro card whose
 * coach_name is missing or literal "TBD". Tapping opens the outcome
 * drawer / edit flow so the SA can assign the real coach immediately.
 *
 * Uses the canonical isMissingCoach() helper — never inline-check "TBD".
 */
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isMissingCoach } from '@/lib/intros/coachAttribution';

interface TbdCoachAlertProps {
  coachName?: string | null;
  onFix?: () => void;
  variant?: 'card' | 'inline';
  className?: string;
}

export function TbdCoachAlert({ coachName, onFix, variant = 'card', className }: TbdCoachAlertProps) {
  if (!isMissingCoach(coachName)) return null;

  const isCard = variant === 'card';
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onFix?.(); }}
      className={cn(
        'w-full flex items-center justify-center gap-2 font-bold text-primary-foreground',
        'bg-red-600 hover:bg-red-700 active:bg-red-800 border-2 border-red-700',
        'transition-colors cursor-pointer animate-pulse',
        isCard ? 'px-3 py-2 text-xs rounded-md min-h-[44px]' : 'px-2 py-1 text-[11px] rounded',
        className,
      )}
      aria-label="Coach missing — tap to assign"
    >
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span>⚠️ Coach TBD — assign now</span>
    </button>
  );
}

export { isMissingCoach };
