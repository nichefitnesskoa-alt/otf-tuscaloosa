import { cn } from '@/lib/utils';

interface PrepScoreDotProps {
  hasPhone: boolean;
  qCompleted: boolean;
  confirmationSent: boolean;
  isSecondIntro: boolean;
}

export function PrepScoreDot({ hasPhone, qCompleted, confirmationSent, isSecondIntro }: PrepScoreDotProps) {
  const qReady = isSecondIntro || qCompleted;
  const score = (hasPhone ? 1 : 0) + (qReady ? 1 : 0) + (confirmationSent ? 1 : 0);

  const color = score >= 3
    ? 'bg-emerald-500'
    : score >= 2
    ? 'bg-amber-400'
    : 'bg-destructive';

  const title = `Prep: ${score}/3 — ${hasPhone ? '✓' : '✗'} Phone, ${qReady ? '✓' : '✗'} Q, ${confirmationSent ? '✓' : '✗'} Confirmed`;

  return (
    <span
      className={cn('inline-block w-2 h-2 rounded-full shrink-0', color)}
      title={title}
    />
  );
}
