/**
 * Upcoming Intros Card: calm, positive daily workflow.
 * Two tabs: Today / Rest of week.
 * No at-risk banners, no scary styling.
 * Cards show Prep | Script | Coach buttons.
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { TimeRange } from './myDayTypes';
import { useUpcomingIntrosData } from './useUpcomingIntrosData';
import { groupByDay, getSuggestedFocus } from './myDaySelectors';
import UpcomingIntrosFilters from './UpcomingIntrosFilters';
import IntroDayGroup from './IntroDayGroup';
import { sendQuestionnaire, confirmIntro } from './myDayActions';

interface UpcomingIntrosCardProps {
  userName: string;
}

export default function UpcomingIntrosCard({ userName }: UpcomingIntrosCardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('today');

  const { items, isLoading, lastSyncAt, isOnline, isCapped, refreshAll } = useUpcomingIntrosData({
    timeRange,
  });

  // Refresh when a walk-in intro is added from the FAB
  useEffect(() => {
    const handler = () => refreshAll();
    window.addEventListener('myday:walk-in-added', handler);
    return () => window.removeEventListener('myday:walk-in-added', handler);
  }, [refreshAll]);

  const dayGroups = useMemo(() => groupByDay(items), [items]);
  const suggestedFocus = useMemo(() => getSuggestedFocus(items), [items]);

  const qCompletionPct = useMemo(() => {
    if (items.length === 0) return 0;
    const done = items.filter(i => i.questionnaireStatus !== 'NO_Q').length;
    return Math.round((done / items.length) * 100);
  }, [items]);

  const handleSendQ = useCallback(async (bookingId: string) => {
    if (!isOnline) { toast.error('Offline'); return; }
    const item = items.find(i => i.bookingId === bookingId);
    if (!item) return;
    try {
      await sendQuestionnaire(bookingId, item.memberName, item.classDate, userName);
      toast.success('Questionnaire sent');
      refreshAll();
    } catch { toast.error('Failed to send questionnaire'); }
  }, [items, userName, isOnline, refreshAll]);

  const handleConfirm = useCallback(async (bookingId: string) => {
    if (!isOnline) { toast.error('Offline'); return; }
    try {
      await confirmIntro(bookingId, userName);
      toast.success('Intro confirmed');
      refreshAll();
    } catch { toast.error('Failed to confirm'); }
  }, [userName, isOnline, refreshAll]);

  return (
    <Card id="upcoming-intros">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Upcoming Intros
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Make these feel welcomed and ready.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastSyncAt && (
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true })}
              </span>
            )}
            {!isOnline && (
              <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">Offline</Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => refreshAll()}
              disabled={isLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Summary strip – calm, neutral */}
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <span className="font-medium">
            {timeRange === 'today' ? "Today's" : 'This week\'s'} Intros: <strong>{items.length}</strong>
          </span>
          <span className="text-muted-foreground">
            On track: <strong>{qCompletionPct}%</strong>
          </span>
          {suggestedFocus !== 'All prepped! 🎉' && (
            <span className="text-muted-foreground">
              Quick win: <strong>{suggestedFocus}</strong>
            </span>
          )}
          {suggestedFocus === 'All prepped! 🎉' && (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {suggestedFocus}
            </span>
          )}
        </div>

        {/* Capped warning */}
        {isCapped && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Showing first 200 results. Narrow your date range for complete data.</span>
          </div>
        )}

        {/* Tabs: Today / Rest of week */}
        <UpcomingIntrosFilters
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
        />

        {/* Day groups */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : dayGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            {timeRange === 'today' ? 'No intros scheduled for today' : 'No intros for the rest of this week'}
          </p>
        ) : (
          <div className="space-y-4">
            {dayGroups.map(group => (
              <IntroDayGroup
                key={group.date}
                group={group}
                isOnline={isOnline}
                userName={userName}
                onSendQ={handleSendQ}
                onConfirm={handleConfirm}
                onRefresh={refreshAll}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
