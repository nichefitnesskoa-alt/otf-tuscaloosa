import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MyRankIndicatorProps {
  rank: number | null;
  totalParticipants: number;
  trend?: number; // positive = moved up, negative = moved down
  className?: string;
}

export function MyRankIndicator({
  rank,
  totalParticipants,
  trend = 0,
  className,
}: MyRankIndicatorProps) {
  if (rank === null) {
    return (
      <div className={cn('text-xs text-muted-foreground', className)}>
        Not ranked yet
      </div>
    );
  }

  const rankSuffix = getRankSuffix(rank);
  
  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      <span className="font-medium">
        You: <span className="text-primary font-bold">{rank}{rankSuffix}</span>
        <span className="text-muted-foreground"> of {totalParticipants}</span>
      </span>
      {trend !== 0 && (
        <span className={cn(
          'flex items-center gap-0.5 text-xs font-medium',
          trend > 0 ? 'text-success' : 'text-destructive'
        )}>
          {trend > 0 ? (
            <>
              <TrendingUp className="w-3 h-3" />
              ↑{trend}
            </>
          ) : (
            <>
              <TrendingDown className="w-3 h-3" />
              ↓{Math.abs(trend)}
            </>
          )}
        </span>
      )}
    </div>
  );
}

function getRankSuffix(rank: number): string {
  if (rank % 100 >= 11 && rank % 100 <= 13) return 'th';
  switch (rank % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}
