import { Badge } from '@/components/ui/badge';
import { Flame } from 'lucide-react';
import {
  cadenceStreakWeeks,
  isSelfEvalEveryWeekThisMonth,
} from '@/lib/scorecard/trends';
import type { FvScorecard } from '@/hooks/useScorecards';

export function CoachStreakBadges({ coach, cards }: { coach: string; cards: FvScorecard[] }) {
  const streak = cadenceStreakWeeks(coach, cards);
  const everyWeek = isSelfEvalEveryWeekThisMonth(coach, cards);
  if (streak < 2 && !everyWeek) return null;
  return (
    <span className="inline-flex flex-wrap gap-1 items-center">
      {streak >= 2 && (
        <Badge
          variant="outline"
          className="text-[10px] gap-1 border-primary/40 text-primary px-1.5 py-0"
          title={`${streak} consecutive weeks meeting cadence`}
        >
          <Flame className="w-3 h-3" />
          {streak} wk streak
        </Badge>
      )}
      {everyWeek && (
        <Badge
          variant="outline"
          className="text-[10px] border-success/40 text-success px-1.5 py-0"
          title="Self-evaluated every week this month"
        >
          Self every week
        </Badge>
      )}
    </span>
  );
}
