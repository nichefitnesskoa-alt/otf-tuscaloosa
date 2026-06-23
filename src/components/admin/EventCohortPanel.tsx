/**
 * EventCohortPanel — pick an event, see every person tagged to it.
 *
 * Reuses the canonical PersonJourneyCard for per-person detail
 * (don't rebuild journey logic). Counts come from canon fields
 * + canonical helpers (didIntroActuallyRun, isCloseRun, buy_date).
 * No revenue/ROI — real counts vs cost only.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, CalendarDays, DollarSign, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEvents, formatEventDateLocal } from '@/hooks/useEvents';
import { PersonJourneyCard } from '@/components/person/PersonJourneyCard';
import { isCloseRun } from '@/lib/intros/close-detection';
import { parseLocalDate } from '@/lib/utils';
import { format } from 'date-fns';

interface CohortBookingRow {
  id: string;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  booking_status_canon: string;
  coach_name: string | null;
  phone: string | null;
  email: string | null;
  deleted_at: string | null;
  runs: Array<{
    id: string;
    result: string | null;
    result_canon: string | null;
    buy_date: string | null;
    membership_type: string | null;
  }>;
}

function useCohort(eventId: string | null) {
  return useQuery<CohortBookingRow[]>({
    queryKey: ['event-cohort', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intros_booked')
        .select('id, member_name, class_date, intro_time, booking_status_canon, coach_name, phone, email, deleted_at, intros_run(id, result, result_canon, buy_date, membership_type)' as any)
        .eq('event_id', eventId!)
        .is('deleted_at', null);
      if (error) throw error;
      return ((data as any[]) || []).map(r => ({
        ...r,
        runs: (r.intros_run as any[]) || [],
      }));
    },
  });
}

interface SelectedPerson {
  memberName: string;
  phone: string | null;
  email: string | null;
}

interface EventCohortPanelProps {
  eventId?: string | null;
  onEventIdChange?: (id: string | null) => void;
}

export function EventCohortPanel({ eventId: controlledEventId, onEventIdChange }: EventCohortPanelProps = {}) {
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const [internalEventId, setInternalEventId] = useState<string | null>(null);
  const isControlled = controlledEventId !== undefined;
  const eventId = isControlled ? controlledEventId : internalEventId;
  const setEventId = (id: string | null) => {
    if (!isControlled) setInternalEventId(id);
    onEventIdChange?.(id);
  };
  const { data: cohort = [], isLoading: cohortLoading } = useCohort(eventId);
  const [selectedPerson, setSelectedPerson] = useState<SelectedPerson | null>(null);

  const selectedEvent = events.find(e => e.id === eventId);

  const totals = useMemo(() => {
    const booked = cohort.length;
    const showed = cohort.filter(b => b.booking_status_canon === 'SHOWED').length;
    const noShow = cohort.filter(b => b.booking_status_canon === 'NO_SHOW').length;
    const bought = cohort.filter(b => b.runs.some(r => isCloseRun(r as any))).length;
    return { booked, showed, noShow, bought };
  }, [cohort]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4" />
          Event Cohort
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Pick an event to see who got tagged, who showed up, who bought.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={eventId || ''} onValueChange={v => { setEventId(v || null); setSelectedPerson(null); }}>
          <SelectTrigger>
            <SelectValue placeholder={eventsLoading ? 'Loading…' : 'Select an event…'} />
          </SelectTrigger>
          <SelectContent>
            {events.map(e => (
              <SelectItem key={e.id} value={e.id}>
                {e.name} — {formatEventDateLocal(e.event_date)}{!e.is_active ? ' (inactive)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedEvent && (
          <>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <div className="font-semibold text-sm">{selectedEvent.name}</div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {formatEventDateLocal(selectedEvent.event_date)}</span>
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  {selectedEvent.cost_cents != null ? `Cost: $${(selectedEvent.cost_cents / 100).toFixed(2)}` : <span className="italic">no cost set</span>}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge variant="outline">{totals.booked} booked</Badge>
                <Badge variant="outline" className="border-success/50 text-success">{totals.showed} showed</Badge>
                <Badge variant="outline" className="border-muted-foreground/50">{totals.noShow} no-show</Badge>
                <Badge variant="outline" className="border-primary/50 text-primary">{totals.bought} bought</Badge>
              </div>
            </div>

            {cohortLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center"><Loader2 className="w-4 h-4 animate-spin inline mr-1" />Loading cohort…</p>
            ) : cohort.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nobody tagged to this event yet.</p>
            ) : (
              <div className="space-y-1.5">
                {cohort.map(b => {
                  const sold = b.runs.find(r => isCloseRun(r as any));
                  const showedLabel = b.booking_status_canon === 'SHOWED' ? 'Showed' :
                    b.booking_status_canon === 'NO_SHOW' ? 'No-show' :
                    b.booking_status_canon === 'CANCELLED' ? 'Cancelled' : 'Booked';
                  return (
                    <button
                      key={b.id}
                      className="w-full text-left rounded-lg border hover:border-primary hover:bg-accent p-2.5 transition flex items-center justify-between gap-2"
                      onClick={() => setSelectedPerson({ memberName: b.member_name, phone: b.phone, email: b.email })}
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{b.member_name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {format(parseLocalDate(b.class_date) || new Date(b.class_date), 'MMM d, yyyy')}
                          {b.coach_name ? ` · ${b.coach_name}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="outline" className="text-[10px]">{showedLabel}</Badge>
                        {sold && (
                          <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">
                            Bought{sold.buy_date ? ` ${format(parseLocalDate(sold.buy_date) || new Date(sold.buy_date), 'M/d')}` : ''}
                          </Badge>
                        )}
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {selectedPerson && (
          <PersonJourneyCard
            open={!!selectedPerson}
            onOpenChange={open => { if (!open) setSelectedPerson(null); }}
            identifier={{
              name: selectedPerson.memberName,
              phone: selectedPerson.phone,
              email: selectedPerson.email,
            }}
            scopeBadge={`Event · ${selectedEvent?.name || ''}`}
          />
        )}
      </CardContent>
    </Card>
  );
}
