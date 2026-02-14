import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ConversionSignalProps {
  isSecondIntro: boolean;
  qCompleted: boolean;
  hasPhone: boolean;
  leadSource: string;
  isReferral?: boolean;
}

export function ConversionSignal({
  isSecondIntro,
  qCompleted,
  hasPhone,
  leadSource,
  isReferral,
}: ConversionSignalProps) {
  // Score factors
  let score = 0;
  if (isSecondIntro) score += 3; // 2nd intros close high
  if (qCompleted) score += 2;    // Engaged prospects
  if (hasPhone) score += 1;
  if (isReferral || leadSource.toLowerCase().includes('referral') || leadSource.toLowerCase().includes('friend')) {
    score += 2; // Referrals close high
  }
  if (leadSource.toLowerCase().includes('walk')) score += 1;

  let level: 'high' | 'medium' | 'low';
  let color: string;

  if (score >= 5) {
    level = 'high';
    color = 'bg-emerald-100 text-emerald-700 border-emerald-200';
  } else if (score >= 3) {
    level = 'medium';
    color = 'bg-amber-100 text-amber-700 border-amber-200';
  } else {
    level = 'low';
    color = 'bg-muted text-muted-foreground border-border';
  }

  return (
    <Badge variant="outline" className={cn('text-[9px] px-1 py-0 h-3.5', color)}>
      {level === 'high' ? '🟢' : level === 'medium' ? '🟡' : '⚪'} {level}
    </Badge>
  );
}
