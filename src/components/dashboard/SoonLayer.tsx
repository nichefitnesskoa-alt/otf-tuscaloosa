import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CalendarCheck, CalendarDays, Clock, ChevronDown, ChevronRight, TrendingUp, Users, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, startOfWeek, endOfWeek, parseISO } from 'date-fns';

interface DayAfterBooking {
  id: string;
  member_name: string;
  intro_time: string | null;
  coach_name: string;
  questionnaire_status: string | null;
  lead_source?: string;
}

interface UpcomingFollowUp {
  date: string;
  count: number;
  names: { name: string; leadSource: string | null }[];
}

interface WeeklySnapshot {
  introsBooked: number;
  introsCompleted: number;
  introsRemaining: number;
  leadsReceived: number;
  leadsContacted: number;
  followUpsDue: number;
  followUpsCompleted: number;
  purchases: number;
  noShows: number;
}

export function SoonLayer() {
  const [dayAfterBookings, setDayAfterBookings] = useState<DayAfterBooking[]>([]);
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<UpcomingFollowUp[]>([]);
  const [weeklySnapshot, setWeeklySnapshot] = useState<WeeklySnapshot | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const dayAfterTomorrow = format(addDays(new Date(), 2), 'yyyy-MM-dd');
  const dayAfterTomorrowLabel = format(addDays(new Date(), 2), 'EEEE MMM d');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const today = new Date();
    const tomorrow = format(addDays(today, 1), 'yyyy-MM-dd');
    const dat = format(addDays(today, 2), 'yyyy-MM-dd');
    const threeDaysOut = format(addDays(today, 3), 'yyyy-MM-dd');
    const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');

    // Parallel fetch
    const [datBookings, followUps, weekIntros, weekRuns, weekLeads, weekSales, weekNoShows, weekFuDone, weekFuDue] = await Promise.all([
      // Day-after-tomorrow bookings
      supabase
        .from('intros_booked')
        .select('id, member_name, intro_time, coach_name, lead_source')
        .eq('class_date', dat)
        .is('deleted_at', null)
        .is('vip_class_name', null)
        .neq('booking_status', 'Closed – Bought')
        .order('intro_time', { ascending: true }),

      // Upcoming follow-ups (next 3 days excluding today)
      supabase
        .from('follow_up_queue')
        .select('scheduled_date, person_name, booking_id')
        .eq('status', 'pending')
        .eq('is_vip', false)
        .gt('scheduled_date', format(today, 'yyyy-MM-dd'))
        .lte('scheduled_date', threeDaysOut)
        .order('scheduled_date', { ascending: true }),

      // Weekly intros booked
      supabase
        .from('intros_booked')
        .select('id, class_date', { count: 'exact' })
        .gte('class_date', weekStart)
        .lte('class_date', weekEnd)
        .is('deleted_at', null)
        .is('vip_class_name', null),

      // Weekly intros run
      supabase
        .from('intros_run')
        .select('id', { count: 'exact' })
        .gte('run_date', weekStart)
        .lte('run_date', weekEnd),

      // Weekly leads
      supabase
        .from('leads')
        .select('id, stage', { count: 'exact' })
        .gte('created_at', weekStart + 'T00:00:00'),

      // Weekly sales
      supabase
        .from('intros_run')
        .select('id', { count: 'exact' })
        .gte('run_date', weekStart)
        .lte('run_date', weekEnd)
        .not('result', 'in', '("Didn\'t Buy","No-show")'),

      // Weekly no-shows
      supabase
        .from('intros_run')
        .select('id', { count: 'exact' })
        .gte('run_date', weekStart)
        .lte('run_date', weekEnd)
        .eq('result', 'No-show'),

      // Follow-ups completed this week
      supabase
        .from('follow_up_queue')
        .select('id', { count: 'exact' })
        .in('status', ['sent', 'converted'])
        .gte('sent_at', weekStart + 'T00:00:00'),

      // Follow-ups due this week
      supabase
        .from('follow_up_queue')
        .select('id', { count: 'exact' })
        .eq('status', 'pending')
        .gte('scheduled_date', weekStart)
        .lte('scheduled_date', weekEnd),
    ]);

    // Day-after-tomorrow
    if (datBookings.data) {
      const ids = datBookings.data.map(b => b.id);
      const { data: qs } = ids.length > 0
        ? await supabase.from('intro_questionnaires').select('booking_id, status').in('booking_id', ids)
        : { data: [] };
      const qMap = new Map((qs || []).map(q => [q.booking_id, q.status]));
      setDayAfterBookings(datBookings.data.map(b => ({
        ...b,
        lead_source: (b as any).lead_source || undefined,
        questionnaire_status: qMap.get(b.id) || null,
      })));
    }

    // Upcoming follow-ups grouped by day with lead source
    if (followUps.data) {
      // Fetch lead_source from intros_booked for booking IDs
      const fuBookingIds = [...new Set(followUps.data.map((f: any) => f.booking_id).filter(Boolean))] as string[];
      let fuLeadSourceMap = new Map<string, string>();
      if (fuBookingIds.length > 0) {
        const { data: fuBookings } = await supabase
          .from('intros_booked')
          .select('id, lead_source')
          .in('id', fuBookingIds);
        if (fuBookings) {
          fuLeadSourceMap = new Map(fuBookings.map(b => [b.id, b.lead_source]));
        }
      }

      const grouped = new Map<string, { name: string; leadSource: string | null }[]>();
      for (const fu of followUps.data as any[]) {
        const date = fu.scheduled_date;
        if (!grouped.has(date)) grouped.set(date, []);
        grouped.get(date)!.push({
          name: fu.person_name,
          leadSource: fu.booking_id ? fuLeadSourceMap.get(fu.booking_id) || null : null,
        });
      }
      setUpcomingFollowUps(
        Array.from(grouped.entries()).map(([date, names]) => ({
          date,
          count: names.length,
          names,
        }))
      );
    }

    // Weekly snapshot
    const leadsData = weekLeads.data || [];
    const leadsContacted = leadsData.filter(l => l.stage !== 'new').length;
    const introsBookedCount = weekIntros.count || 0;
    const introsCompletedCount = weekRuns.count || 0;

    setWeeklySnapshot({
      introsBooked: introsBookedCount,
      introsCompleted: introsCompletedCount,
      introsRemaining: Math.max(0, introsBookedCount - introsCompletedCount),
      leadsReceived: leadsData.length,
      leadsContacted,
      followUpsDue: (weekFuDue.count || 0) + (weekFuDone.count || 0),
      followUpsCompleted: weekFuDone.count || 0,
      purchases: weekSales.count || 0,
      noShows: weekNoShows.count || 0,
    });
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const qCompletedCount = dayAfterBookings.filter(b =>
    b.questionnaire_status === 'submitted' || b.questionnaire_status === 'completed'
  ).length;
  const qPendingCount = dayAfterBookings.length - qCompletedCount;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Coming Up</p>

      {/* Day After Tomorrow */}
      {dayAfterBookings.length > 0 && (
        <Collapsible open={expandedSections.has('dat')} onOpenChange={() => toggleSection('dat')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-2 cursor-pointer">
                <CardTitle className="text-sm flex items-center gap-2">
                  {expandedSections.has('dat') ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  <CalendarDays className="w-4 h-4 text-info" />
                  {dayAfterTomorrowLabel}
                  <Badge variant="secondary" className="text-[10px] ml-auto">
                    {dayAfterBookings.length} intros
                  </Badge>
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CardContent className="pt-0 pb-3">
              <p className="text-xs text-muted-foreground">
                {qCompletedCount} Q completed, {qPendingCount} pending
              </p>
              <CollapsibleContent>
                <div className="space-y-1.5 mt-2">
                  {dayAfterBookings.map(b => (
                    <div key={b.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-muted/30 gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-medium truncate">{b.member_name}</span>
                        {b.lead_source && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 shrink-0">{b.lead_source}</Badge>
                        )}
                      </div>
                      <span className="text-muted-foreground shrink-0">
                        {b.intro_time ? format(parseISO(`2000-01-01T${b.intro_time}`), 'h:mm a') : 'TBD'} · {b.coach_name}
                      </span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </CardContent>
          </Card>
        </Collapsible>
      )}

      {/* Upcoming Follow-Ups */}
      {upcomingFollowUps.length > 0 && (
        <Collapsible open={expandedSections.has('fu')} onOpenChange={() => toggleSection('fu')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-2 cursor-pointer">
                <CardTitle className="text-sm flex items-center gap-2">
                  {expandedSections.has('fu') ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  <Clock className="w-4 h-4 text-warning" />
                  Upcoming Follow-Ups
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CardContent className="pt-0 pb-3 space-y-1">
              {upcomingFollowUps.map(fu => (
                <div key={fu.date} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {format(parseISO(fu.date), 'EEEE')}:
                  </span>
                  <span className="font-medium">{fu.count} follow-up{fu.count !== 1 ? 's' : ''} due</span>
                </div>
              ))}
              <CollapsibleContent>
                <div className="space-y-1 mt-1.5 pt-1.5 border-t">
                  {upcomingFollowUps.map(fu => (
                    <div key={fu.date + '-names'}>
                      <p className="text-[10px] font-medium text-muted-foreground">{format(parseISO(fu.date), 'EEEE MMM d')}</p>
                      {fu.names.map((item, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs pl-2">
                          <span>{item.name}</span>
                          {item.leadSource && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">{item.leadSource}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </CardContent>
          </Card>
        </Collapsible>
      )}

      {/* Weekly Pipeline Snapshot */}
      {weeklySnapshot && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Intros</span>
                <span className="font-medium">{weeklySnapshot.introsCompleted}/{weeklySnapshot.introsBooked}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Purchases</span>
                <span className="font-medium text-emerald-700">{weeklySnapshot.purchases}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Leads</span>
                <span className="font-medium">{weeklySnapshot.leadsContacted}/{weeklySnapshot.leadsReceived}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">No-shows</span>
                <span className="font-medium text-destructive">{weeklySnapshot.noShows}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Follow-ups</span>
                <span className="font-medium">{weeklySnapshot.followUpsCompleted}/{weeklySnapshot.followUpsDue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Remaining</span>
                <span className="font-medium">{weeklySnapshot.introsRemaining} intros</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
