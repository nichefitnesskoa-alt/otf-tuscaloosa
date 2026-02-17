/**
 * Upcoming Intros Card: the single canonical intros queue.
 * Contains summary strip, filters, at-risk banner, and day-grouped list.
 * Prep/Script/Coach buttons on each card open drawers in MyDayPage.
 */
import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { TimeRange } from './myDayTypes';
import { useUpcomingIntrosData } from './useUpcomingIntrosData';
import { groupByDay, getAtRiskCounts, getSuggestedFocus } from './myDaySelectors';
import UpcomingIntrosFilters from './UpcomingIntrosFilters';
import AtRiskBanner from './AtRiskBanner';
import IntroDayGroup from './IntroDayGroup';
import { sendQuestionnaire, confirmIntro } from './myDayActions';
import { format } from 'date-fns';

interface UpcomingIntrosCardProps {
  userName: string;
}

export default function UpcomingIntrosCard({ userName }: UpcomingIntrosCardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('next24h');
  const [customStart, setCustomStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showAtRiskOnly, setShowAtRiskOnly] = useState(false);

  const { items, isLoading, lastSyncAt, isOnline, isCapped, refreshAll } = useUpcomingIntrosData({
    timeRange,
    customStart,
    customEnd,
  });

  const filteredItems = useMemo(() => {
    if (!showAtRiskOnly) return items;
    return items.filter(i => i.riskScore > 0);
  }, [items, showAtRiskOnly]);

  const dayGroups = useMemo(() => groupByDay(filteredItems), [filteredItems]);
  const riskCounts = useMemo(() => getAtRiskCounts(items), [items]);
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
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Upcoming Intros
          </CardTitle>
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
        {/* Summary strip */}
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <span className="font-medium">
            {timeRange === 'next24h' ? 'Next 24h' : timeRange === 'next7d' ? 'Next 7d' : 'Custom'} Intros: <strong>{items.length}</strong>
          </span>
          <span className="text-muted-foreground">
            Q completion: <strong>{qCompletionPct}%</strong>
          </span>
          <span className="text-muted-foreground">
            Focus: <strong>{suggestedFocus}</strong>
          </span>
        </div>

        {/* Capped warning */}
        {isCapped && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Showing first 200 results. Narrow your date range for complete data.</span>
          </div>
        )}

        {/* Filters */}
        <UpcomingIntrosFilters
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          customStart={customStart}
          customEnd={customEnd}
          onCustomStartChange={setCustomStart}
          onCustomEndChange={setCustomEnd}
        />

        {/* At-risk banner */}
        <AtRiskBanner
          counts={riskCounts}
          showAtRiskOnly={showAtRiskOnly}
          onToggle={() => setShowAtRiskOnly(v => !v)}
        />

        {/* Day groups */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : dayGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No upcoming intros</p>
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
