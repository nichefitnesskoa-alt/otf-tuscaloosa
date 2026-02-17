import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Flame, Target, CheckCircle2, CalendarPlus, Circle } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { isToday, parseISO, startOfDay } from 'date-fns';
import { getTodayYMD } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

interface ExecutionCardProps {
  touchesTarget?: number;
  followupsTarget?: number;
}

export function ExecutionCard({ touchesTarget = 10, followupsTarget = 10 }: ExecutionCardProps) {
  const { user } = useAuth();
  const { followUpQueue, followupTouches, introsBooked, pendingQueueCount } = useData();

  const stats = useMemo(() => {
    const userName = user?.name;
    if (!userName) return { touchesToday: 0, fuDoneToday: 0, fuDueToday: 0, touchStreak: 0, rebooksToday: 0 };

    const today = getTodayYMD();

    const touchesToday = followupTouches.filter(
      t => t.created_by === userName && isToday(parseISO(t.created_at))
    ).length;

    const fuDoneToday = followUpQueue.filter(
      f => f.status === 'sent' && f.sent_at && isToday(parseISO(f.sent_at))
    ).length;

    const fuDueToday = followUpQueue.filter(
      f => f.status === 'pending' && f.scheduled_date <= today
    ).length;

    // Touch streak
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
      if (touchesByDay.has(key)) touchStreak++;
      else break;
    }

    const rebooksToday = introsBooked.filter(b => {
      const rebookedAt = (b as any).rebooked_at;
      return rebookedAt && isToday(parseISO(rebookedAt));
    }).length;

    return { touchesToday, fuDoneToday, fuDueToday, touchStreak, rebooksToday };
  }, [user?.name, followupTouches, followUpQueue, introsBooked]);

  const touchesDone = stats.touchesToday >= touchesTarget;
  const fuDone = stats.fuDueToday === 0 || stats.fuDoneToday >= stats.fuDueToday;
  const rebooksDone = stats.rebooksToday > 0;
  const allDone = touchesDone && fuDone;

  const touchPct = Math.min(100, Math.round((stats.touchesToday / touchesTarget) * 100));
  const fuPct = stats.fuDueToday === 0 ? 100 : Math.min(100, Math.round((stats.fuDoneToday / Math.max(stats.fuDueToday, 1)) * 100));

  return (
    <Card className={cn("border-primary/20", allDone && "border-emerald-300 bg-emerald-50/30")}>
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

        {/* Finish Line Checklist */}
        <div className="space-y-1.5">
          <FinishLineItem
            done={touchesDone}
            label="Touches today"
            value={`${stats.touchesToday}/${touchesTarget}`}
          />
          <Progress value={touchPct} className="h-1.5" />

          <FinishLineItem
            done={fuDone}
            label="Follow-ups cleared"
            value={stats.fuDueToday === 0 ? 'None due' : `${stats.fuDoneToday}/${stats.fuDueToday}`}
          />
          <Progress value={fuPct} className="h-1.5" />

          <FinishLineItem
            done={rebooksDone}
            label="Rebooks created"
            value={stats.rebooksToday > 0 ? `${stats.rebooksToday}` : '0'}
          />
        </div>

        {pendingQueueCount > 0 && (
          <div className="text-[11px] text-muted-foreground">
            {pendingQueueCount} pending sync
          </div>
        )}

        {allDone && (
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
            <CheckCircle2 className="w-3 h-3" /> All targets hit!
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FinishLineItem({ done, label, value }: { done: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      {done ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
      ) : (
        <Circle className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
      )}
      <span className={cn("flex-1", done ? "text-emerald-700" : "text-muted-foreground")}>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
