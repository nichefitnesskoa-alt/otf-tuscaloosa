import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, CheckCircle, AlertTriangle, LogOut, User, Sun, Moon, Eye } from 'lucide-react';

import { useDarkMode } from '@/hooks/useDarkMode';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, startOfWeek, endOfWeek, addWeeks, isToday, isBefore, parseISO } from 'date-fns';
import { CoachIntroCard } from '@/components/coach/CoachIntroCard';
import { TheSystemSection } from '@/components/coach/TheSystemSection';
import { CoachingScripts } from '@/components/coach/CoachingScripts';
import { CollapsibleSection } from '@/components/dashboard/CollapsibleSection';
import { CLASS_TIME_LABELS } from '@/types';
import WeekDayTabs, { useWeekDays, getDefaultSelectedDate } from '@/components/shared/WeekDayTabs';
import { getTodayYMD } from '@/lib/dateUtils';

function formatTime(t: string) {
  if (t === 'TBD') return 'TBD';
  const key = t.substring(0, 5);
  return CLASS_TIME_LABELS[key] || key;
}

function isClassTimePastStatic(classDate: string, classTime: string | null, todayStr: string) {
  const dateObj = parseISO(classDate);
  if (isBefore(dateObj, parseISO(todayStr)) && !isToday(dateObj)) return true;
  if (!isToday(dateObj)) return false;
  if (!classTime) return false;
  const now = new Date();
  const [h, m] = classTime.split(':').map(Number);
  const classEnd = new Date(); classEnd.setHours(h, m + 60, 0, 0);
  return now > classEnd;
}

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
  coach_debrief_submitted?: boolean;
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

  // Week navigation
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() => getDefaultSelectedDate(0));
  const weekData = useWeekDays(weekOffset);
  const todayStr = getTodayYMD();

  useEffect(() => {
    setSelectedDate(getDefaultSelectedDate(weekOffset));
  }, [weekOffset]);

  const initialLoadDone = useRef(false);

  const fetchBookings = async (isRefetch = false) => {
    if (!isRefetch) setLoading(true);

    let query = supabase
      .from('intros_booked')
      .select('id, member_name, class_date, intro_time, coach_name, lead_source, intro_owner, originating_booking_id, sa_buying_criteria, sa_objection, shoutout_consent, coach_notes, booking_status_canon, is_vip, deleted_at, last_edited_by, last_edited_at, questionnaire_status_canon, coach_brief_five_vision, coach_shoutout_start, coach_shoutout_end, coach_referral_asked, coach_referral_names, coach_debrief_submitted' as any)
      .gte('class_date', weekData.weekStart)
      .lte('class_date', weekData.weekEnd)
      .is('deleted_at', null)
      .not('booking_status_canon', 'in', '("DELETED_SOFT","CANCELLED","PLANNING_RESCHEDULE")')
      .not('booking_type_canon', 'in', '("VIP","COMP")');

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

  useEffect(() => { fetchBookings(); }, [coachName, isAdmin, weekData.weekStart, weekData.weekEnd]);

  useEffect(() => {
    const channel = supabase
      .channel('coach-view-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intros_booked' }, () => fetchBookings(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [coachName, isAdmin, weekData.weekStart, weekData.weekEnd]);

  const filteredBookings = useMemo(() => {
    const EXCLUDED_STATUSES = ['DELETED_SOFT', 'CANCELLED', 'PLANNING_RESCHEDULE'];
    let result = bookings.filter(b => !b.is_vip && !b.deleted_at && !EXCLUDED_STATUSES.includes(b.booking_status_canon));
    if (coachFilter !== 'all') {
      result = result.filter(b => b.coach_name === coachFilter);
    }
    return result;
  }, [bookings, coachFilter]);

  // Day counts for tab badges
  const dayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of filteredBookings) {
      counts[b.class_date] = (counts[b.class_date] || 0) + 1;
    }
    return counts;
  }, [filteredBookings]);

  // Bookings for selected day only
  const selectedDayBookings = useMemo(() => {
    return filteredBookings.filter(b => b.class_date === selectedDate);
  }, [filteredBookings, selectedDate]);

  // All unique coach names for filter
  const allCoachNames = useMemo(() => {
    const names = new Set(bookings.filter(b => !b.is_vip && !b.deleted_at && b.coach_name).map(b => b.coach_name));
    return Array.from(names).filter(n => n.length > 0).sort();
  }, [bookings]);

  // Group selected day by time
  const groupedByTime = useMemo(() => {
    const map = new Map<string, CoachBooking[]>();
    selectedDayBookings.forEach(b => {
      const time = b.intro_time || 'TBD';
      if (!map.has(time)) map.set(time, []);
      map.get(time)!.push(b);
    });
    return map;
  }, [selectedDayBookings]);

  // formatTime moved to module scope

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
    if (isBefore(dateObj, parseISO(todayStr)) && !isToday(dateObj)) return true;
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

  const selectedIsToday = selectedDate === todayStr;
  const selectedDayLabel = selectedIsToday ? 'Today' : format(new Date(selectedDate + 'T12:00:00'), 'EEEE');

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

      {isAdmin && (
        <>
          <TheSystemSection />
          <CollapsibleSection
            id="coaching-scripts"
            title="Coaching Scripts"
            icon={<span>📋</span>}
            defaultOpen={false}
          >
            <CoachingScripts />
          </CollapsibleSection>
        </>
      )}

      {/* Intros content */}
      <div className="space-y-3">
          {/* Week day tabs */}
          <WeekDayTabs
            weekOffset={weekOffset}
            onWeekOffsetChange={setWeekOffset}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            dayCounts={dayCounts}
          />

          {/* Coach filter */}
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

          {/* Selected day content */}
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : selectedDayBookings.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 italic">No intros scheduled for {selectedDayLabel}.</p>
          ) : (
            <div className="space-y-3">
              {Array.from(groupedByTime.entries()).map(([time, intros]) => {
                const isCurrent = isClassTimeNow(selectedDate, time === 'TBD' ? null : time);
                const isPast = isClassTimePast(selectedDate, time === 'TBD' ? null : time);
                const shouldDefaultOpen = selectedIsToday ? !isPast : true;
                const coachNames = [...new Set(intros.map(i => i.coach_name))].join(', ');

                return (
                  <Collapsible key={`${selectedDate}-${time}`} defaultOpen={shouldDefaultOpen}>
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
                        onUpdateBooking={handleUpdateBooking}
                        userName={user?.name || ''}
                        autoExpand={selectedIsToday}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
}

// ── Per-class-time: expandable card list (accordion — one at a time) ──
function ClassTimeIntroSelector({
  intros, questionnaires, onUpdateBooking, userName, autoExpand = true,
}: {
  intros: CoachBooking[];
  questionnaires: QuestionnaireMap;
  onUpdateBooking: (id: string, updates: Partial<CoachBooking>) => void;
  userName: string;
  autoExpand?: boolean;
}) {
  // Auto-expand: find next upcoming intro (only when autoExpand is true / today)
  const [expandedId, setExpandedId] = useState<string | null>(() => {
    if (!autoExpand) return null;
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
              style={{ minHeight: '44px' }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-sm">{intro.member_name}</span>
                  <Badge variant={isSecondIntro ? 'secondary' : 'default'} className="text-[10px] px-1.5 py-0 h-4">
                    {isSecondIntro ? '2nd Intro' : '1st Intro'}
                  </Badge>
                  {isQComplete ? (
                    <Badge className="text-[9px] px-1.5 py-0 h-4 bg-success text-white border-transparent">Questionnaire Complete</Badge>
                  ) : (
                    <Badge className="text-[9px] px-1.5 py-0 h-4 bg-destructive text-white border-transparent">No Questionnaire</Badge>
                  )}
                  {intro.coach_debrief_submitted === true && (
                    <Badge className="text-[9px] px-1.5 py-0 h-4 bg-success text-white border-transparent">Debrief ✓</Badge>
                  )}
                  {intro.coach_debrief_submitted !== true && isClassTimePastStatic(intro.class_date, intro.intro_time, getTodayYMD()) && (
                    <Badge className="text-[9px] px-1.5 py-0 h-4 bg-warning text-white border-transparent">Debrief needed</Badge>
                  )}
                  {intro.shoutout_consent === true && (
                    <Badge className="text-[9px] px-1.5 py-0 h-4 bg-success/20 text-success border-transparent">Shoutout ✓</Badge>
                  )}
                  {intro.shoutout_consent === false && (
                    <Badge className="text-[9px] px-1.5 py-0 h-4 bg-destructive/20 text-destructive border-transparent">Shoutout ✗</Badge>
                  )}
                  {intro.shoutout_consent == null && (
                    <Badge className="text-[9px] px-1.5 py-0 h-4 bg-muted text-muted-foreground border-transparent">Shoutout?</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                  <span>{intro.intro_time ? formatTime(intro.intro_time.substring(0, 5)) : 'TBD'}</span>
                  <span>·</span>
                  <span>Coach: {intro.coach_name}</span>
                </div>
              </div>
              <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform shrink-0", isExpanded && "rotate-180")} />
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