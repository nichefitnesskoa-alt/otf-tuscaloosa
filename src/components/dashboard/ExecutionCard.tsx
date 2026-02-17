import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Flame, Target, CheckCircle2, CalendarPlus } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { isToday, parseISO, differenceInDays, startOfDay } from 'date-fns';
import { getTodayYMD } from '@/lib/dateUtils';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';

interface ExecutionCardProps {
  touchesTarget?: number;
  followupsTarget?: number;
}

export function ExecutionCard({ touchesTarget = 25, followupsTarget = 10 }: ExecutionCardProps) {
  const { user } = useAuth();
  const { followUpQueue, followupTouches, introsBooked, introsRun, sales, shiftRecaps } = useData();

  const stats = useMemo(() => {
    const userName = user?.name;
    if (!userName) return { touchesToday: 0, fuDoneToday: 0, fuDueToday: 0, touchStreak: 0, fuStreak: 0 };

    const today = getTodayYMD();

    // Touches today for this SA
    const touchesToday = followupTouches.filter(
      t => t.created_by === userName && isToday(parseISO(t.created_at))
    ).length;

    // Follow-ups done today (status=sent with sent_at today)
    const fuDoneToday = followUpQueue.filter(
      f => f.status === 'sent' && f.sent_at && isToday(parseISO(f.sent_at))
    ).length;

    // Follow-ups due today
    const fuDueToday = followUpQueue.filter(
      f => f.status === 'pending' && f.scheduled_date <= today
    ).length;

    // Compute touch streak: consecutive days with at least 1 touch
    const touchesByDay = new Map<string, number>();
    for (const t of followupTouches) {
      if (t.created_by !== userName) continue;
      const day = t.created_at.substring(0, 10);
      touchesByDay.set(day, (touchesByDay.get(day) || 0) + 1);
    }
    let touchStreak = 0;
    const now = startOfDay(new Date());
    for (let i = 0; i < 365; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().substring(0, 10);
      if (touchesByDay.has(key)) {
        touchStreak++;
      } else {
        break;
      }
    }

    // Follow-up done streak
    const fuDoneByDay = new Map<string, number>();
    for (const f of followUpQueue) {
      if (f.status !== 'sent' || !f.sent_at || !f.sent_by) continue;
      const day = f.sent_at.substring(0, 10);
      fuDoneByDay.set(day, (fuDoneByDay.get(day) || 0) + 1);
    }
    let fuStreak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().substring(0, 10);
      if (fuDoneByDay.has(key)) {
        fuStreak++;
      } else {
        break;
      }
    }

    return { touchesToday, fuDoneToday, fuDueToday, touchStreak, fuStreak };
  }, [user?.name, followupTouches, followUpQueue]);

  // Saves today from rebook data
  const savesToday = useMemo(() => {
    return introsBooked.filter(b => {
      const rebookedAt = (b as any).rebooked_at;
      return rebookedAt && isToday(parseISO(rebookedAt));
    }).length;
  }, [introsBooked]);

  const touchPct = Math.min(100, Math.round((stats.touchesToday / touchesTarget) * 100));
  const fuPct = stats.fuDueToday === 0 ? 100 : Math.min(100, Math.round((stats.fuDoneToday / Math.max(stats.fuDueToday, 1)) * 100));

  return (
    <Card className="border-primary/20">
      <CardContent className="p-3 space-y-2.5">
        <div className="flex items-center gap-1.5">
          <Target className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold">Execution</span>
          {stats.touchStreak > 1 && (
            <span className="ml-auto flex items-center gap-0.5 text-[11px] text-orange-600 font-medium">
              <Flame className="w-3 h-3" /> {stats.touchStreak}d streak
            </span>
          )}
        </div>

        {/* Touches */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Touches today</span>
            <span className="font-medium">{stats.touchesToday}/{touchesTarget}</span>
          </div>
          <Progress value={touchPct} className="h-1.5" />
        </div>

        {/* Follow-ups done */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Follow-ups done</span>
            <span className="font-medium">{stats.fuDoneToday}/{stats.fuDueToday || '—'}</span>
          </div>
          <Progress value={fuPct} className="h-1.5" />
        </div>

        {savesToday > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-primary font-medium">
            <CalendarPlus className="w-3 h-3" /> {savesToday} rebook{savesToday !== 1 ? 's' : ''} today
          </div>
        )}

        {touchPct >= 100 && fuPct >= 100 && (
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
            <CheckCircle2 className="w-3 h-3" /> All targets hit!
          </div>
        )}
      </CardContent>
    </Card>
  );
}
