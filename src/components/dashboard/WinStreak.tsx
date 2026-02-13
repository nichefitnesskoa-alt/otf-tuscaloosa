import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, Trophy, Zap, Star } from 'lucide-react';
import { IntroRun, Sale } from '@/context/DataContext';
import { isMembershipSale } from '@/lib/sales-detection';
import { parseLocalDate } from '@/lib/utils';
import { differenceInCalendarDays } from 'date-fns';

interface WinStreakProps {
  userName: string;
  introsRun: IntroRun[];
  sales: Sale[];
}

interface Streak {
  icon: typeof Flame;
  label: string;
  value: number;
  suffix: string;
  color: string;
  bgColor: string;
}

export function WinStreak({ userName, introsRun, sales }: WinStreakProps) {
  const streaks = useMemo(() => {
    const now = new Date();
    const results: Streak[] = [];

    // Filter runs owned by this user, sorted newest first
    const myRuns = introsRun
      .filter(r => (r.intro_owner === userName || r.sa_name === userName) && r.result !== 'No-show')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Consecutive close streak (most recent runs that were sales)
    let closeStreak = 0;
    for (const run of myRuns) {
      if (isMembershipSale(run.result)) closeStreak++;
      else break;
    }
    if (closeStreak >= 2) {
      results.push({
        icon: Flame,
        label: 'Close Streak',
        value: closeStreak,
        suffix: 'in a row',
        color: 'text-destructive',
        bgColor: 'bg-destructive/10',
      });
    }

    // Days with at least one sale (consecutive calendar days)
    const saleDates = new Set<string>();
    for (const run of myRuns) {
      if (isMembershipSale(run.result)) {
        const d = run.run_date || run.created_at?.split('T')[0];
        if (d) saleDates.add(d);
      }
    }
    // Also check sales_outside_intro
    for (const s of sales) {
      if (s.intro_owner === userName) {
        const d = s.date_closed || s.created_at?.split('T')[0];
        if (d) saleDates.add(d);
      }
    }

    const sortedDates = Array.from(saleDates).sort().reverse();
    let dayStreak = 0;
    if (sortedDates.length > 0) {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      // Check if most recent sale day is today or yesterday
      const mostRecent = sortedDates[0];
      const daysDiff = differenceInCalendarDays(today, parseLocalDate(mostRecent));
      if (daysDiff <= 1) {
        dayStreak = 1;
        for (let i = 1; i < sortedDates.length; i++) {
          const diff = differenceInCalendarDays(parseLocalDate(sortedDates[i - 1]), parseLocalDate(sortedDates[i]));
          if (diff <= 1) dayStreak++;
          else break;
        }
      }
    }
    if (dayStreak >= 2) {
      results.push({
        icon: Zap,
        label: 'Sale Days',
        value: dayStreak,
        suffix: 'day streak',
        color: 'text-warning',
        bgColor: 'bg-warning/10',
      });
    }

    // Weekly milestone: 5+ sales this week
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
    weekStart.setHours(0, 0, 0, 0);
    const weeklySales = myRuns.filter(r => {
      if (!isMembershipSale(r.result)) return false;
      const d = r.run_date || r.created_at?.split('T')[0];
      if (!d) return false;
      return parseLocalDate(d) >= weekStart;
    }).length;
    if (weeklySales >= 5) {
      results.push({
        icon: Trophy,
        label: 'Weekly Sales',
        value: weeklySales,
        suffix: 'this week',
        color: 'text-primary',
        bgColor: 'bg-primary/10',
      });
    }

    return results;
  }, [userName, introsRun, sales]);

  if (streaks.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
      {streaks.map(s => (
        <div
          key={s.label}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 ${s.bgColor} flex-shrink-0`}
        >
          <s.icon className={`w-4 h-4 ${s.color}`} />
          <div>
            <span className={`text-sm font-bold ${s.color}`}>{s.value}</span>
            <span className="text-[10px] text-muted-foreground ml-1">{s.suffix}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
