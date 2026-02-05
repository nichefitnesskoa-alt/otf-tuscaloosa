import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Flame, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface RaceParticipant {
  name: string;
  introsRun: number;
  sales: number;
  isCurrentUser: boolean;
}

interface TodaysRaceProps {
  participants: RaceParticipant[];
  currentUserName: string;
  className?: string;
}

export function TodaysRace({ participants, currentUserName, className }: TodaysRaceProps) {
  // Sort by intros run, then by sales
  const sorted = [...participants]
    .filter(p => p.introsRun > 0 || p.sales > 0)
    .sort((a, b) => {
      if (b.introsRun !== a.introsRun) return b.introsRun - a.introsRun;
      return b.sales - a.sales;
    });

  const maxIntros = Math.max(...sorted.map(p => p.introsRun), 1);
  const leader = sorted[0];
  const currentUserEntry = sorted.find(p => p.name === currentUserName);
  const currentUserRank = currentUserEntry ? sorted.indexOf(currentUserEntry) + 1 : null;

  if (sorted.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Flame className="w-4 h-4 text-primary" />
            Today's Race
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No activity yet today. Be the first!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Flame className="w-4 h-4 text-primary animate-pulse" />
          Today's Race
          {leader && (
            <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
              <Trophy className="w-3 h-3 text-warning" />
              {leader.name}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {sorted.slice(0, 5).map((participant, index) => (
          <div
            key={participant.name}
            className={cn(
              'relative',
              participant.name === currentUserName && 'bg-primary/5 -mx-3 px-3 py-1 rounded'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'w-5 text-xs font-medium',
                  index === 0 ? 'text-warning' : 'text-muted-foreground'
                )}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                </span>
                <span className={cn(
                  'text-sm font-medium truncate max-w-[100px]',
                  participant.name === currentUserName && 'text-primary'
                )}>
                  {participant.name === currentUserName ? 'You' : participant.name}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {participant.introsRun}
                </span>
                {participant.sales > 0 && (
                  <span className="text-success font-medium">
                    ${participant.sales * 10}
                  </span>
                )}
              </div>
            </div>
            <Progress 
              value={(participant.introsRun / maxIntros) * 100} 
              className="h-1.5"
            />
          </div>
        ))}

        {currentUserRank && currentUserRank > 5 && (
          <div className="pt-2 border-t text-center text-sm text-muted-foreground">
            You're #{currentUserRank} of {sorted.length} today
          </div>
        )}
      </CardContent>
    </Card>
  );
}
