import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, TrendingUp, DollarSign, UserCheck } from 'lucide-react';

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
}

function LeaderboardCard({
  title,
  icon: Icon,
  entries,
  formatValue,
}: {
  title: string;
  icon: React.ElementType;
  entries: LeaderEntry[];
  formatValue: (value: number, subValue?: string) => string;
}) {
  const medals = ['🥇', '🥈', '🥉'];

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
        {entries.slice(0, 3).map((entry, idx) => (
          <div key={entry.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5">
              <span>{medals[idx]}</span>
              <span className="font-medium truncate max-w-[80px]">{entry.name}</span>
            </span>
            <span className="font-bold text-primary">{formatValue(entry.value, entry.subValue)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function Leaderboards({ topBookers, topCommission, topClosing, topShowRate }: LeaderboardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <LeaderboardCard
        title="Top Bookers"
        icon={Trophy}
        entries={topBookers}
        formatValue={(v) => `${v}`}
      />
      <LeaderboardCard
        title="Top Commission"
        icon={DollarSign}
        entries={topCommission}
        formatValue={(v) => `$${v.toFixed(0)}`}
      />
      <LeaderboardCard
        title="Best Closing %"
        icon={TrendingUp}
        entries={topClosing}
        formatValue={(v, sub) => `${v.toFixed(0)}%${sub ? ` (${sub})` : ''}`}
      />
      <LeaderboardCard
        title="Best Show Rate"
        icon={UserCheck}
        entries={topShowRate}
        formatValue={(v, sub) => `${v.toFixed(0)}%${sub ? ` (${sub})` : ''}`}
      />
    </div>
  );
}
