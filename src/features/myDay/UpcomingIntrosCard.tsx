/**
 * Upcoming Intros Card: day-tab based navigation.
 * Shows Mon-Sun day pills; tapping a day shows only that day's intros.
 * Week navigation: Previous / Current range / Next.
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { differenceInMinutes } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, RefreshCw, AlertCircle, ChevronDown, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { TimeRange } from './myDayTypes';
import { useUpcomingIntrosData } from './useUpcomingIntrosData';
import { groupByDay } from './myDaySelectors';
import UpcomingIntrosFilters from './UpcomingIntrosFilters';
import IntroDayGroup from './IntroDayGroup';
import { confirmIntro } from './myDayActions';
import { supabase } from '@/integrations/supabase/client';
import { generateSlug } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { getTodayYMD } from '@/lib/dateUtils';
import { isMembershipSale } from '@/lib/sales-detection';
import WeekDayTabs, { useWeekDays, getDefaultSelectedDate } from '@/components/shared/WeekDayTabs';

interface UpcomingIntrosCardProps {
  userName: string;
  fixedTimeRange?: TimeRange;
}

export default function UpcomingIntrosCard({ userName, fixedTimeRange }: UpcomingIntrosCardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>(fixedTimeRange ?? 'today');
  const [confirmResults, setConfirmResults] = useState<Record<string, string>>({});

  // Week navigation state
  const [weekOffset, setWeekOffset] = useState(0);
  const isWeekFullView = fixedTimeRange === 'weekFull' || timeRange === 'weekFull';

  // Day tab selection
  const [selectedDate, setSelectedDate] = useState(() => getDefaultSelectedDate(0));
  const weekData = useWeekDays(weekOffset);

  // When week changes, reset selected date
  useEffect(() => {
    setSelectedDate(getDefaultSelectedDate(weekOffset));
  }, [weekOffset]);

  const dateOverrides = useMemo(() => {
    if (!isWeekFullView) return undefined;
    return { start: weekData.weekStart, end: weekData.weekEnd };
  }, [isWeekFullView, weekData.weekStart, weekData.weekEnd]);

  const { items, isLoading, lastSyncAt, isOnline, isCapped, refreshAll, silentRefresh } = useUpcomingIntrosData({
    timeRange,
    dateOverrides,
  });

  // Shoutout consent removed (superseded by FV Scorecard)
  const [shoutoutMap] = useState<Record<string, boolean | null>>({});

  // Fetch confirmation reflection results
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('win_the_day_reflections')
        .select('booking_id, result')
        .eq('reflection_type', 'booking_confirmation')
        .not('booking_id', 'is', null);
      if (data) {
        const map: Record<string, string> = {};
        (data as any[]).forEach(r => { if (r.booking_id) map[r.booking_id] = r.result; });
        setConfirmResults(map);
      }
    })();
  }, [items]);

  // Refresh on walk-in
  useEffect(() => {
    const handler = () => refreshAll();
    window.addEventListener('myday:walk-in-added', handler);
    return () => window.removeEventListener('myday:walk-in-added', handler);
  }, [refreshAll]);

  const dayGroups = useMemo(() => groupByDay(items), [items]);

  const todayStr = getTodayYMD();
  const isCurrentWeek = weekOffset === 0;
  const selectedIsToday = selectedDate === todayStr;

  // Day counts for badge display on tabs
  const dayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.classDate] = (counts[item.classDate] || 0) + 1;
    }
    return counts;
  }, [items]);

  // Items for selected day only
  const selectedDayItems = useMemo(() => {
    return items.filter(i => i.classDate === selectedDate);
  }, [items, selectedDate]);

  // Split selected day items into completed and active
  const isItemCompleted = useCallback((item: typeof items[0]) => {
    if (!item) return false;
    // Has a linked run with a real result = completed
    if (item.latestRunResult && item.latestRunResult !== 'UNRESOLVED') return true;
    return false;
  }, []);

  const completedDayItems = useMemo(() => selectedDayItems.filter(isItemCompleted), [selectedDayItems, isItemCompleted]);
  const activeDayItems = useMemo(() => selectedDayItems.filter(i => !isItemCompleted(i)), [selectedDayItems, isItemCompleted]);
  const activeDayGroups = useMemo(() => groupByDay(activeDayItems), [activeDayItems]);
  const completedDayGroups = useMemo(() => groupByDay(completedDayItems), [completedDayItems]);

  const selectedDayGroups = useMemo(() => groupByDay(selectedDayItems), [selectedDayItems]);

  // Q summary for selected day
  const qSummary = useMemo(() => {
    if (!isWeekFullView) return null;
    const dayItems = selectedDayItems;
    const total = dayItems.length;
    if (total === 0) return null;
    const firstIntros = dayItems.filter(i => !i.isSecondIntro);
    const qSent = firstIntros.filter(i => i.questionnaireStatus === 'Q_SENT' || i.questionnaireStatus === 'Q_COMPLETED').length;
    const stillNeeded = firstIntros.filter(i => i.questionnaireStatus === 'NO_Q').length;
    return { total, qSent, stillNeeded };
  }, [selectedDayItems, isWeekFullView]);

  // Day label for summary line
  const selectedDayLabel = useMemo(() => {
    if (selectedIsToday) return 'Today';
    const d = new Date(selectedDate + 'T12:00:00');
    return format(d, 'EEEE');
  }, [selectedDate, selectedIsToday]);

  // ══ ACCORDION STATE ══
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  // Auto-expand: only when selected day is today on current week
  const autoExpandDone = useRef(false);
  useEffect(() => {
    // Reset auto-expand when date or week changes
    autoExpandDone.current = false;
    setExpandedBookingId(null);
  }, [selectedDate, weekOffset]);

  useEffect(() => {
    if (selectedDayItems.length === 0 || autoExpandDone.current) return;
    if (!selectedIsToday || !isCurrentWeek) return;
    autoExpandDone.current = true;
    const now = new Date();
    const active = selectedDayItems.filter(i => !i.latestRunResult);
    if (active.length === 0) {
      if (selectedDayItems.length > 0) {
        const sorted = [...selectedDayItems].sort((a, b) => (b.introTime || '00:00').localeCompare(a.introTime || '00:00'));
        setExpandedBookingId(sorted[0].bookingId);
      }
      return;
    }
    let bestId: string | null = null;
    let bestDiff = Infinity;
    for (const item of active) {
      if (!item.introTime) continue;
      try {
        const classStart = new Date(`${item.classDate}T${item.introTime}:00`);
        const diff = classStart.getTime() - now.getTime();
        if (diff > 0 && diff < bestDiff) { bestDiff = diff; bestId = item.bookingId; }
      } catch {}
    }
    if (!bestId) {
      let latestDiff = -Infinity;
      for (const item of active) {
        if (!item.introTime) continue;
        try {
          const classStart = new Date(`${item.classDate}T${item.introTime}:00`);
          const diff = classStart.getTime() - now.getTime();
          if (diff > latestDiff) { latestDiff = diff; bestId = item.bookingId; }
        } catch {}
      }
    }
    if (bestId) setExpandedBookingId(bestId);
  }, [selectedDayItems, selectedIsToday, isCurrentWeek]);

  const handleExpandCard = useCallback((bookingId: string) => {
    setExpandedBookingId(prev => prev === bookingId ? null : bookingId);
  }, []);

  // Focused booking: nearest today's intro within 2 hours (only when viewing today)
  const [focusedBookingId, setFocusedBookingId] = useState<string | null>(null);
  useEffect(() => {
    const compute = () => {
      if (!selectedIsToday || !isCurrentWeek) { setFocusedBookingId(null); return; }
      const now = new Date();
      let nearest: { id: string; mins: number } | null = null;
      for (const item of selectedDayItems) {
        if (!item.introTime) continue;
        try {
          const classStart = new Date(`${item.classDate}T${item.introTime}:00`);
          const mins = differenceInMinutes(classStart, now);
          if (mins > 0 && mins <= 120) {
            if (!nearest || mins < nearest.mins) nearest = { id: item.bookingId, mins };
          }
        } catch {}
      }
      setFocusedBookingId(nearest?.id || null);
    };
    compute();
    const interval = setInterval(compute, 60000);
    return () => clearInterval(interval);
  }, [selectedDayItems, selectedIsToday, isCurrentWeek]);

  // Summary counts (for non-weekFull today view)
  const { introsRun } = useData();
  const summaryLine = useMemo(() => {
    const todayItems = items.filter(i => i.classDate === todayStr);
    const totalIntros = todayItems.length;
    const qComplete = todayItems.filter(i => i.questionnaireStatus === 'Q_COMPLETED').length;
    const todayRuns = introsRun.filter(r => r.run_date === todayStr);
    const shown = todayRuns.filter(r => r.result !== 'No-show' && r.result_canon !== 'NO_SHOW').length;
    const closed = todayRuns.filter(r => isMembershipSale(r.result || '')).length;
    return { totalIntros, qComplete, shown, closed };
  }, [items, introsRun, todayStr]);

  const handleSendQ = useCallback(async (bookingId: string) => {
    if (!isOnline) { toast.error('Offline'); return; }
    const item = items.find(i => i.bookingId === bookingId);
    if (!item) return;
    const PUBLISHED_URL = 'https://otf-tuscaloosa.lovable.app';
    try {
      const { data: existing } = await supabase
        .from('intro_questionnaires')
        .select('id, slug')
        .eq('booking_id', bookingId)
        .maybeSingle();

      let slug: string;
      let qId: string;

      if (existing) {
        qId = existing.id;
        const existingSlug = (existing as any).slug;
        const hasNewFormat = existingSlug && /[a-z]{3}\d{1,2}(-\d+)?$/.test(existingSlug);
        if (hasNewFormat) {
          slug = existingSlug;
        } else {
          const nameParts = item.memberName.trim().split(/\s+/);
          const firstName = nameParts[0] || item.memberName;
          const lastName = nameParts.slice(1).join(' ') || '';
          const newSlug = generateSlug(firstName, lastName, item.classDate);
          await supabase.from('intro_questionnaires').update({ slug: newSlug } as any).eq('id', qId);
          slug = newSlug;
        }
        await supabase
          .from('intro_questionnaires')
          .update({ status: 'sent' })
          .eq('id', qId)
          .not('status', 'in', '("completed","submitted","sent")');
      } else {
        const nameParts = item.memberName.trim().split(/\s+/);
        const firstName = nameParts[0] || item.memberName;
        const lastName = nameParts.slice(1).join(' ') || '';
        qId = crypto.randomUUID();
        const newSlug = generateSlug(firstName, lastName, item.classDate);
        await supabase.from('intro_questionnaires').insert({
          id: qId,
          booking_id: bookingId,
          client_first_name: firstName,
          client_last_name: lastName,
          scheduled_class_date: item.classDate,
          status: 'sent',
          slug: newSlug,
        } as any);
        slug = newSlug;
      }

      const link = `${PUBLISHED_URL}/q/${slug}`;
      await navigator.clipboard.writeText(link);
      toast.success('Questionnaire link copied! Paste it in your message.');
      refreshAll();
    } catch (err) {
      console.error('Copy Q link error:', err);
      toast.error('Failed to copy questionnaire link');
    }
  }, [items, userName, isOnline, refreshAll]);

  const handleConfirm = useCallback(async (bookingId: string) => {
    if (!isOnline) { toast.error('Offline'); return; }
    try {
      await confirmIntro(bookingId, userName);
      toast.success('Intro confirmed');
      refreshAll();
    } catch { toast.error('Failed to confirm'); }
  }, [userName, isOnline, refreshAll]);

  // For non-weekFull views
  const isTodayView = fixedTimeRange === 'today' || timeRange === 'today';

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
              First-timers today. Prep them before class. Book in Mindbody AND here.
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
        {/* Week Day Tabs — weekFull view */}
        {isWeekFullView && (
          <WeekDayTabs
            weekOffset={weekOffset}
            onWeekOffsetChange={setWeekOffset}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            dayCounts={dayCounts}
          />
        )}

        {/* Q status summary for selected day */}
        {isWeekFullView && qSummary && qSummary.total > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-xs bg-muted/40 rounded-lg px-3 py-2 min-h-[44px]">
            <span className="font-semibold">{selectedDayLabel}:</span>
            <span>{qSummary.total} intro{qSummary.total !== 1 ? 's' : ''}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-success">{qSummary.qSent} questionnaires sent</span>
            <span className="text-muted-foreground">·</span>
            <span className={qSummary.stillNeeded > 0 ? 'text-destructive font-medium' : 'text-success font-medium'}>
              {qSummary.stillNeeded} still needed
            </span>
          </div>
        )}

        {/* Summary line — Today counts (non-weekFull) */}
        {isTodayView && !isWeekFullView && items.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-xs bg-muted/40 rounded-lg px-3 py-2">
            <span className="font-semibold">Today:</span>
            <span>{summaryLine.totalIntros} intros</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-success">{summaryLine.qComplete} Q complete</span>
            <span className="text-muted-foreground">·</span>
            <span>{summaryLine.shown} shown</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-success font-medium">{summaryLine.closed} closed</span>
          </div>
        )}

        {/* Capped warning */}
        {isCapped && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Showing first 200 results. Narrow your date range for complete data.</span>
          </div>
        )}

        {/* Tabs (non-fixed mode) */}
        {!fixedTimeRange && (
          <UpcomingIntrosFilters timeRange={timeRange} onTimeRangeChange={setTimeRange} />
        )}

        {/* Day content */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : isWeekFullView ? (
          /* ═══ DAY TAB VIEW — only selected day ═══ */
          selectedDayItems.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-6">
              No intros scheduled for {selectedDayLabel}.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Completed Today section */}
              {completedDayItems.length > 0 && (
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-success/10 border border-success/30 text-success hover:bg-success/20 transition-colors min-h-[44px]">
                    <span className="text-sm font-semibold flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Completed Today ({completedDayItems.length})
                    </span>
                    <ChevronDown className="w-4 h-4 transition-transform [[data-state=open]_&]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="space-y-4">
                      {completedDayGroups.map(group => (
                        <IntroDayGroup
                          key={`completed-${group.date}`}
                          group={group}
                          isOnline={isOnline}
                          userName={userName}
                          onSendQ={handleSendQ}
                          onConfirm={handleConfirm}
                          onRefresh={silentRefresh}
                          needsOutcome={false}
                          confirmResults={confirmResults}
                          focusedBookingId={null}
                          expandedBookingId={expandedBookingId}
                          onExpandCard={handleExpandCard}
                          shoutoutMap={shoutoutMap}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Active intros */}
              {activeDayItems.length > 0 ? (
                activeDayGroups.map(group => (
                  <IntroDayGroup
                    key={group.date}
                    group={group}
                    isOnline={isOnline}
                    userName={userName}
                    onSendQ={handleSendQ}
                    onConfirm={handleConfirm}
                    onRefresh={silentRefresh}
                    needsOutcome={false}
                    confirmResults={confirmResults}
                    focusedBookingId={selectedIsToday ? focusedBookingId : null}
                    expandedBookingId={expandedBookingId}
                    onExpandCard={handleExpandCard}
                    shoutoutMap={shoutoutMap}
                  />
                ))
              ) : completedDayItems.length > 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-4">
                  All intros completed for {selectedDayLabel}! 🎉
                </p>
              ) : null}
            </div>
          )
        ) : dayGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            {timeRange === 'today' ? 'No intros scheduled'
              : timeRange === 'restOfWeek' ? 'No intros this week'
              : 'No past intros need an outcome — you\'re all caught up!'}
          </p>
        ) : (
          /* ═══ NON-WEEKFULL VIEWS ═══ */
          <div className="space-y-4">
            {dayGroups.map((group) => (
              <div key={group.date}>
                <IntroDayGroup
                  group={group}
                  isOnline={isOnline}
                  userName={userName}
                  onSendQ={handleSendQ}
                  onConfirm={handleConfirm}
                  onRefresh={silentRefresh}
                  needsOutcome={timeRange === 'needsOutcome'}
                  confirmResults={confirmResults}
                  focusedBookingId={focusedBookingId}
                  expandedBookingId={expandedBookingId}
                  onExpandCard={handleExpandCard}
                  shoutoutMap={shoutoutMap}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
