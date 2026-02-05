import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, Trophy, Clock, Users } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  metric: 'goalWhyRate' | 'showRate' | 'closingRate' | 'introsRun' | 'bookings';
  target: number;
  currentValue: number;
  leader?: { name: string; value: number };
  endsAt: Date;
  reward?: string;
}

interface WeeklyChallengesProps {
  challenges: Challenge[];
  currentUserName: string;
  className?: string;
}

export function WeeklyChallenges({ challenges, currentUserName, className }: WeeklyChallengesProps) {
  const getTimeRemaining = (endsAt: Date) => {
    const now = new Date();
    const diff = endsAt.getTime() - now.getTime();
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  };

  const getMetricIcon = (metric: Challenge['metric']) => {
    switch (metric) {
      case 'goalWhyRate':
        return Target;
      case 'showRate':
      case 'closingRate':
        return Trophy;
      case 'introsRun':
      case 'bookings':
        return Users;
      default:
        return Target;
    }
  };

  if (challenges.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="w-4 h-4 text-warning" />
          Weekly Challenges
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {challenges.map(challenge => {
          const Icon = getMetricIcon(challenge.metric);
          const progress = Math.min((challenge.currentValue / challenge.target) * 100, 100);
          const isComplete = challenge.currentValue >= challenge.target;
          const isLeader = challenge.leader?.name === currentUserName;

          return (
            <div
              key={challenge.id}
              className={cn(
                'p-3 rounded-lg border transition-all',
                isComplete ? 'bg-success/10 border-success/30' : 'bg-muted/50 border-border'
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Icon className={cn('w-4 h-4', isComplete ? 'text-success' : 'text-primary')} />
                  <div>
                    <h4 className="text-sm font-medium">{challenge.title}</h4>
                    <p className="text-xs text-muted-foreground">{challenge.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <Clock className="w-3 h-3" />
                  {getTimeRemaining(challenge.endsAt)}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Your progress</span>
                  <span className={cn('font-medium', isComplete && 'text-success')}>
                    {challenge.currentValue.toFixed(0)}%
                    <span className="text-muted-foreground"> / {challenge.target}%</span>
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {challenge.leader && (
                <div className="mt-2 pt-2 border-t flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    <Trophy className="w-3 h-3 inline mr-1 text-warning" />
                    Leader: <span className={cn('font-medium', isLeader && 'text-primary')}>{challenge.leader.name}</span>
                  </span>
                  <span className="font-medium">{challenge.leader.value.toFixed(0)}%</span>
                </div>
              )}

              {challenge.reward && (
                <div className="mt-2 text-xs text-center text-muted-foreground">
                  🎁 Prize: {challenge.reward}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
