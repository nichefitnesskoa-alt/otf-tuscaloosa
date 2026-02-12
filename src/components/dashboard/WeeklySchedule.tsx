import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { startOfWeek, endOfWeek, format, parseISO, eachDayOfInterval, isSameDay } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';

export function WeeklySchedule() {
  const { introsBooked } = useData();

  const { days, total } = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const daysOfWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

    const activeBookings = introsBooked.filter(b => {
      const status = ((b as any).booking_status || '').toUpperCase();
      if (status.includes('DUPLICATE') || status.includes('DELETED') || status.includes('DEAD')) return false;
      try {
        const d = parseLocalDate(b.class_date);
        return d >= weekStart && d <= weekEnd;
      } catch { return false; }
    });

    const dayData = daysOfWeek.map(day => ({
      label: format(day, 'EEE'),
      date: format(day, 'MMM d'),
      count: activeBookings.filter(b => {
        try { return isSameDay(parseLocalDate(b.class_date), day); } catch { return false; }
      }).length,
      isToday: isSameDay(day, now),
    }));

    return { days: dayData, total: activeBookings.length };
  }, [introsBooked]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            This Week's Schedule
          </CardTitle>
          <Badge variant="secondary" className="text-xs">{total} total</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => (
            <div
              key={day.label}
              className={`text-center p-2 rounded-lg border ${
                day.isToday ? 'border-primary bg-primary/10' : 'border-border bg-muted/20'
              }`}
            >
              <p className={`text-[10px] font-medium ${day.isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                {day.label}
              </p>
              <p className={`text-lg font-bold ${day.count > 0 ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                {day.count}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
