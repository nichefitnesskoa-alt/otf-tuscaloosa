import { useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { isToday, parseISO } from 'date-fns';

interface DailyProgressProps {
  /** Count of intros with outcomes logged today */
  completedIntros: number;
  /** Total intros scheduled today */
  totalIntros: number;
  /** Follow-ups due today (from parent) */
  followUpsDue: number;
}

export function DailyProgress({
  completedIntros,
  totalIntros,
  followUpsDue,
}: DailyProgressProps) {
  const { user } = useAuth();
  const { followUpQueue, followupTouches } = useData();

  const { touchesToday, followUpsDoneToday } = useMemo(() => {
    const userName = user?.name;
    if (!userName) return { touchesToday: 0, followUpsDoneToday: 0 };

    const touches = followupTouches.filter(
      t => t.created_by === userName && isToday(parseISO(t.created_at))
    ).length;

    const fuDone = followUpQueue.filter(
      f => f.status === 'sent' && f.sent_at && isToday(parseISO(f.sent_at))
    ).length;

    return { touchesToday: touches, followUpsDoneToday: fuDone };
  }, [user?.name, followupTouches, followUpQueue]);

  const tasks = [
    { done: completedIntros >= totalIntros && totalIntros > 0, label: 'Intros logged' },
    { done: touchesToday > 0, label: 'Scripts/touches' },
    { done: followUpsDue === 0 || followUpsDoneToday > 0, label: 'Follow-ups' },
  ];
  const doneCount = tasks.filter(t => t.done).length;
  const pct = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  if (totalIntros === 0 && followUpsDue === 0) return null;

  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
        Daily: {doneCount}/{tasks.length}
      </span>
      <Progress value={pct} className="h-1.5 flex-1" />
      {pct === 100 && (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] px-1.5 py-0 h-4 gap-0.5">
          <CheckCircle2 className="w-2.5 h-2.5" /> Done
        </Badge>
      )}
    </div>
  );
}
