/**
 * Day group: header with date label, count, Q ratio, and bulk actions.
 * Renders intro row cards grouped by class time with time headers.
 */
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import type { DayGroup } from './myDayTypes';
import IntroRowCard from './IntroRowCard';
import BulkActionsBar from './BulkActionsBar';
import { formatDisplayTime } from '@/lib/time/timeUtils';

interface IntroDayGroupProps {
  group: DayGroup;
  isOnline: boolean;
  userName: string;
  onSendQ: (bookingId: string) => void;
  onConfirm: (bookingId: string) => void;
  onRefresh: () => void;
  needsOutcome?: boolean;
  confirmResults?: Record<string, string>;
  focusedBookingId?: string | null;
}

export default function IntroDayGroup({
  group, isOnline, userName, onSendQ, onConfirm, onRefresh, needsOutcome = false, confirmResults = {}, focusedBookingId = null,
}: IntroDayGroupProps) {
  const qPercent = Math.round(group.qSentRatio * 100);

  // Group items by class time
  const timeGroups = useMemo(() => {
    const groups = new Map<string, typeof group.items>();
    for (const item of group.items) {
      const key = item.introTime || 'unscheduled';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    // Sort by time
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === 'unscheduled') return 1;
      if (b === 'unscheduled') return -1;
      return a.localeCompare(b);
    });
  }, [group.items]);

  return (
    <div className="space-y-2 border-t-2 border-primary/30 pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2 bg-muted/40 rounded-lg px-3 py-1.5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold">{group.label}</h3>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            {group.items.length} intro{group.items.length !== 1 ? 's' : ''}
          </Badge>
          {!needsOutcome && (
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${qPercent === 100 ? 'text-emerald-700 border-emerald-300' : qPercent >= 50 ? 'text-amber-700 border-amber-300' : 'text-destructive border-destructive/30'}`}>
              Q: {qPercent}%
            </Badge>
          )}
        </div>
      </div>
      <BulkActionsBar items={group.items} userName={userName} isOnline={isOnline} onDone={onRefresh} />
      <div className="space-y-2">
        {timeGroups.map(([time, items]) => (
          <div key={time}>
            {/* Time group header */}
            {timeGroups.length > 1 && (
              <div className="flex items-center gap-2 px-2 py-1 mb-1">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {time === 'unscheduled' ? 'Time TBD' : formatDisplayTime(time)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  — {items.length} intro{items.length !== 1 ? 's' : ''}
                </span>
                <div className="flex-1 border-t border-border/50" />
              </div>
            )}
            <div className="space-y-4">
              {items.map(item => (
                <IntroRowCard
                  key={item.bookingId}
                  item={item}
                  isOnline={isOnline}
                  userName={userName}
                  onSendQ={onSendQ}
                  onConfirm={onConfirm}
                  onRefresh={onRefresh}
                  needsOutcome={needsOutcome}
                  confirmationResult={confirmResults[item.bookingId] || null}
                  isFocused={item.bookingId === focusedBookingId}
                  anyFocused={!!focusedBookingId}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
