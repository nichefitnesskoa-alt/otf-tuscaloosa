import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DayScoreProps {
  completedActions: number;
  totalActions: number;
}

export function DayScore({ completedActions, totalActions }: DayScoreProps) {
  if (totalActions === 0) return null;
  
  const pct = Math.round((completedActions / totalActions) * 100);
  const allDone = pct >= 100;

  return (
    <div className={cn(
      'rounded-xl border p-3 space-y-1.5',
      allDone ? 'bg-emerald-50 border-emerald-200' : 'bg-card'
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {allDone ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <Zap className="w-4 h-4 text-primary" />
          )}
          <span className="text-sm font-semibold">
            {allDone ? 'All caught up!' : "Today's Progress"}
          </span>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {completedActions}/{totalActions} actions ({pct}%)
        </span>
      </div>
      <Progress value={pct} className="h-2.5" />
    </div>
  );
}
