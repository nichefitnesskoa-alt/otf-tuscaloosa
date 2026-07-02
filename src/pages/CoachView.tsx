import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, CheckCircle, AlertTriangle, LogOut, User, Sun, Moon, Eye } from 'lucide-react';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import { toast } from 'sonner';

import { useDarkMode } from '@/hooks/useDarkMode';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, startOfWeek, endOfWeek, addWeeks, isToday, isBefore, parseISO } from 'date-fns';
import { CoachIntroCard } from '@/components/coach/CoachIntroCard';
import { TheSystemSection } from '@/components/coach/TheSystemSection';
import { useJourneyCard } from '@/components/person/useJourneyCard';
import { OwnItMentionsCard } from '@/components/shared/OwnItMentionsCard';
import { CoachingScripts } from '@/components/coach/CoachingScripts';
import { CollapsibleSection } from '@/components/dashboard/CollapsibleSection';
import { CLASS_TIME_LABELS } from '@/types';
import WeekDayTabs, { useWeekDays, getDefaultSelectedDate } from '@/components/shared/WeekDayTabs';
import { getTodayYMD } from '@/lib/dateUtils';
import { isSecondIntroBooking, type SecondIntroBookingLike, type SecondIntroRunLike } from '@/lib/intros/secondIntroDetection';
import { loadIntroClassification } from '@/lib/intros/loadIntroClassification';

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
  coach_notes: string | null;
  booking_status_canon: string;
  is_vip: boolean;
  deleted_at: string | null;
  last_edited_by: string | null;
  last_edited_at: string | null;
  questionnaire_status_canon?: string;
  coach_brief_five_vision?: string | null;
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
  const isAdmin = user?.name === 'Koa';
  const isCoachLike = user?.role === 'Coach' || user?.role === 'Both';
  const coachName = user?.name || '';

  const [bookings, setBookings] = useState<CoachBooking[]>([]);
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireMap>({});
  const [parentBookings, setParentBookings] = useState<SecondIntroBookingLike[]>([]);
  const [parentRuns, setParentRuns] = useState<SecondIntroRunLike[]>([]);
  const [loading, setLoading] = useState(true);

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
      .select('id, member_name, class_date, intro_time, coach_name, lead_source, intro_owner, originating_booking_id, sa_buying_criteria, sa_objection, coach_notes, booking_status_canon, is_vip, deleted_at, last_edited_by, last_edited_at, questionnaire_status_canon, coach_brief_five_vision, coach_referral_asked, coach_referral_names, coach_debrief_submitted' as any)
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

      // Questionnaires + canonical 2nd-intro classification in parallel.
      // All parent fetching (bookings + runs) lives in loadIntroClassification
      // so every page agrees on the rule.
      const [qsRes, classification] = await Promise.all([
        supabase
          .from('intro_questionnaires')
          .select('booking_id, q1_fitness_goal, q2_fitness_level, q3_obstacle, q5_emotional_driver, q6_weekly_commitment, q6b_available_days, q7_coach_notes' as any)
          .in('booking_id', ids),
        loadIntroClassification(rows as any),
      ]);

      const qMap: QuestionnaireMap = {};
      (qsRes.data || []).forEach((q: any) => {
        if (q.booking_id) qMap[q.booking_id] = q;
      });
      setQuestionnaires(qMap);

      setParentBookings(classification.parentBookings);
      setParentRuns(classification.parentRuns);
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
    return bookings.filter(b => !b.is_vip && !b.deleted_at && !EXCLUDED_STATUSES.includes(b.booking_status_canon));
  }, [bookings]);

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
      <OwnItMentionsCard />
      {/* ═══ HEADER — greeting + user + logout (Coach only; Admins use global Header) ═══ */}
      {isCoachLike && (
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

      {isAdmin && <TheSystemSection />}

      {(isAdmin || user?.name === 'Jackson' || user?.permissions?.['feature.coaching_scripts'] === true) && (
        <CollapsibleSection
          id="workout-templates"
          title="Workout Templates With Class Times (Every Effort)"
          icon={<span>📋</span>}
          defaultOpen={false}
        >
          <CoachingScripts />
        </CollapsibleSection>
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
                        parentBookings={parentBookings}
                        parentRuns={parentRuns}
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
  intros, questionnaires, onUpdateBooking, userName, autoExpand = true, parentBookings = [], parentRuns = [],
}: {
  intros: CoachBooking[];
  questionnaires: QuestionnaireMap;
  onUpdateBooking: (id: string, updates: Partial<CoachBooking>) => void;
  userName: string;
  autoExpand?: boolean;
  parentBookings?: SecondIntroBookingLike[];
  parentRuns?: SecondIntroRunLike[];
}) {
  const journey = useJourneyCard();
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

  const { coaches } = useActiveStaff();
  const [savingCoachId, setSavingCoachId] = useState<string | null>(null);

  const changeCoach = async (bookingId: string, newCoach: string) => {
    setSavingCoachId(bookingId);
    // Optimistic
    onUpdateBooking(bookingId, { coach_name: newCoach } as any);
    const { error } = await supabase
      .from('intros_booked')
      .update({
        coach_name: newCoach,
        last_edited_at: new Date().toISOString(),
        last_edited_by: userName,
      } as any)
      .eq('id', bookingId);
    setSavingCoachId(null);
    if (error) {
      toast.error('Failed to update coach');
    } else {
      toast.success(`Coach set to ${newCoach}`);
    }
  };

  const CoachSelect = ({ intro }: { intro: CoachBooking }) => {
    const options = Array.from(new Set([...coaches, intro.coach_name].filter(Boolean))) as string[];
    return (
      <Select
        value={intro.coach_name || ''}
        onValueChange={(v) => changeCoach(intro.id, v)}
        disabled={savingCoachId === intro.id}
      >
        <SelectTrigger
          onClick={(e) => e.stopPropagation()}
          className="h-7 w-auto min-w-[110px] text-xs px-2 py-0 border-primary/30 text-primary bg-transparent"
        >
          <SelectValue placeholder="Set coach" />
        </SelectTrigger>
        <SelectContent onClick={(e) => e.stopPropagation()}>
          {options.map(c => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  return (
    <div className="space-y-2">
      {intros.map(intro => {
        // Canonical helper: a booking is only a 2nd intro if the parent
        // actually ran (not just status — also checks intros_run for no-shows
        // whose booking_status_canon never flipped).
        const isSecondIntro = isSecondIntroBooking(
          intro as any,
          [intro as any, ...parentBookings],
          parentRuns,
        );

        // 2nd intros render as a non-expandable stub — no card, no debrief, no lead measures
        if (isSecondIntro) {
          return (
            <div
              key={intro.id}
              className="rounded-lg border border-border bg-muted/40 px-3 py-2 flex items-center justify-between gap-2"
              style={{ minHeight: '44px' }}
            >
              <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); journey.openByBooking(intro.id); }}
                  className="font-semibold text-sm text-left hover:underline cursor-pointer"
                >
                  {intro.member_name}
                </button>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">2nd Intro</Badge>
                <span className="text-xs text-muted-foreground">
                  {intro.intro_time ? formatTime(intro.intro_time.substring(0, 5)) : 'TBD'} ·
                </span>
                <CoachSelect intro={intro} />
              </div>
            </div>
          );
        }

        const isExpanded = expandedId === intro.id;
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
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); journey.openByBooking(intro.id); }}
                    className="font-semibold text-sm text-left hover:underline cursor-pointer"
                  >
                    {intro.member_name}
                  </button>
                  <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">
                    1st Intro
                  </Badge>
                  {isQComplete ? (
                    <Badge className="text-[9px] px-1.5 py-0 h-4 bg-success-dim text-success border-transparent">Questionnaire Complete</Badge>
                  ) : (
                    <Badge className="text-[9px] px-1.5 py-0 h-4 bg-danger-dim text-danger border-transparent">No Questionnaire</Badge>
                  )}
                  {intro.coach_debrief_submitted === true && (
                    <Badge className="text-[9px] px-1.5 py-0 h-4 bg-success-dim text-success border-transparent">Debrief ✓</Badge>
                  )}
                  {intro.coach_debrief_submitted !== true && isClassTimePastStatic(intro.class_date, intro.intro_time, getTodayYMD()) && (
                    <Badge className="text-[9px] px-1.5 py-0 h-4 bg-warning-dim text-warning border-transparent">Debrief needed</Badge>
                  )}
                  {/* Shoutout badges removed — superseded by FV Scorecard */}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                  <span>{intro.intro_time ? formatTime(intro.intro_time.substring(0, 5)) : 'TBD'}</span>
                  <span>·</span>
                  <span>Coach:</span>
                  <span onClick={(e) => e.stopPropagation()}>
                    <CoachSelect intro={intro} />
                  </span>
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
                  originatingBookingStatus={
                    intro.originating_booking_id
                      ? parentBookings.find(p => p.id === intro.originating_booking_id)?.booking_status_canon ?? null
                      : null
                  }
                />
              </div>
            )}
          </div>
        );
      })}
      {journey.element}
      {editingIntro && (
        <EditBookingDialog
          open={!!editBookingId}
          onOpenChange={(o) => { if (!o) setEditBookingId(null); }}
          bookingId={editingIntro.id}
          memberName={editingIntro.member_name}
          coachName={editingIntro.coach_name || ''}
          introTime={editingIntro.intro_time}
          leadSource={editingIntro.lead_source || ''}
          introOwner={editingIntro.intro_owner}
          bookedBy={null}
          editedBy={userName}
          onSaved={() => {
            onUpdateBooking(editingIntro.id, {});
            setEditBookingId(null);
          }}
        />
      )}
    </div>
  );
}