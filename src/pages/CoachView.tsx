import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfWeek, endOfWeek, isToday, isBefore, parseISO } from 'date-fns';
import { CoachIntroCard } from '@/components/coach/CoachIntroCard';
import { TheSystemSection } from '@/components/coach/TheSystemSection';
import { CLASS_TIME_LABELS } from '@/types';

interface CoachBooking {
  id: string;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  coach_name: string;
  lead_source: string;
  intro_owner: string | null;
  originating_booking_id: string | null;
  sa_buying_criteria: string | null;
  sa_objection: string | null;
  shoutout_consent: boolean | null;
  coach_notes: string | null;
  booking_status_canon: string;
  is_vip: boolean;
  deleted_at: string | null;
  last_edited_by: string | null;
  last_edited_at: string | null;
}

interface QuestionnaireMap {
  [bookingId: string]: {
    q1_fitness_goal: string | null;
    q2_fitness_level: number | null;
    q3_obstacle: string | null;
    q5_emotional_driver: string | null;
    q6_weekly_commitment: string | null;
    q6b_available_days: string | null;
    q7_coach_notes: string | null;
  };
}

export default function CoachView() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const coachName = user?.name || '';

  const [tab, setTab] = useState('today');
  const [bookings, setBookings] = useState<CoachBooking[]>([]);
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireMap>({});
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const weekStart = useMemo(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'), []);
  const weekEnd = useMemo(() => format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'), []);

  // Fetch bookings
  const fetchBookings = async () => {
    setLoading(true);
    const dateStart = tab === 'today' ? today : weekStart;
    const dateEnd = tab === 'today' ? today : weekEnd;

    let query = supabase
      .from('intros_booked')
      .select('id, member_name, class_date, intro_time, coach_name, lead_source, intro_owner, originating_booking_id, sa_buying_criteria, sa_objection, shoutout_consent, coach_notes, booking_status_canon, is_vip, deleted_at, last_edited_by, last_edited_at' as any)
      .gte('class_date', dateStart)
      .lte('class_date', dateEnd)
      .is('deleted_at', null)
      .neq('booking_status_canon', 'DELETED_SOFT');

    if (!isAdmin) {
      query = query.eq('coach_name', coachName);
    }

    const { data } = await query.order('class_date').order('intro_time');
    const rows = (data || []) as unknown as CoachBooking[];
    setBookings(rows);

    // Fetch questionnaires for these bookings
    if (rows.length > 0) {
      const ids = rows.map(b => b.id);
      const { data: qs } = await supabase
        .from('intro_questionnaires')
        .select('booking_id, q1_fitness_goal, q2_fitness_level, q3_obstacle, q5_emotional_driver, q6_weekly_commitment, q6b_available_days, q7_coach_notes' as any)
        .in('booking_id', ids);
      const qMap: QuestionnaireMap = {};
      (qs || []).forEach((q: any) => {
        if (q.booking_id) qMap[q.booking_id] = q;
      });
      setQuestionnaires(qMap);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchBookings();
  }, [tab, coachName, isAdmin]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('coach-view-bookings')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'intros_booked',
      }, () => {
        fetchBookings();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tab, coachName, isAdmin]);

  // Filter out VIP and soft-deleted
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => !b.is_vip && !b.deleted_at);
  }, [bookings]);

  // Group by class_date, then by intro_time
  const groupedByDate = useMemo(() => {
    const map = new Map<string, Map<string, CoachBooking[]>>();
    filteredBookings.forEach(b => {
      const date = b.class_date;
      const time = b.intro_time || 'TBD';
      if (!map.has(date)) map.set(date, new Map());
      const timeMap = map.get(date)!;
      if (!timeMap.has(time)) timeMap.set(time, []);
      timeMap.get(time)!.push(b);
    });
    return map;
  }, [filteredBookings]);

  const formatTime = (t: string) => {
    if (t === 'TBD') return 'TBD';
    const key = t.substring(0, 5);
    return CLASS_TIME_LABELS[key] || key;
  };

  const isClassTimeNow = (classDate: string, classTime: string | null) => {
    if (!classTime || !isToday(parseISO(classDate))) return false;
    const now = new Date();
    const [h, m] = classTime.split(':').map(Number);
    const classStart = new Date();
    classStart.setHours(h, m, 0, 0);
    const classEnd = new Date(classStart.getTime() + 60 * 60 * 1000); // 1 hour
    return now >= classStart && now <= classEnd;
  };

  const isClassTimePast = (classDate: string, classTime: string | null) => {
    const dateObj = parseISO(classDate);
    if (isBefore(dateObj, parseISO(today)) && !isToday(dateObj)) return true;
    if (!isToday(dateObj)) return false;
    if (!classTime) return false;
    const now = new Date();
    const [h, m] = classTime.split(':').map(Number);
    const classEnd = new Date();
    classEnd.setHours(h, m + 60, 0, 0);
    return now > classEnd;
  };

  const handleUpdateBooking = (bookingId: string, updates: Partial<CoachBooking>) => {
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, ...updates } : b));
  };

  return (
    <div className="p-4 space-y-4" style={{ fontSize: '16px' }}>
      <h1 className="text-2xl font-bold">Coach View</h1>

      <TheSystemSection />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4">
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : filteredBookings.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No intros assigned today</p>
          ) : (
            <DateGroupView
              groupedByDate={groupedByDate}
              questionnaires={questionnaires}
              formatTime={formatTime}
              isClassTimeNow={isClassTimeNow}
              isClassTimePast={isClassTimePast}
              isAdmin={isAdmin}
              onUpdateBooking={handleUpdateBooking}
              userName={user?.name || ''}
              defaultExpanded
            />
          )}
        </TabsContent>

        <TabsContent value="week" className="mt-4">
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : filteredBookings.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No intros this week</p>
          ) : (
            <DateGroupView
              groupedByDate={groupedByDate}
              questionnaires={questionnaires}
              formatTime={formatTime}
              isClassTimeNow={isClassTimeNow}
              isClassTimePast={isClassTimePast}
              isAdmin={isAdmin}
              onUpdateBooking={handleUpdateBooking}
              userName={user?.name || ''}
              defaultExpanded={false}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Sub-component: renders date groups with time sections
function DateGroupView({
  groupedByDate, questionnaires, formatTime, isClassTimeNow, isClassTimePast, isAdmin, onUpdateBooking, userName, defaultExpanded,
}: {
  groupedByDate: Map<string, Map<string, CoachBooking[]>>;
  questionnaires: QuestionnaireMap;
  formatTime: (t: string) => string;
  isClassTimeNow: (date: string, time: string | null) => boolean;
  isClassTimePast: (date: string, time: string | null) => boolean;
  isAdmin: boolean;
  onUpdateBooking: (id: string, updates: Partial<CoachBooking>) => void;
  userName: string;
  defaultExpanded: boolean;
}) {
  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="space-y-6">
      {Array.from(groupedByDate.entries()).map(([date, timeMap]) => {
        const dateLabel = isToday(parseISO(date))
          ? 'Today'
          : format(parseISO(date), 'EEEE, MMM d');
        const isDateToday = date === today;

        return (
          <div key={date} className="space-y-3">
            {!defaultExpanded && (
              <h2 className="text-lg font-bold text-foreground border-b border-border pb-1">{dateLabel}</h2>
            )}
            {Array.from(timeMap.entries()).map(([time, intros]) => {
              const isCurrent = isClassTimeNow(date, time === 'TBD' ? null : time);
              const isPast = isClassTimePast(date, time === 'TBD' ? null : time);
              const shouldDefaultOpen = defaultExpanded || isDateToday ? !isPast : false;
              const coachNames = [...new Set(intros.map(i => i.coach_name))].join(', ');

              return (
                <Collapsible key={`${date}-${time}`} defaultOpen={shouldDefaultOpen}>
                  <CollapsibleTrigger className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left font-semibold transition-colors",
                    isCurrent
                      ? "bg-primary/20 border-2 border-primary text-foreground"
                      : "bg-muted/50 border border-border text-foreground hover:bg-muted"
                  )}>
                    <span className="text-base">
                      {formatTime(time)} — {intros.length} intro{intros.length !== 1 ? 's' : ''}
                      {isAdmin && <span className="text-muted-foreground font-normal"> — Coach: {coachNames}</span>}
                    </span>
                    <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 mt-3">
                    {intros.map(booking => (
                      <CoachIntroCard
                        key={booking.id}
                        booking={booking}
                        questionnaire={questionnaires[booking.id] || null}
                        onUpdateBooking={onUpdateBooking}
                        userName={userName}
                      />
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
