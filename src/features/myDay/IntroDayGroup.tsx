/**
 * Day group: header with date label, count, Q ratio, and bulk actions.
 * Renders intro row cards grouped by class time with collapsible time sections.
 * Past class times are collapsed by default; current/upcoming are expanded.
 */
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
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

/**
 * Determine if a class time is "past" (>15 min ago), "current" (within -15min to +3hr), or "future".
 */
function getTimeStatus(classDate: string, classTime: string | null): 'past' | 'current' | 'future' {
  if (!classTime) return 'future'; // TBD times default to expanded
  try {
    const classStart = new Date(`${classDate}T${classTime}:00`);
    const now = new Date();
    const diffMs = classStart.getTime() - now.getTime();
    const diffMin = diffMs / 60000;

    // Past: class started more than 15 min ago
    if (diffMin < -15) return 'past';
    // Current: started within last 15 min or within next 3 hours
    if (diffMin >= -15 && diffMin <= 180) return 'current';
    // Future: more than 3 hours away
    return 'future';
  } catch {
    return 'future';
  }
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
        {timeGroups.map(([time, items]) => {
          const timeStatus = getTimeStatus(group.date, time === 'unscheduled' ? null : time);
          const shouldDefaultOpen = timeStatus !== 'past';
          const isCurrent = timeStatus === 'current';
          const timeLabel = time === 'unscheduled' ? 'Time TBD' : formatDisplayTime(time);

          return (
            <Collapsible key={time} defaultOpen={false}>
              <CollapsibleTrigger className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-left font-semibold transition-colors",
                "bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30"
              )}>
                <span className="text-sm flex items-center gap-1 flex-wrap min-w-0">
                  <span className="shrink-0">{timeLabel} — {items.length} intro{items.length !== 1 ? 's' : ''}</span>
                  {(() => {
                    const notSent = items.filter(i => i.questionnaireStatus === 'NO_Q').length;
                    const sent = items.filter(i => i.questionnaireStatus === 'Q_SENT').length;
                    const done = items.filter(i => i.questionnaireStatus === 'Q_COMPLETED').length;
                    const allDone = done === items.length && items.length > 0;
                    if (allDone) return <span className="text-emerald-300 font-medium ml-1">· ✓ All done</span>;
                    return (
                      <>
                        {notSent > 0 && <span className="text-red-300 font-medium ml-1 shrink-0">· <span className="hidden min-[400px]:inline">✉ {notSent} not sent</span><span className="inline min-[400px]:hidden">✉{notSent}</span></span>}
                        {sent > 0 && <span className="text-amber-300 font-medium ml-1 shrink-0">· <span className="hidden min-[400px]:inline">⏳ {sent} sent</span><span className="inline min-[400px]:hidden">⏳{sent}</span></span>}
                        {done > 0 && <span className="text-emerald-300 font-medium ml-1 shrink-0">· <span className="hidden min-[400px]:inline">✓ {done} done</span><span className="inline min-[400px]:hidden">✓{done}</span></span>}
                      </>
                    );
                  })()}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180 shrink-0 ml-1" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
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
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
