/**
 * Shared week navigation + day tab selector.
 * Used by both My Day Intros tab and Coach View.
 * All date math uses Central Time via getNowCentral().
 */
import { useMemo } from 'react';
import { format, startOfWeek, endOfWeek, addWeeks, eachDayOfInterval, isBefore, isToday as isDateToday } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNowCentral, getTodayYMD } from '@/lib/dateUtils';

export interface DayTabInfo {
  date: string; // YYYY-MM-DD
  dayDate: Date;
  dayAbbr: string; // Mon, Tue, …
  dateNum: number;
  isToday: boolean;
  isPast: boolean;
}

interface WeekDayTabsProps {
  weekOffset: number;
  onWeekOffsetChange: (offset: number) => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  /** Map of YYYY-MM-DD → intro count for badge display */
  dayCounts?: Record<string, number>;
}

export function useWeekDays(weekOffset: number) {
  return useMemo(() => {
    const now = getNowCentral();
    const base = addWeeks(now, weekOffset);
    const monday = startOfWeek(base, { weekStartsOn: 1 });
    const sunday = endOfWeek(base, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: monday, end: sunday });
    const todayStr = getTodayYMD();
    const isCurrentWeek = weekOffset === 0;

    const dayInfos: DayTabInfo[] = days.map(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      return {
        date: dateStr,
        dayDate: d,
        dayAbbr: format(d, 'EEE'),
        dateNum: d.getDate(),
        isToday: dateStr === todayStr,
        isPast: isBefore(d, new Date(todayStr + 'T00:00:00')) && dateStr !== todayStr,
      };
    });

    return {
      monday,
      sunday,
      days: dayInfos,
      isCurrentWeek,
      todayStr,
      weekStart: format(monday, 'yyyy-MM-dd'),
      weekEnd: format(sunday, 'yyyy-MM-dd'),
    };
  }, [weekOffset]);
}

export function getDefaultSelectedDate(weekOffset: number): string {
  if (weekOffset === 0) return getTodayYMD();
  const now = getNowCentral();
  const base = addWeeks(now, weekOffset);
  if (weekOffset < 0) {
    // Past week → Sunday
    const sunday = endOfWeek(base, { weekStartsOn: 1 });
    return format(sunday, 'yyyy-MM-dd');
  }
  // Future week → Monday
  const monday = startOfWeek(base, { weekStartsOn: 1 });
  return format(monday, 'yyyy-MM-dd');
}

export default function WeekDayTabs({
  weekOffset,
  onWeekOffsetChange,
  selectedDate,
  onSelectDate,
  dayCounts = {},
}: WeekDayTabsProps) {
  const { monday, sunday, days, isCurrentWeek } = useWeekDays(weekOffset);

  return (
    <div className="space-y-2">
      {/* Week navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="min-h-[44px] flex-1 cursor-pointer text-sm font-medium"
          onClick={() => onWeekOffsetChange(weekOffset - 1)}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous Week
        </Button>
        <div className="flex-1 text-center">
          <p className="text-sm font-semibold">
            {format(monday, 'MMM d')} – {format(sunday, 'MMM d')}
          </p>
          {!isCurrentWeek && (
            <button
              onClick={() => onWeekOffsetChange(0)}
              className="text-xs text-primary underline cursor-pointer mt-0.5"
            >
              Back to this week
            </button>
          )}
        </div>
        <Button
          variant="outline"
          className="min-h-[44px] flex-1 cursor-pointer text-sm font-medium"
          onClick={() => onWeekOffsetChange(weekOffset + 1)}
        >
          Next Week
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Day tab pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {days.map(day => {
          const count = dayCounts[day.date] || 0;
          const isSelected = selectedDate === day.date;

          return (
            <button
              key={day.date}
              onClick={() => onSelectDate(day.date)}
              className={cn(
                'flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border min-h-[44px] min-w-[52px] cursor-pointer relative',
                isSelected
                  ? 'bg-[#E8540A] text-white border-[#E8540A] font-bold'
                  : day.isToday
                    ? 'bg-card text-card-foreground border-[#E8540A]/50 ring-1 ring-[#E8540A]/30 hover:bg-muted'
                    : day.isPast
                      ? 'bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted/60'
                      : 'bg-card text-card-foreground border-border hover:bg-muted',
              )}
            >
              <span className="text-[13px]">{day.dayAbbr}</span>
              <span className="text-[11px]">{day.dateNum}</span>
              {count > 0 && (
                <span
                  className={cn(
                    'absolute -top-1 -right-1 flex items-center justify-center rounded-full text-[9px] font-bold min-w-[16px] h-[16px] px-1',
                    isSelected
                      ? 'bg-white text-[#E8540A]'
                      : 'bg-[#E8540A] text-white',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
