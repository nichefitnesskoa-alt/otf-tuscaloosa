/**
 * Filters row: two calm tabs – Today and Rest of week.
 */
import { Button } from '@/components/ui/button';
import type { TimeRange } from './myDayTypes';

interface UpcomingIntrosFiltersProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
}

const RANGES: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'restOfWeek', label: 'Week' },
  { value: 'needsOutcome', label: 'Needs Outcome' },
];

export default function UpcomingIntrosFilters({
  timeRange,
  onTimeRangeChange,
}: UpcomingIntrosFiltersProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-0.5">
      {RANGES.map(r => (
        <Button
          key={r.value}
          variant={timeRange === r.value ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs flex-1"
          onClick={() => onTimeRangeChange(r.value)}
        >
          {r.label}
        </Button>
      ))}
    </div>
  );
}
