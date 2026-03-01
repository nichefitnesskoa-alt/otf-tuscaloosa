/**
 * Upcoming Intros Card: calm, positive daily workflow.
 * Two tabs: Today / Rest of week.
 * No at-risk banners, no scary styling.
 * Cards show Prep | Script | Coach buttons.
 * Today view: completed intros collapsed at bottom.
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
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

interface UpcomingIntrosCardProps {
  userName: string;
  /** If provided, locks the component to this range (no tab selector shown) */
  fixedTimeRange?: TimeRange;
}

export default function UpcomingIntrosCard({ userName, fixedTimeRange }: UpcomingIntrosCardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>(fixedTimeRange ?? 'today');
  const [confirmResults, setConfirmResults] = useState<Record<string, string>>({});

  const { items, isLoading, lastSyncAt, isOnline, isCapped, refreshAll } = useUpcomingIntrosData({
    timeRange,
  });

  // Fetch confirmation reflection results for Unconfirmed badge
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

  // Split completed vs active intros for Today view
  const isTodayView = fixedTimeRange === 'today' || timeRange === 'today';
  const { activeItems, completedItems } = useMemo(() => {
    if (!isTodayView) return { activeItems: items, completedItems: [] };
    return {
      activeItems: items.filter(i => !i.latestRunResult),
      completedItems: items.filter(i => !!i.latestRunResult),
    };
  }, [items, isTodayView]);
  const activeDayGroups = useMemo(() => groupByDay(activeItems), [activeItems]);
  const completedDayGroups = useMemo(() => groupByDay(completedItems), [completedItems]);
  const [completedOpen, setCompletedOpen] = useState(false);

  // Compute focused booking: nearest today's intro within 2 hours
  const todayStr = format(new Date(), 'yyyy-MM-dd');
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

  // Reset selected day when day groups change
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

  const handleSendQ = useCallback(async (bookingId: string) => {
    if (!isOnline) { toast.error('Offline'); return; }
    const item = items.find(i => i.bookingId === bookingId);
    if (!item) return;
    const PUBLISHED_URL = 'https://otf-tuscaloosa.lovable.app';
    try {
      // Ensure questionnaire exists for this booking
      const { data: existing } = await supabase
        .from('intro_questionnaires')
        .select('id, slug')
        .eq('booking_id', bookingId)
        .maybeSingle();

      let slug: string;
      let qId: string;

      if (existing) {
        qId = existing.id;
        // If existing slug already has the new name-date format, use it; else regenerate
        const existingSlug = (existing as any).slug;
        const hasNewFormat = existingSlug && /[a-z]{3}\d{1,2}(-\d+)?$/.test(existingSlug);
        if (hasNewFormat) {
          slug = existingSlug;
        } else {
          // Backfill slug to new name-date format
          const nameParts = item.memberName.trim().split(/\s+/);
          const firstName = nameParts[0] || item.memberName;
          const lastName = nameParts.slice(1).join(' ') || '';
          const newSlug = generateSlug(firstName, lastName, item.classDate);
          await supabase.from('intro_questionnaires').update({ slug: newSlug } as any).eq('id', qId);
          slug = newSlug;
        }
        // Mark as sent if not already sent/completed
        await supabase
          .from('intro_questionnaires')
          .update({ status: 'sent' })
          .eq('id', qId)
          .not('status', 'in', '("completed","submitted","sent")');
      } else {
        // Create new questionnaire record
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
        {/* Summary strip */}
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

        {/* Tabs: Today / Rest of week / Needs Outcome — hidden when range is fixed */}
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
              const isToday = g.date === format(new Date(), 'yyyy-MM-dd');
              return (
                <button
                  key={g.date}
                  onClick={() => setSelectedWeekDay(g.date)}
                  className={`flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : isToday
                        ? 'bg-accent/60 text-accent-foreground border-primary/50 ring-1 ring-primary/30'
                        : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  <span>{dayLabel}{isToday && !isActive ? ' •' : ''}</span>
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
            {/* Active intros (or all intros if not today view) */}
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
