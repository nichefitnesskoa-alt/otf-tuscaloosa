/**
 * Filters row: segmented control for time range with optional custom date pickers.
 */
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TimeRange } from './myDayTypes';

interface UpcomingIntrosFiltersProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (val: string) => void;
  onCustomEndChange: (val: string) => void;
}

const RANGES: { value: TimeRange; label: string }[] = [
  { value: 'next24h', label: 'Next 24h' },
  { value: 'next7d', label: 'Next 7d' },
  { value: 'custom', label: 'Custom' },
];

export default function UpcomingIntrosFilters({
  timeRange,
  onTimeRangeChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
}: UpcomingIntrosFiltersProps) {
  return (
    <div className="space-y-2">
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
      {timeRange === 'custom' && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={customStart}
            onChange={e => onCustomStartChange(e.target.value)}
            className="h-8 text-xs"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={customEnd}
            onChange={e => onCustomEndChange(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      )}
    </div>
  );
}
