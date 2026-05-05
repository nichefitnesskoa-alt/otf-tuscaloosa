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
  expandedBookingId?: string | null;
  onExpandCard?: (bookingId: string) => void;
  shoutoutMap?: Record<string, boolean | null>;
}

export default function IntroDayGroup({
  group, isOnline, userName, onSendQ, onConfirm, onRefresh, needsOutcome = false, confirmResults = {}, focusedBookingId = null,
  expandedBookingId = null, onExpandCard, shoutoutMap = {},
}: IntroDayGroupProps) {
  const qPercent = Math.round(group.qSentRatio * 100);
  // VIP groups are not counted as intros
  const trueIntros = group.items.filter(i => !i.isVipSession);
  const vipGroupCount = group.items.length - trueIntros.length;

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
            {trueIntros.length} intro{trueIntros.length !== 1 ? 's' : ''}
          </Badge>
          {vipGroupCount > 0 && (
            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-orange-600 text-white border-transparent">
              +{vipGroupCount} VIP group{vipGroupCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {!needsOutcome && trueIntros.length > 0 && (
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${qPercent === 100 ? 'text-emerald-700 border-emerald-300' : qPercent >= 50 ? 'text-amber-700 border-amber-300' : 'text-destructive border-destructive/30'}`}>
              Q: {qPercent}%
            </Badge>
          )}
        </div>
      </div>
      <BulkActionsBar items={group.items} userName={userName} isOnline={isOnline} onDone={onRefresh} />
      <div className="space-y-2">
        {timeGroups.map(([time, items]) => {
          const timeLabel = time === 'unscheduled' ? 'Time TBD' : formatDisplayTime(time);
          const trueIntrosInBlock = items.filter(i => !i.isVipSession);
          const vipInBlock = items.length - trueIntrosInBlock.length;
          const blockLabel = trueIntrosInBlock.length > 0
            ? `${trueIntrosInBlock.length} intro${trueIntrosInBlock.length !== 1 ? 's' : ''}${vipInBlock > 0 ? ` + ${vipInBlock} VIP` : ''}`
            : `${vipInBlock} VIP group${vipInBlock !== 1 ? 's' : ''}`;

          return (
            <Collapsible key={time} defaultOpen={false}>
              <CollapsibleTrigger className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-left font-semibold transition-colors",
                "bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30"
              )}>
                <span className="text-sm flex items-center gap-1 flex-wrap min-w-0">
                  <span className="shrink-0">{timeLabel} — {blockLabel}</span>
                  {(() => {
                    const firstIntros = trueIntrosInBlock.filter(i => !i.isSecondIntro);
                    if (firstIntros.length === 0) return null;
                    const notSent = firstIntros.filter(i => i.questionnaireStatus === 'NO_Q').length;
                    const sent = firstIntros.filter(i => i.questionnaireStatus === 'Q_SENT').length;
                    const done = firstIntros.filter(i => i.questionnaireStatus === 'Q_COMPLETED').length;
                    const allDone = done === firstIntros.length && firstIntros.length > 0;
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
                <div className="space-y-2">
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
                      isExpanded={expandedBookingId === item.bookingId}
                      onExpand={() => onExpandCard?.(item.bookingId)}
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
