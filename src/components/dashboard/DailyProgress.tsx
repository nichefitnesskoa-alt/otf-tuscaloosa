import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';

interface DailyProgressProps {
  completedIntros: number;
  totalIntros: number;
  scriptsSent: number;
  followUpsSent: number;
  followUpsDue: number;
}

export function DailyProgress({
  completedIntros,
  totalIntros,
  scriptsSent,
  followUpsSent,
  followUpsDue,
}: DailyProgressProps) {
  // Count total trackable tasks and completed
  const tasks = [
    { done: completedIntros >= totalIntros && totalIntros > 0, label: 'Intros logged' },
    { done: scriptsSent > 0, label: 'Scripts sent' },
    { done: followUpsDue === 0 || followUpsSent > 0, label: 'Follow-ups' },
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
