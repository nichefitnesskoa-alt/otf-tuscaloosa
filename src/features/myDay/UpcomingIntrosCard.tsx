/**
 * Upcoming Intros Card: calm, positive daily workflow.
 * Collapsible cards — only one expanded at a time.
 * Auto-expands the next upcoming intro on load.
 * Summary line at top: Today: X intros · Y Q complete · Z shown · W closed
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { differenceInMinutes } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, RefreshCw, AlertCircle, ChevronDown } from 'lucide-react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { TimeRange } from './myDayTypes';
import { useUpcomingIntrosData } from './useUpcomingIntrosData';
import { groupByDay, getSuggestedFocus } from './myDaySelectors';
import UpcomingIntrosFilters from './UpcomingIntrosFilters';
import IntroDayGroup from './IntroDayGroup';
import { confirmIntro } from './myDayActions';
import { supabase } from '@/integrations/supabase/client';
import { generateSlug } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { getTodayYMD } from '@/lib/dateUtils';
import { isMembershipSale } from '@/lib/sales-detection';

interface UpcomingIntrosCardProps {
  userName: string;
  fixedTimeRange?: TimeRange;
}

export default function UpcomingIntrosCard({ userName, fixedTimeRange }: UpcomingIntrosCardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>(fixedTimeRange ?? 'today');
  const [confirmResults, setConfirmResults] = useState<Record<string, string>>({});

  const { items, isLoading, lastSyncAt, isOnline, isCapped, refreshAll } = useUpcomingIntrosData({
    timeRange,
  });

  // Shoutout consent map — fetch from intros_booked
  const [shoutoutMap, setShoutoutMap] = useState<Record<string, boolean | null>>({});
  useEffect(() => {
    if (items.length === 0) return;
    const ids = items.map(i => i.bookingId);
    (async () => {
      const batches: string[][] = [];
      for (let i = 0; i < ids.length; i += 500) batches.push(ids.slice(i, i + 500));
      const map: Record<string, boolean | null> = {};
      for (const batch of batches) {
        const { data } = await supabase
          .from('intros_booked')
          .select('id, shoutout_consent')
          .in('id', batch);
        (data || []).forEach((r: any) => { map[r.id] = r.shoutout_consent; });
      }
      setShoutoutMap(map);
    })();
  }, [items]);

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

  // Refresh when a walk-in intro is added from the FAB
  useEffect(() => {
    const handler = () => refreshAll();
    window.addEventListener('myday:walk-in-added', handler);
    return () => window.removeEventListener('myday:walk-in-added', handler);
  }, [refreshAll]);

  const dayGroups = useMemo(() => groupByDay(items), [items]);
  const suggestedFocus = useMemo(() => getSuggestedFocus(items), [items]);

  // Split completed vs active intros for Today/weekFull view
  const isWeekFullView = fixedTimeRange === 'weekFull' || timeRange === 'weekFull';
  const isTodayView = fixedTimeRange === 'today' || timeRange === 'today';
  const isSplitView = isTodayView || isWeekFullView;
  const { activeItems, completedItems } = useMemo(() => {
    if (!isSplitView) return { activeItems: items, completedItems: [] };
    const todayDate = getTodayYMD();
    return {
      activeItems: items.filter(i => !(i.classDate === todayDate && i.latestRunResult)),
      completedItems: items.filter(i => i.classDate === todayDate && !!i.latestRunResult),
    };
  }, [items, isSplitView]);
  const activeDayGroups = useMemo(() => groupByDay(activeItems), [activeItems]);
  const completedDayGroups = useMemo(() => groupByDay(completedItems), [completedItems]);
  const [completedOpen, setCompletedOpen] = useState(false);

  // Q status summary for weekFull view
  const qSummary = useMemo(() => {
    if (!isWeekFullView) return null;
    const todayDate = getTodayYMD();
    const todayItems = items.filter(i => i.classDate === todayDate);
    const total = todayItems.length;
    const qSent = todayItems.filter(i => i.questionnaireStatus === 'Q_SENT' || i.questionnaireStatus === 'Q_COMPLETED').length;
    const stillNeeded = todayItems.filter(i => i.questionnaireStatus !== 'Q_COMPLETED').length;
    return { total, qSent, stillNeeded };
  }, [items, isWeekFullView]);

  // Ref for scrolling to first No Q item
  const firstNoQRef = useRef<HTMLDivElement>(null);
  // Ref for scrolling to today's section
  const todaySectionRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to today on mount for weekFull
  useEffect(() => {
    if (isWeekFullView && todaySectionRef.current && !isLoading) {
      setTimeout(() => todaySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
  }, [isWeekFullView, isLoading]);

  // ══ ACCORDION STATE — only one card expanded at a time ══
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  // Auto-expand logic: find next upcoming intro
  const todayStr = getTodayYMD();
  const autoExpandDone = useRef(false);
  useEffect(() => {
    if (items.length === 0 || autoExpandDone.current) return;
    autoExpandDone.current = true;
    const now = new Date();
    
    // Find today's active intros (no outcome yet)
    const todayActive = items.filter(i => 
      i.classDate === todayStr && 
      !i.latestRunResult
    );

    if (todayActive.length === 0) {
      // All done — expand most recent
      const todayAll = items.filter(i => i.classDate === todayStr);
      if (todayAll.length > 0) {
        const sorted = [...todayAll].sort((a, b) => {
          const ta = a.introTime || '00:00';
          const tb = b.introTime || '00:00';
          return tb.localeCompare(ta);
        });
        setExpandedBookingId(sorted[0].bookingId);
      }
      return;
    }

    // Find closest upcoming class time not yet passed
    let bestId: string | null = null;
    let bestDiff = Infinity;
    for (const item of todayActive) {
      if (!item.introTime) continue;
      try {
        const classStart = new Date(`${item.classDate}T${item.introTime}:00`);
        const diff = classStart.getTime() - now.getTime();
        if (diff > 0 && diff < bestDiff) {
          bestDiff = diff;
          bestId = item.bookingId;
        }
      } catch {}
    }

    // If all have passed, use the most recent past one
    if (!bestId) {
      let latestDiff = -Infinity;
      for (const item of todayActive) {
        if (!item.introTime) continue;
        try {
          const classStart = new Date(`${item.classDate}T${item.introTime}:00`);
          const diff = classStart.getTime() - now.getTime();
          if (diff > latestDiff) {
            latestDiff = diff;
            bestId = item.bookingId;
          }
        } catch {}
      }
    }

    if (bestId) setExpandedBookingId(bestId);
  }, [items, todayStr]);

  const handleExpandCard = useCallback((bookingId: string) => {
    setExpandedBookingId(prev => prev === bookingId ? null : bookingId);
  }, []);

  // Compute focused booking: nearest today's intro within 2 hours
  const [focusedBookingId, setFocusedBookingId] = useState<string | null>(null);

  useEffect(() => {
    const compute = () => {
      const now = new Date();
      let nearest: { id: string; mins: number } | null = null;
      for (const item of items) {
        if (item.classDate !== todayStr || !item.introTime) continue;
        try {
          const classStart = new Date(`${item.classDate}T${item.introTime}:00`);
          const mins = differenceInMinutes(classStart, now);
          if (mins > 0 && mins <= 120) {
            if (!nearest || mins < nearest.mins) {
              nearest = { id: item.bookingId, mins };
            }
          }
        } catch {}
      }
      setFocusedBookingId(nearest?.id || null);
    };
    compute();
    const interval = setInterval(compute, 60000);
    return () => clearInterval(interval);
  }, [items, todayStr]);

  // Week tab: day sub-tabs
  const isWeekView = fixedTimeRange === 'restOfWeek';
  const [selectedWeekDay, setSelectedWeekDay] = useState<string | null>(null);

  useEffect(() => {
    if (isWeekView && dayGroups.length > 0) {
      setSelectedWeekDay(prev => {
        if (prev && dayGroups.some(g => g.date === prev)) return prev;
        return dayGroups[0].date;
      });
    }
  }, [isWeekView, dayGroups]);

  const filteredDayGroups = useMemo(() => {
    if (!isWeekView || !selectedWeekDay) return dayGroups;
    return dayGroups.filter(g => g.date === selectedWeekDay);
  }, [isWeekView, selectedWeekDay, dayGroups]);

  const qCompletionPct = useMemo(() => {
    if (items.length === 0) return 0;
    const done = items.filter(i => i.questionnaireStatus !== 'NO_Q').length;
    return Math.round((done / items.length) * 100);
  }, [items]);

  // ══ SUMMARY COUNTS ══
  const { introsRun } = useData();
  const summaryLine = useMemo(() => {
    const todayItems = items.filter(i => i.classDate === todayStr);
    const totalIntros = todayItems.length;
    const qComplete = todayItems.filter(i => i.questionnaireStatus === 'Q_COMPLETED').length;
    // Shown and closed from intros_run for today (matching Studio tab logic)
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
        {/* Summary line — Today counts matching Studio tab */}
        {isTodayView && items.length > 0 && (
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

        {/* Quick win strip */}
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <span className="font-medium">
            {timeRange === 'today' ? "Today" : timeRange === 'restOfWeek' ? 'Rest of week' : 'Needs outcome'}: <strong>{items.length}</strong>
          </span>
          {timeRange !== 'needsOutcome' && (
            <span className="text-muted-foreground">
              On track: <strong>{qCompletionPct}%</strong>
            </span>
          )}
          {timeRange !== 'needsOutcome' && suggestedFocus !== 'All prepped! 🎉' && (
            <span className="text-muted-foreground">
              Quick win: <strong>{suggestedFocus}</strong>
            </span>
          )}
          {timeRange !== 'needsOutcome' && suggestedFocus === 'All prepped! 🎉' && (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {suggestedFocus}
            </span>
          )}
          {timeRange === 'needsOutcome' && items.length > 0 && (
            <span className="text-muted-foreground">Log outcomes to keep your pipeline accurate.</span>
          )}
        </div>

        {/* Capped warning */}
        {isCapped && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Showing first 200 results. Narrow your date range for complete data.</span>
          </div>
        )}

        {/* Tabs */}
        {!fixedTimeRange && (
          <UpcomingIntrosFilters
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />
        )}

        {/* Week day pills */}
        {isWeekView && dayGroups.length > 1 && (
          <div className="flex gap-1 overflow-x-auto pb-1">
            {dayGroups.map(g => {
              const d = new Date(g.date + 'T12:00:00');
              const dayLabel = format(d, 'EEE');
              const dateLabel = format(d, 'M/d');
              const isActive = selectedWeekDay === g.date;
              const todayDate = format(new Date(), 'yyyy-MM-dd');
              const isDayToday = g.date === todayDate;
              return (
                <button
                  key={g.date}
                  onClick={() => setSelectedWeekDay(g.date)}
                  className={`flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : isDayToday
                        ? 'bg-card text-card-foreground border-primary/50 ring-1 ring-primary/30'
                        : 'bg-card text-card-foreground border-border hover:bg-muted'
                  }`}
                >
                  <span>{dayLabel}{isDayToday && !isActive ? ' •' : ''}</span>
                  <span className="text-[10px]">{dateLabel}</span>
                  <Badge variant={isActive ? 'secondary' : 'outline'} className="h-3.5 px-1 text-[9px] mt-0.5">
                    {g.items.length}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}

        {/* Day groups */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : dayGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            {timeRange === 'today' ? 'No intros scheduled for today' 
              : timeRange === 'restOfWeek' ? 'No intros this week'
              : 'No past intros need an outcome — you\'re all caught up!'}
          </p>
        ) : (
          <div className="space-y-4">
            {(isTodayView ? activeDayGroups : filteredDayGroups).map(group => (
              <IntroDayGroup
                key={group.date}
                group={group}
                isOnline={isOnline}
                userName={userName}
                onSendQ={handleSendQ}
                onConfirm={handleConfirm}
                onRefresh={refreshAll}
                needsOutcome={timeRange === 'needsOutcome'}
                confirmResults={confirmResults}
                focusedBookingId={focusedBookingId}
                expandedBookingId={expandedBookingId}
                onExpandCard={handleExpandCard}
                shoutoutMap={shoutoutMap}
              />
            ))}

            {/* Completed intros collapsed at bottom (Today view only) */}
            {isTodayView && completedItems.length > 0 && (
              <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors text-sm font-medium">
                    <span>Completed Intros ({completedItems.length})</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${completedOpen ? 'rotate-180' : ''}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-4">
                  {completedDayGroups.map(group => (
                    <IntroDayGroup
                      key={group.date}
                      group={group}
                      isOnline={isOnline}
                      userName={userName}
                      onSendQ={handleSendQ}
                      onConfirm={handleConfirm}
                      onRefresh={refreshAll}
                      needsOutcome={false}
                      confirmResults={confirmResults}
                      focusedBookingId={null}
                      expandedBookingId={expandedBookingId}
                      onExpandCard={handleExpandCard}
                      shoutoutMap={shoutoutMap}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
