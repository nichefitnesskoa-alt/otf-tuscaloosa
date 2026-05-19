import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNowMinute } from '@/hooks/useNowMinute';

interface IntroCountdownProps {
  classTime: string | null;
  classDate: string;
}

export function IntroCountdown({ classTime, classDate }: IntroCountdownProps) {
  const now = useNowMinute();

  const minutesUntil = useMemo<number | null>(() => {
    if (!classTime) return null;
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (classDate !== todayStr) return null;
    const [h, m] = classTime.split(':').map(Number);
    const classDateTime = new Date(now);
    classDateTime.setHours(h, m, 0, 0);
    const diff = Math.round((classDateTime.getTime() - now.getTime()) / 60000);
    return diff > 0 ? diff : null;
  }, [classTime, classDate, now]);

  if (minutesUntil === null) return null;

  const hours = Math.floor(minutesUntil / 60);
  const mins = minutesUntil % 60;
  const isUrgent = minutesUntil <= 30;

  const label = hours > 0
    ? `${hours}h ${mins}m`
    : `${mins}m`;

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] px-1.5 py-0 h-4 gap-0.5',
        isUrgent
          ? 'bg-warning/15 text-warning border-warning/30 animate-pulse'
          : 'text-muted-foreground'
      )}
    >
      <Clock className="w-2.5 h-2.5" />
      {label}
    </Badge>
  );
}
