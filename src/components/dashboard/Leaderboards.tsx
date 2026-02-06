import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, TrendingUp, UserCheck } from 'lucide-react';
import { MyRankIndicator } from './MyRankIndicator';
import { cn } from '@/lib/utils';

interface LeaderEntry {
  name: string;
  value: number;
  subValue?: string;
}

interface LeaderboardsProps {
  topBookers: LeaderEntry[];
  topCommission: LeaderEntry[];
  topClosing: LeaderEntry[];
  topShowRate: LeaderEntry[];
  currentUserName?: string;
  allParticipants?: { bookers: number; commission: number; closing: number; showRate: number };
}

function LeaderboardCard({
  title,
  icon: Icon,
  entries,
  formatValue,
  currentUserName,
  totalParticipants,
}: {
  title: string;
  icon: React.ElementType;
  entries: LeaderEntry[];
  formatValue: (value: number, subValue?: string) => string;
  currentUserName?: string;
  totalParticipants?: number;
}) {
  const medals = ['🥇', '🥈', '🥉'];
  
  // Find current user's rank
  const userRank = currentUserName 
    ? entries.findIndex(e => e.name === currentUserName) + 1 
    : null;
  const userEntry = currentUserName ? entries.find(e => e.name === currentUserName) : null;

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">No data yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-1">
        {entries.slice(0, 3).map((entry, idx) => {
          const isCurrentUser = entry.name === currentUserName;
          return (
            <div 
              key={entry.name} 
              className={cn(
                'flex items-center justify-between text-sm',
                isCurrentUser && 'bg-primary/10 -mx-2 px-2 py-0.5 rounded'
              )}
            >
              <span className="flex items-center gap-1.5">
                <span>{medals[idx]}</span>
                <span className={cn(
                  'font-medium truncate max-w-[80px]',
                  isCurrentUser && 'text-primary'
                )}>
                  {isCurrentUser ? 'You' : entry.name}
                </span>
              </span>
              <span className="font-bold text-primary">{formatValue(entry.value, entry.subValue)}</span>
            </div>
          );
        })}
        
        {/* Show user's rank if not in top 3 */}
        {currentUserName && userRank && userRank > 3 && userEntry && (
          <div className="pt-2 mt-2 border-t">
            <div className="flex items-center justify-between text-sm bg-primary/5 -mx-2 px-2 py-1 rounded">
              <span className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">#{userRank}</span>
                <span className="font-medium text-primary">You</span>
              </span>
              <span className="font-bold text-primary">{formatValue(userEntry.value, userEntry.subValue)}</span>
            </div>
          </div>
        )}
        
        {/* My Rank indicator */}
        {currentUserName && totalParticipants && (
          <div className="pt-1">
            <MyRankIndicator 
              rank={userRank || null} 
              totalParticipants={totalParticipants}
              className="text-xs"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function Leaderboards({ 
  topBookers, 
  topCommission, 
  topClosing, 
  topShowRate,
  currentUserName,
  allParticipants,
}: LeaderboardsProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <LeaderboardCard
        title="Top Bookers"
        icon={Trophy}
        entries={topBookers.slice(0, 3)}
        formatValue={(v) => `${v}`}
        currentUserName={currentUserName}
        totalParticipants={allParticipants?.bookers}
      />
      <LeaderboardCard
        title="Best Closing %"
        icon={TrendingUp}
        entries={topClosing.slice(0, 3)}
        formatValue={(v, sub) => `${v.toFixed(0)}%${sub ? ` (${sub})` : ''}`}
        currentUserName={currentUserName}
        totalParticipants={allParticipants?.closing}
      />
      <LeaderboardCard
        title="Best Show Rate"
        icon={UserCheck}
        entries={topShowRate.slice(0, 3)}
        formatValue={(v, sub) => `${v.toFixed(0)}%${sub ? ` (${sub})` : ''}`}
        currentUserName={currentUserName}
        totalParticipants={allParticipants?.showRate}
      />
    </div>
  );
}
