/**
 * EventsIndexPanel — every event on one screen.
 *
 * Reuses the exact same computation as EventCohortPanel:
 *  - same intros_booked query shape (event_id, not deleted)
 *  - same canon-field counts (booking_status_canon for showed/no-show)
 *  - same isCloseRun helper for "bought"
 * Aggregates per event_id and renders one row per event with totals
 * + cost. Tap a row to open that event's existing cohort view (the
 * row hands the eventId to the parent which drives EventCohortPanel).
 *
 * No new totals logic. No fake revenue/ROI.
 */
import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ListChecks, CalendarDays, DollarSign, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEvents, formatEventDateLocal, type EventRow } from '@/hooks/useEvents';
import { isCloseRun } from '@/lib/intros/close-detection';

interface TaggedBookingRow {
  id: string;
  event_id: string;
  booking_status_canon: string;
  intros_run: Array<{
    id: string;
    result: string | null;
    result_canon: string | null;
    buy_date: string | null;
    membership_type: string | null;
  }> | null;
}

function useAllEventTaggedBookings() {
  return useQuery<TaggedBookingRow[]>({
    queryKey: ['event-cohort', 'all-tagged'],
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intros_booked')
        .select('id, event_id, booking_status_canon, intros_run(id, result, result_canon, buy_date, membership_type)' as any)
        .not('event_id', 'is', null)
        .is('deleted_at', null);
      if (error) throw error;
      return (data as any[]) as TaggedBookingRow[];
    },
  });
}

interface EventTotals {
  booked: number;
  showed: number;
  noShow: number;
  bought: number;
}

function emptyTotals(): EventTotals {
  return { booked: 0, showed: 0, noShow: 0, bought: 0 };
}

interface Props {
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
}

export function EventsIndexPanel({ selectedEventId, onSelectEvent }: Props) {
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const { data: tagged = [], isLoading: bookingsLoading } = useAllEventTaggedBookings();
  const queryClient = useQueryClient();

  // Realtime: keep the events index totals coherent with Pipeline writes
  // (new event-tagged booking, outcome flip, soft-delete).
  useEffect(() => {
    const channel = supabase
      .channel('events-index-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intros_booked' },
        () => queryClient.invalidateQueries({ queryKey: ['event-cohort'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intros_run' },
        () => queryClient.invalidateQueries({ queryKey: ['event-cohort'] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const totalsByEvent = useMemo(() => {
    const map = new Map<string, EventTotals>();
    for (const b of tagged) {
      if (!b.event_id) continue;
      const t = map.get(b.event_id) || emptyTotals();
      t.booked += 1;
      if (b.booking_status_canon === 'SHOWED') t.showed += 1;
      if (b.booking_status_canon === 'NO_SHOW') t.noShow += 1;
      const runs = b.intros_run || [];
      if (runs.some(r => isCloseRun(r as any))) t.bought += 1;
      map.set(b.event_id, t);
    }
    return map;
  }, [tagged]);

  const sortedEvents = useMemo(() => {
    // Most recent event_date first; already sorted by useEvents desc, but be explicit
    return [...events].sort((a, b) => (a.event_date < b.event_date ? 1 : a.event_date > b.event_date ? -1 : 0));
  }, [events]);

  const grandTotals = useMemo(() => {
    const t = emptyTotals();
    for (const v of totalsByEvent.values()) {
      t.booked += v.booked;
      t.showed += v.showed;
      t.noShow += v.noShow;
      t.bought += v.bought;
    }
    return t;
  }, [totalsByEvent]);

  const loading = eventsLoading || bookingsLoading;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ListChecks className="w-4 h-4" />
          All events
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Every event with its cost and cohort totals. Tap a row to open that event's cohort below.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Loading…
          </p>
        ) : sortedEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No events yet.</p>
        ) : (
          <>
            <div className="rounded-lg border bg-muted/30 p-2.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium">All events combined:</span>
              <Badge variant="outline">{grandTotals.booked} booked</Badge>
              <Badge variant="outline" className="border-success/50 text-success">{grandTotals.showed} showed</Badge>
              <Badge variant="outline" className="border-muted-foreground/50">{grandTotals.noShow} no-show</Badge>
              <Badge variant="outline" className="border-primary/50 text-primary">{grandTotals.bought} bought</Badge>
            </div>

            <div className="space-y-1.5">
              {sortedEvents.map((e: EventRow) => {
                const t = totalsByEvent.get(e.id) || emptyTotals();
                const isSelected = selectedEventId === e.id;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onSelectEvent(e.id)}
                    className={`w-full text-left rounded-lg border p-3 transition flex items-center justify-between gap-3 cursor-pointer hover:border-primary hover:bg-accent ${isSelected ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{e.name}</span>
                        {!e.is_active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {formatEventDateLocal(e.event_date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {e.cost_cents != null
                            ? `$${(e.cost_cents / 100).toFixed(2)}`
                            : <span className="italic">cost not set</span>}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge variant="outline" className="text-[10px]">{t.booked} booked</Badge>
                        <Badge variant="outline" className="text-[10px] border-success/50 text-success">{t.showed} showed</Badge>
                        <Badge variant="outline" className="text-[10px] border-muted-foreground/50">{t.noShow} no-show</Badge>
                        <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">{t.bought} bought</Badge>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
