import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, CheckCircle, AlertTriangle, LogOut, User, Sun, Moon } from 'lucide-react';

import { useDarkMode } from '@/hooks/useDarkMode';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, startOfWeek, endOfWeek, isToday, isBefore, parseISO } from 'date-fns';
import { CoachIntroCard } from '@/components/coach/CoachIntroCard';
import { TheSystemSection } from '@/components/coach/TheSystemSection';
import { CoachingScripts } from '@/components/coach/CoachingScripts';
import { CollapsibleSection } from '@/components/dashboard/CollapsibleSection';
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
  questionnaire_status_canon?: string;
  coach_brief_five_vision?: string | null;
  coach_shoutout_start?: boolean | null;
  coach_shoutout_end?: boolean | null;
  coach_referral_asked?: boolean | null;
  coach_referral_names?: string | null;
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
  const { user, logout } = useAuth();
  const { isDark, toggle: toggleDark } = useDarkMode();
  const isAdmin = user?.role === 'Admin';
  const coachName = user?.name || '';

  const [bookings, setBookings] = useState<CoachBooking[]>([]);
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireMap>({});
  const [loading, setLoading] = useState(true);
  const [coachFilter, setCoachFilter] = useState<string>('all');

  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const weekStart = useMemo(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'), []);
  const weekEnd = useMemo(() => format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'), []);

  const initialLoadDone = useRef(false);

  const fetchBookings = async (isRefetch = false) => {
    if (!isRefetch) setLoading(true);
    const dateStart = today;
    const dateEnd = weekEnd;

    let query = supabase
      .from('intros_booked')
      .select('id, member_name, class_date, intro_time, coach_name, lead_source, intro_owner, originating_booking_id, sa_buying_criteria, sa_objection, shoutout_consent, coach_notes, booking_status_canon, is_vip, deleted_at, last_edited_by, last_edited_at, questionnaire_status_canon, coach_brief_five_vision, coach_shoutout_start, coach_shoutout_end, coach_referral_asked, coach_referral_names' as any)
      .gte('class_date', dateStart)
      .lte('class_date', dateEnd)
      .is('deleted_at', null)
      .neq('booking_status_canon', 'DELETED_SOFT');

    // All coaches see all intros — no coach_name filter

    const { data } = await query.order('class_date').order('intro_time');
    const rows = (data || []) as unknown as CoachBooking[];
    setBookings(rows);

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

    if (!isRefetch) setLoading(false);
    initialLoadDone.current = true;
  };

  useEffect(() => { fetchBookings(); }, [tab, coachName, isAdmin]);

  useEffect(() => {
    const channel = supabase
      .channel('coach-view-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intros_booked' }, () => fetchBookings(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tab, coachName, isAdmin]);

  const filteredBookings = useMemo(() => {
    let result = bookings.filter(b => !b.is_vip && !b.deleted_at);
    if (coachFilter !== 'all') {
      result = result.filter(b => b.coach_name === coachFilter);
    }
    return result;
  }, [bookings, coachFilter]);

  // All unique coach names for filter
  const allCoachNames = useMemo(() => {
    const names = new Set(bookings.filter(b => !b.is_vip && !b.deleted_at && b.coach_name).map(b => b.coach_name));
    return Array.from(names).filter(n => n.length > 0).sort();
  }, [bookings]);

  // Group by date → time
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
    const classStart = new Date(); classStart.setHours(h, m, 0, 0);
    const classEnd = new Date(classStart.getTime() + 60 * 60 * 1000);
    return now >= classStart && now <= classEnd;
  };

  const isClassTimePast = (classDate: string, classTime: string | null) => {
    const dateObj = parseISO(classDate);
    if (isBefore(dateObj, parseISO(today)) && !isToday(dateObj)) return true;
    if (!isToday(dateObj)) return false;
    if (!classTime) return false;
    const now = new Date();
    const [h, m] = classTime.split(':').map(Number);
    const classEnd = new Date(); classEnd.setHours(h, m + 60, 0, 0);
    return now > classEnd;
  };

  const handleUpdateBooking = (bookingId: string, updates: Partial<CoachBooking>) => {
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, ...updates } : b));
  };

  return (
    <div className="p-4 space-y-4" style={{ fontSize: '16px' }}>
      {/* ═══ HEADER — greeting + user + logout (Coach only; Admins use global Header) ═══ */}
      {user?.role === 'Coach' && (
        <div className="sticky top-0 z-20 bg-background border-b-2 border-primary px-4 py-3 shadow-sm -mx-4 -mt-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-bold leading-tight flex items-center gap-1.5">
                Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user?.name}! 👋
              </h1>
              <p className="text-xs text-muted-foreground">{format(new Date(), 'EEEE, MMMM d')}</p>
              <p className="text-xs text-muted-foreground">Your intro cards. Prep before class. Debrief after.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{user?.name}</span>
                <Badge className="bg-success text-success-foreground" variant="secondary">Coach</Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={toggleDark} className="text-muted-foreground h-8 w-8" title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <TheSystemSection />

      <CollapsibleSection
        id="coaching-scripts"
        title="Coaching Scripts"
        icon={<span>📋</span>}
        defaultOpen={false}
      >
        <CoachingScripts />
      </CollapsibleSection>

      {/* Coach filter — navigation only, not access restriction */}
      {allCoachNames.length > 0 && (
        <Select value={coachFilter} onValueChange={setCoachFilter}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="Filter by coach" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Coaches</SelectItem>
            {allCoachNames.map(name => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

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

// ── DateGroupView with name dropdown per class time ──
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
                      <span className="text-muted-foreground font-normal"> — Coach: {coachNames}</span>
                    </span>
                    <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <ClassTimeIntroSelector
                      intros={intros}
                      questionnaires={questionnaires}
                      onUpdateBooking={onUpdateBooking}
                      userName={userName}
                    />
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

// ── Per-class-time: expandable card list (accordion — one at a time) ──
function ClassTimeIntroSelector({
  intros, questionnaires, onUpdateBooking, userName,
}: {
  intros: CoachBooking[];
  questionnaires: QuestionnaireMap;
  onUpdateBooking: (id: string, updates: Partial<CoachBooking>) => void;
  userName: string;
}) {
  // Auto-expand: find next upcoming intro
  const [expandedId, setExpandedId] = useState<string | null>(() => {
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const todayActive = intros.filter(i => i.class_date === today && i.booking_status_canon === 'ACTIVE');
    if (todayActive.length === 0 && intros.length > 0) return intros[0].id;
    let bestId: string | null = null;
    let bestDiff = Infinity;
    for (const item of todayActive) {
      if (!item.intro_time) continue;
      try {
        const classStart = new Date(`${item.class_date}T${item.intro_time}:00`);
        const diff = classStart.getTime() - now.getTime();
        if (diff > 0 && diff < bestDiff) { bestDiff = diff; bestId = item.id; }
      } catch {}
    }
    if (!bestId && todayActive.length > 0) bestId = todayActive[todayActive.length - 1].id;
    return bestId || (intros.length > 0 ? intros[0].id : null);
  });

  const toggle = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-2">
      {intros.map(intro => {
        const isExpanded = expandedId === intro.id;
        const isSecondIntro = !!intro.originating_booking_id;
        const qStatus = intro.questionnaire_status_canon;
        const isQComplete = qStatus === 'completed' || qStatus === 'submitted';

        return (
          <div key={intro.id} className="rounded-lg border-2 border-border bg-card overflow-hidden">
            {/* Collapsed header — always visible */}
            <button
              type="button"
              onClick={() => toggle(intro.id)}
              className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-sm">{intro.member_name}</span>
                  <Badge variant={isSecondIntro ? 'secondary' : 'default'} className="text-[10px] px-1.5 py-0 h-4">
                    {isSecondIntro ? '2nd Intro' : '1st Intro'}
                  </Badge>
                  {isQComplete ? (
                    <Badge className="text-[9px] px-1.5 py-0 h-4 bg-[#16a34a] text-white border-transparent">Q Complete</Badge>
                  ) : (
                    <Badge className="text-[9px] px-1.5 py-0 h-4 bg-[#dc2626] text-white border-transparent">No Q</Badge>
                  )}
                  {/* Shoutout label */}
                  {intro.shoutout_consent === true && (
                    <span className="inline-flex items-center gap-1 text-[9px] text-success font-medium shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-success inline-block shrink-0" />
                      Shoutout ✓
                    </span>
                  )}
                  {intro.shoutout_consent === false && (
                    <span className="inline-flex items-center gap-1 text-[9px] text-destructive font-medium shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-destructive inline-block shrink-0" />
                      Shoutout ✗
                    </span>
                  )}
                  {intro.shoutout_consent == null && (
                    <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground font-medium shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40 inline-block shrink-0" />
                      Shoutout?
                    </span>
                  )}
                </div>
              </div>
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", isExpanded && "rotate-180")} />
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t border-border">
                <CoachIntroCard
                  booking={intro}
                  questionnaire={questionnaires[intro.id] || null}
                  onUpdateBooking={onUpdateBooking}
                  userName={userName}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
