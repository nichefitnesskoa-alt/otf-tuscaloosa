import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IntroCountdownProps {
  classTime: string | null;
  classDate: string;
}

export function IntroCountdown({ classTime, classDate }: IntroCountdownProps) {
  const [minutesUntil, setMinutesUntil] = useState<number | null>(null);

  useEffect(() => {
    if (!classTime) return;

    const calculate = () => {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      if (classDate !== todayStr) {
        setMinutesUntil(null);
        return;
      }

      const [h, m] = classTime.split(':').map(Number);
      const classDateTime = new Date();
      classDateTime.setHours(h, m, 0, 0);
      const diff = Math.round((classDateTime.getTime() - Date.now()) / 60000);
      setMinutesUntil(diff > 0 ? diff : null);
    };

    calculate();
    const interval = setInterval(calculate, 60000);
    return () => clearInterval(interval);
  }, [classTime, classDate]);

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
