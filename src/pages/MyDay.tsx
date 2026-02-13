import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, parseISO, addDays, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';
import { 
  Calendar, AlertTriangle, UserPlus, 
  Clock, FileText, CalendarCheck, Star, ChevronDown, ChevronRight, CalendarPlus, CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { IntroTypeBadge, LeadSourceTag } from '@/components/dashboard/IntroTypeBadge';
import { IntroActionBar, LeadActionBar } from '@/components/ActionBar';
import { useIntroTypeDetection } from '@/hooks/useIntroTypeDetection';
import { BookIntroDialog } from '@/components/leads/BookIntroDialog';
import { LeadDetailSheet } from '@/components/leads/LeadDetailSheet';
import { InlineIntroLogger } from '@/components/dashboard/InlineIntroLogger';
import { ReadyForIntroChecklist } from '@/components/dashboard/ReadyForIntroChecklist';
import { ShiftHandoffSummary } from '@/components/dashboard/ShiftHandoffSummary';
import { WinStreak } from '@/components/dashboard/WinStreak';
import { DayScore } from '@/components/dashboard/DayScore';
import { UnresolvedIntros } from '@/components/dashboard/UnresolvedIntros';
import { FollowUpsDueToday } from '@/components/dashboard/FollowUpsDueToday';
import { SoonLayer } from '@/components/dashboard/SoonLayer';
import { ShiftScanOverlay } from '@/components/dashboard/ShiftScanOverlay';
import { toast } from 'sonner';
import { Tables } from '@/integrations/supabase/types';

interface DayBooking {
  id: string;
  member_name: string;
  intro_time: string | null;
  coach_name: string;
  lead_source: string;
  questionnaire_status: string | null;
  questionnaire_slug: string | null;
  originating_booking_id: string | null;
  class_date: string;
  created_at: string;
  phone: string | null;
  email: string | null;
  vip_class_name?: string | null;
  vip_session_id?: string | null;
  intro_result?: string | null;
  primary_objection?: string | null;
}

interface VipGroup {
  groupName: string;
  sessionLabel: string | null;
  sessionTime: string | null;
  members: DayBooking[];
}

interface AllBookingMinimal {
  id: string;
  member_name: string;
  originating_booking_id: string | null;
  class_date: string;
  created_at: string;
  is_vip?: boolean | null;
}

function formatBookedTime(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const diffHrs = differenceInHours(now, created);
  const diffDays = differenceInDays(now, created);
  if (diffHrs < 1) return `Booked ${differenceInMinutes(now, created)}m ago`;
  if (diffHrs < 24 && isToday(created)) return `Booked today at ${format(created, 'h:mm a')}`;
  if (diffDays < 2) return 'Booked yesterday';
  if (diffDays < 7) return `Booked ${diffDays} days ago`;
  return `Booked ${format(created, 'MMM d')}`;
}

// Time-aware emphasis
function getShiftEmphasis(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 8 || (hour === 8 && new Date().getMinutes() < 30)) return 'morning';
  if (hour < 13 || (hour === 13 && new Date().getMinutes() < 30)) return 'afternoon';
  return 'evening';
}

export default function MyDay() {
  const { user } = useAuth();
  const { introsBooked, introsRun, sales } = useData();
  const navigate = useNavigate();
  const [todayBookings, setTodayBookings] = useState<DayBooking[]>([]);
  const [tomorrowBookings, setTomorrowBookings] = useState<DayBooking[]>([]);
  const [allBookings, setAllBookings] = useState<AllBookingMinimal[]>([]);
  const [newLeads, setNewLeads] = useState<Tables<'leads'>[]>([]);
  const [alreadyBookedLeadIds, setAlreadyBookedLeadIds] = useState<Set<string>>(new Set());
  const [vipGroups, setVipGroups] = useState<VipGroup[]>([]);
  const [expandedVipGroups, setExpandedVipGroups] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [reminderSentMap, setReminderSentMap] = useState<Set<string>>(new Set());
  const [confirmationSentMap, setConfirmationSentMap] = useState<Set<string>>(new Set());
  const [scriptActionsMap, setScriptActionsMap] = useState<Map<string, { action_type: string; script_category: string | null; completed_by: string; completed_at: string }>>(new Map());
  const [todayScriptsSent, setTodayScriptsSent] = useState(0);
  const [todayFollowUpsSent, setTodayFollowUpsSent] = useState(0);
  const [followUpsDueCount, setFollowUpsDueCount] = useState(0);
  const [loggingOpenId, setLoggingOpenId] = useState<string | null>(null);
  const [completedExpanded, setCompletedExpanded] = useState(false);

  // Lead actions state
  const [bookIntroLead, setBookIntroLead] = useState<Tables<'leads'> | null>(null);
  const [detailLead, setDetailLead] = useState<Tables<'leads'> | null>(null);

  const { isSecondIntro, getFirstBookingId } = useIntroTypeDetection(allBookings);
  const shiftEmphasis = getShiftEmphasis();

  useEffect(() => {
    fetchMyDayData();
  }, [user?.name, introsBooked]);

  const fetchMyDayData = async () => {
    if (!user?.name) return;
    setIsLoading(true);

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      const { data: bookings } = await supabase
        .from('intros_booked')
        .select('id, member_name, intro_time, coach_name, lead_source, originating_booking_id, class_date, created_at, phone, email')
        .in('class_date', [today, tomorrow])
        .is('deleted_at', null)
        .is('vip_class_name', null)
        .neq('booking_status', 'Closed – Bought')
        .order('intro_time', { ascending: true });

      const { data: vipBookings } = await supabase
        .from('intros_booked')
        .select('id, member_name, intro_time, coach_name, lead_source, originating_booking_id, class_date, created_at, phone, email, vip_class_name, vip_session_id')
        .in('class_date', [today])
        .is('deleted_at', null)
        .not('vip_class_name', 'is', null)
        .neq('booking_status', 'Closed – Bought')
        .neq('booking_status', 'Unscheduled')
        .order('intro_time', { ascending: true });

      // Process VIP groups
      if (vipBookings && vipBookings.length > 0) {
        const sessionIds = [...new Set(vipBookings.map((b: any) => b.vip_session_id).filter(Boolean))];
        let sessionMap = new Map<string, { session_label: string | null; session_time: string | null }>();
        if (sessionIds.length > 0) {
          const { data: sessionsData } = await supabase
            .from('vip_sessions')
            .select('id, session_label, session_time')
            .in('id', sessionIds);
          if (sessionsData) {
            sessionsData.forEach((s: any) => sessionMap.set(s.id, { session_label: s.session_label, session_time: s.session_time }));
          }
        }
        const groupMap = new Map<string, VipGroup>();
        vipBookings.forEach((b: any) => {
          const session = b.vip_session_id ? sessionMap.get(b.vip_session_id) : null;
          const key = `${b.vip_class_name || 'VIP'}__${b.vip_session_id || 'none'}`;
          if (!groupMap.has(key)) {
            groupMap.set(key, {
              groupName: b.vip_class_name || 'VIP Class',
              sessionLabel: session?.session_label || null,
              sessionTime: b.intro_time || session?.session_time || null,
              members: [],
            });
          }
          groupMap.get(key)!.members.push({
            ...b, questionnaire_status: null, phone: b.phone || null, email: b.email || null,
          });
        });
        setVipGroups(Array.from(groupMap.values()));
      } else {
        setVipGroups([]);
      }

      const { data: allBookingsData } = await supabase
        .from('intros_booked')
        .select('id, member_name, originating_booking_id, class_date, created_at, is_vip')
        .is('deleted_at', null);
      if (allBookingsData) setAllBookings(allBookingsData as AllBookingMinimal[]);

      if (bookings) {
        const bookingIds = bookings.map(b => b.id);
        const [qRes, runRes] = await Promise.all([
          supabase.from('intro_questionnaires')
            .select('booking_id, status, slug')
            .in('booking_id', bookingIds.length > 0 ? bookingIds : ['none']),
          supabase.from('intros_run')
            .select('linked_intro_booked_id, result, primary_objection')
            .in('linked_intro_booked_id', bookingIds.length > 0 ? bookingIds : ['none'])
            .limit(200),
        ]);

        const qMap = new Map(qRes.data?.map(q => [q.booking_id, { status: q.status, slug: (q as any).slug }]) || []);
        const runMap = new Map((runRes.data || []).map((r: any) => [r.linked_intro_booked_id, { result: r.result, primary_objection: r.primary_objection }]));
        
        const enriched = bookings.map(b => ({
          ...b,
          questionnaire_status: qMap.get(b.id)?.status || null,
          questionnaire_slug: qMap.get(b.id)?.slug || null,
          phone: (b as any).phone || null,
          email: (b as any).email || null,
          intro_result: runMap.get(b.id)?.result || null,
          primary_objection: runMap.get(b.id)?.primary_objection || null,
        }));

        setTodayBookings(enriched.filter(b => b.class_date === today));
        setTomorrowBookings(enriched.filter(b => b.class_date === tomorrow));

        const tomorrowIds = enriched.filter(b => b.class_date === tomorrow).map(b => b.id);
        const todayIds = enriched.filter(b => b.class_date === today).map(b => b.id);
        const allSendCheckIds = [...tomorrowIds, ...todayIds].filter(Boolean);
        if (allSendCheckIds.length > 0) {
          const { data: sendLogs } = await supabase
            .from('script_send_log')
            .select('booking_id')
            .in('booking_id', allSendCheckIds);
          const sentSet = new Set((sendLogs || []).map(l => l.booking_id).filter(Boolean) as string[]);
          setReminderSentMap(sentSet);
          setConfirmationSentMap(sentSet);
        }

        const todayStart = today + 'T00:00:00';
        const { data: actionsData } = await supabase
          .from('script_actions')
          .select('booking_id, action_type, script_category, completed_by, completed_at')
          .gte('completed_at', todayStart)
          .not('booking_id', 'is', null);

        if (actionsData) {
          const map = new Map<string, { action_type: string; script_category: string | null; completed_by: string; completed_at: string }>();
          let scriptsCount = 0;
          for (const a of actionsData) {
            if (a.booking_id && (a.action_type === 'script_sent' || a.action_type === 'intro_logged')) {
              map.set(a.booking_id, { action_type: a.action_type, script_category: a.script_category, completed_by: a.completed_by, completed_at: a.completed_at });
            }
            if (a.action_type === 'script_sent' && a.completed_by === user?.name) scriptsCount++;
          }
          setScriptActionsMap(map);
          setTodayScriptsSent(scriptsCount);
        }

        const { count: fuSentCount } = await supabase
          .from('follow_up_queue')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'sent')
          .gte('sent_at', todayStart);
        setTodayFollowUpsSent(fuSentCount || 0);
      }

      // New leads
      const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .eq('stage', 'new')
        .order('created_at', { ascending: false })
        .limit(10);

      if (leads) {
        setNewLeads(leads);
        if (leads.length > 0) {
          const { data: matchingBookings } = await supabase
            .from('intros_booked')
            .select('member_name, phone')
            .is('deleted_at', null)
            .neq('booking_status', 'Closed – Bought');
          if (matchingBookings) {
            const bookedNames = new Set(matchingBookings.map(b => b.member_name.toLowerCase()));
            const bookedPhones = new Set(matchingBookings.map(b => (b as any).phone?.toLowerCase()).filter(Boolean));
            const bookedLeadIds = new Set<string>();
            for (const lead of leads) {
              const fullName = `${lead.first_name} ${lead.last_name}`.toLowerCase();
              if (bookedNames.has(fullName) || (lead.phone && bookedPhones.has(lead.phone.toLowerCase()))) {
                bookedLeadIds.add(lead.id);
              }
            }
            setAlreadyBookedLeadIds(bookedLeadIds);
          }
        }
      }
    } catch (err) {
      console.error('MyDay fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkContacted = async (leadId: string) => {
    try {
      await supabase.from('leads').update({ stage: 'contacted' }).eq('id', leadId);
      await supabase.from('lead_activities').insert({
        lead_id: leadId, activity_type: 'stage_change',
        performed_by: user?.name || 'Unknown', notes: 'Marked as contacted from My Day',
      });
      toast.success('Lead moved to In Progress');
      fetchMyDayData();
    } catch { toast.error('Failed to update'); }
  };

  const handleMarkAlreadyBooked = async (leadId: string) => {
    try {
      await supabase.from('leads').update({ stage: 'booked' }).eq('id', leadId);
      await supabase.from('lead_activities').insert({
        lead_id: leadId, activity_type: 'stage_change',
        performed_by: user?.name || 'Unknown', notes: 'Manually marked as Already Booked from My Day',
      });
      toast.success('Lead moved to Booked');
      fetchMyDayData();
    } catch { toast.error('Failed to update'); }
  };

  const getQBadge = (status: string | null, is2nd: boolean) => {
    if (is2nd) return null;
    if (!status) return <Badge variant="outline" className="text-muted-foreground text-[10px]">No Q</Badge>;
    if (status === 'submitted' || status === 'completed') return <Badge className="bg-success text-success-foreground text-[10px]">Q Done</Badge>;
    if (status === 'sent') return <Badge className="bg-warning text-warning-foreground text-[10px]">Q Sent</Badge>;
    return <Badge variant="outline" className="text-muted-foreground text-[10px]">Not Sent</Badge>;
  };

  // Split today's bookings
  const activeTodayBookings = useMemo(() => todayBookings.filter(b => !b.intro_result), [todayBookings]);
  const completedTodayBookings = useMemo(() => todayBookings.filter(b => !!b.intro_result), [todayBookings]);

  // Unresolved intros: class time passed 1+ hours, no outcome
  const unresolvedIntros = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return activeTodayBookings
      .filter(b => {
        if (!b.intro_time || b.class_date !== today) return false;
        const parts = b.intro_time.split(':').map(Number);
        const ct = new Date();
        ct.setHours(parts[0], parts[1], 0, 0);
        return (Date.now() - ct.getTime()) / 3600000 >= 1;
      })
      .map(b => {
        const parts = b.intro_time!.split(':').map(Number);
        const ct = new Date();
        ct.setHours(parts[0], parts[1], 0, 0);
        return { ...b, hoursSinceClass: (Date.now() - ct.getTime()) / 3600000 };
      });
  }, [activeTodayBookings]);

  // Non-unresolved active intros
  const pendingIntros = useMemo(() => {
    const unresolvedIds = new Set(unresolvedIntros.map(u => u.id));
    return activeTodayBookings.filter(b => !unresolvedIds.has(b.id));
  }, [activeTodayBookings, unresolvedIntros]);

  // Day Score calculation
  const { completedActions, totalActions } = useMemo(() => {
    let total = 0;
    let completed = 0;

    // Today's intros
    total += todayBookings.length;
    completed += completedTodayBookings.length;

    // Follow-ups due
    total += followUpsDueCount;
    completed += todayFollowUpsSent;

    // New leads
    total += newLeads.length;
    // Leads contacted = leads with script actions today
    completed += todayScriptsSent > 0 ? Math.min(todayScriptsSent, newLeads.length) : 0;

    // Tomorrow confirmations
    const unconfirmedTomorrow = tomorrowBookings.filter(b => !reminderSentMap.has(b.id)).length;
    total += tomorrowBookings.length;
    completed += tomorrowBookings.length - unconfirmedTomorrow;

    return { completedActions: completed, totalActions: total };
  }, [todayBookings, completedTodayBookings, followUpsDueCount, todayFollowUpsSent, newLeads, todayScriptsSent, tomorrowBookings, reminderSentMap]);

  // Sort leads by priority: referrals first, then speed-to-lead
  const sortedLeads = useMemo(() => {
    return [...newLeads].sort((a, b) => {
      // Referrals first
      const aRef = a.source?.toLowerCase().includes('referral') ? 0 : 1;
      const bRef = b.source?.toLowerCase().includes('referral') ? 0 : 1;
      if (aRef !== bRef) return aRef - bRef;
      // Then by phone (has phone first)
      if (a.phone && !b.phone) return -1;
      if (!a.phone && b.phone) return 1;
      // Then by recency
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [newLeads]);

  const renderIntroCard = (b: DayBooking, showReminderStatus = false, isVipCard = false, showReadyChecklist = false) => {
    const is2nd = isVipCard ? false : isSecondIntro(b.id);
    const firstId = is2nd ? getFirstBookingId(b.member_name) : null;
    const reminderSent = reminderSentMap.has(b.id);
    const isClassToday = b.class_date === format(new Date(), 'yyyy-MM-dd');

    let classTimePassed = false;
    let hoursSinceClass = 0;
    if (b.intro_time && isClassToday) {
      const parts = b.intro_time.split(':').map(Number);
      const ct = new Date();
      ct.setHours(parts[0], parts[1], 0, 0);
      classTimePassed = new Date() > ct;
      hoursSinceClass = Math.max(0, (Date.now() - ct.getTime()) / 3600000);
    }
    const showLogButton = isClassToday && classTimePassed && !b.intro_result && hoursSinceClass < 1;
    const isLoggingThis = loggingOpenId === b.id;

    return (
      <div key={b.id} className="rounded-lg border bg-card p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-sm">{b.member_name}</span>
              {isVipCard ? (
                <Badge className="text-[10px] px-1.5 py-0 h-4 bg-purple-600 text-white border-transparent">VIP</Badge>
              ) : (
                <>
                  <IntroTypeBadge isSecondIntro={is2nd} />
                  <LeadSourceTag source={b.lead_source} />
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {b.intro_time ? format(parseISO(`2000-01-01T${b.intro_time}`), 'h:mm a') : 'Time TBD'} · {b.coach_name}
            </p>
            <p className="text-[10px] text-muted-foreground/70">{formatBookedTime(b.created_at)}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!b.phone && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">No Phone</Badge>}
            {b.phone && !b.email && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">No Email</Badge>}
            {!isVipCard && getQBadge(b.questionnaire_status, is2nd)}
            {showReminderStatus && !reminderSent && (
              <Badge variant="outline" className="text-[10px] bg-warning/15 text-warning border-warning/30">
                Reminder Not Sent
              </Badge>
            )}
          </div>
        </div>

        {showReadyChecklist && !b.intro_result && (
          <ReadyForIntroChecklist
            hasPhone={!!b.phone}
            qCompleted={b.questionnaire_status === 'completed' || b.questionnaire_status === 'submitted'}
            confirmationSent={confirmationSentMap.has(b.id)}
            isSecondIntro={is2nd}
          />
        )}

        {scriptActionsMap.has(b.id) && (() => {
          const action = scriptActionsMap.get(b.id)!;
          const timeStr = format(new Date(action.completed_at), 'h:mm a');
          const label = action.action_type === 'script_sent'
            ? `${action.completed_by} sent ${action.script_category === 'booking_confirmation' ? 'confirmation' : 'script'}`
            : `${action.completed_by} logged intro`;
          return (
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 bg-emerald-50 rounded px-2 py-1">
              <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
              {label} at {timeStr}
            </div>
          );
        })()}

        {isVipCard ? (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] flex-1 text-purple-700 border-purple-300 hover:bg-purple-50"
              onClick={() => {
                setBookIntroLead({
                  id: '', first_name: b.member_name.split(' ')[0] || '',
                  last_name: b.member_name.split(' ').slice(1).join(' ') || '',
                  phone: b.phone || '', email: b.email || '',
                  source: 'VIP Class', stage: 'new',
                  created_at: b.created_at, updated_at: b.created_at,
                } as any);
              }}
            >
              <CalendarPlus className="w-3 h-3 mr-1" />
              Book Real Intro
            </Button>
          </div>
        ) : (
          <>
            <IntroActionBar
              memberName={b.member_name}
              memberKey={b.member_name.toLowerCase().replace(/\s+/g, '')}
              bookingId={b.id}
              classDate={b.class_date}
              classTime={b.intro_time}
              coachName={b.coach_name}
              leadSource={b.lead_source}
              isSecondIntro={is2nd}
              firstBookingId={firstId}
              phone={b.phone}
              email={b.email}
              questionnaireStatus={b.questionnaire_status}
              questionnaireSlug={b.questionnaire_slug}
              introResult={b.intro_result}
              primaryObjection={b.primary_objection}
              bookingCreatedAt={b.created_at}
            />
            {showLogButton && !isLoggingThis && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] w-full"
                onClick={() => setLoggingOpenId(b.id)}
              >
                <FileText className="w-3 h-3 mr-1" />
                Log Intro
              </Button>
            )}
            {isLoggingThis && (
              <InlineIntroLogger
                bookingId={b.id}
                memberName={b.member_name}
                classDate={b.class_date}
                classTime={b.intro_time}
                coachName={b.coach_name}
                leadSource={b.lead_source}
                onLogged={() => { setLoggingOpenId(null); fetchMyDayData(); }}
              />
            )}
          </>
        )}
      </div>
    );
  };

  // Emphasis helper
  const sectionEmphasis = (section: 'intros' | 'followups' | 'leads' | 'tomorrow') => {
    if (shiftEmphasis === 'morning' && (section === 'intros' || section === 'leads')) return 'ring-1 ring-primary/20';
    if (shiftEmphasis === 'afternoon' && (section === 'followups')) return 'ring-1 ring-primary/20';
    if (shiftEmphasis === 'evening' && section === 'tomorrow') return 'ring-1 ring-primary/20';
    return '';
  };

  const emphasisLabel = (section: 'intros' | 'followups' | 'leads' | 'tomorrow') => {
    if (shiftEmphasis === 'morning' && (section === 'intros' || section === 'leads')) return '⭐ Suggested focus';
    if (shiftEmphasis === 'afternoon' && section === 'followups') return '⭐ Suggested focus';
    if (shiftEmphasis === 'evening' && section === 'tomorrow') return '⭐ Suggested focus';
    return null;
  };

  return (
    <div className="p-4 pb-8 space-y-4">
      {/* Greeting */}
      <div className="mb-2">
        <h1 className="text-xl font-bold">Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user?.name}! 👋</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d')}</p>
      </div>

      {/* Part 1: Day Score */}
      <DayScore completedActions={completedActions} totalActions={totalActions} />

      {/* Part 8A: Shift Scan Overlay */}
      <ShiftScanOverlay
        introsCount={activeTodayBookings.length}
        followUpsCount={followUpsDueCount}
        newLeadsCount={newLeads.length}
        unresolvedCount={unresolvedIntros.length}
        userName={user?.name || ''}
      />

      {/* Win Streaks */}
      <WinStreak userName={user?.name || ''} introsRun={introsRun} sales={sales} />

      {/* Quick Start */}
      <Button className="w-full gap-2" size="lg" onClick={() => navigate('/shift-recap')}>
        <FileText className="w-5 h-5" />
        Start Shift Recap
      </Button>

      {/* ═══════════════ NOW LAYER ═══════════════ */}

      {/* Part 2A: Unresolved Intros (highest priority) */}
      <UnresolvedIntros intros={unresolvedIntros} onRefresh={fetchMyDayData} />

      {/* Part 2B: Today's Intros */}
      <Card className={sectionEmphasis('intros')}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Today's Intros ({pendingIntros.length})
            {completedTodayBookings.length > 0 && (
              <Badge variant="secondary" className="text-[10px] ml-auto">{completedTodayBookings.length} completed</Badge>
            )}
          </CardTitle>
          {emphasisLabel('intros') && (
            <p className="text-[10px] text-primary font-medium">{emphasisLabel('intros')}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : pendingIntros.length === 0 && completedTodayBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No intros scheduled today</p>
          ) : pendingIntros.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              All intros logged! Great work.
            </div>
          ) : (
            pendingIntros.map(b => renderIntroCard(b, false, false, true))
          )}
        </CardContent>
      </Card>

      {/* Part 2C: Follow-Ups Due Today */}
      <div className={sectionEmphasis('followups')}>
        {emphasisLabel('followups') && (
          <p className="text-[10px] text-primary font-medium px-1 mb-1">{emphasisLabel('followups')}</p>
        )}
        <FollowUpsDueToday onRefresh={fetchMyDayData} onCountChange={setFollowUpsDueCount} />
      </div>

      {/* Part 2D: New Leads */}
      {sortedLeads.length > 0 && (
        <Card className={sectionEmphasis('leads')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-info" />
              New Leads ({sortedLeads.length})
            </CardTitle>
            {emphasisLabel('leads') && (
              <p className="text-[10px] text-primary font-medium">{emphasisLabel('leads')}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {sortedLeads.map(lead => {
              const minutesAgo = differenceInMinutes(new Date(), new Date(lead.created_at));
              const speedColor = minutesAgo < 5 ? 'bg-success text-success-foreground' 
                : minutesAgo < 30 ? 'bg-warning text-warning-foreground' 
                : 'bg-destructive text-destructive-foreground';
              const isAlreadyBooked = alreadyBookedLeadIds.has(lead.id);

              const handleDismissBooked = async () => {
                try {
                  await supabase.from('leads').update({ stage: 'booked' }).eq('id', lead.id);
                  await supabase.from('lead_activities').insert({
                    lead_id: lead.id, activity_type: 'stage_change',
                    performed_by: user?.name || 'Unknown', notes: 'Auto-dismissed: already booked',
                  });
                  toast.success('Lead moved to Booked');
                  fetchMyDayData();
                } catch { toast.error('Failed to update'); }
              };

              return (
                <div key={lead.id} className="rounded-lg border bg-card p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm">{lead.first_name} {lead.last_name}</span>
                        <LeadSourceTag source={lead.source} />
                        {isAlreadyBooked && (
                          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-warning text-warning-foreground border-transparent">
                            Already Booked
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Badge className={`text-[10px] px-1.5 py-0 h-4 ${speedColor}`}>
                      {minutesAgo < 60 ? `${minutesAgo}m` : isToday(new Date(lead.created_at)) ? format(new Date(lead.created_at), 'h:mm a') : format(new Date(lead.created_at), 'MMM d')}
                    </Badge>
                  </div>
                  {isAlreadyBooked && (
                    <Button variant="outline" size="sm" className="w-full h-7 text-[11px]" onClick={handleDismissBooked}>
                      Dismiss – Move to Booked
                    </Button>
                  )}
                  <LeadActionBar
                    leadId={lead.id}
                    firstName={lead.first_name}
                    lastName={lead.last_name}
                    phone={lead.phone}
                    source={lead.source}
                    stage={lead.stage}
                    onOpenDetail={() => setDetailLead(lead)}
                    onBookIntro={() => setBookIntroLead(lead)}
                    onMarkContacted={() => handleMarkContacted(lead.id)}
                    onMarkAlreadyBooked={() => handleMarkAlreadyBooked(lead.id)}
                  />
                </div>
              );
            })}
            <Button variant="ghost" size="sm" className="w-full text-primary" onClick={() => navigate('/leads')}>
              View all leads →
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Today's VIP Classes */}
      {vipGroups.length > 0 && vipGroups.map((group, gi) => {
        const groupKey = `${group.groupName}__${group.sessionLabel || gi}`;
        const isExpanded = expandedVipGroups.has(groupKey);
        const timeStr = group.sessionTime 
          ? format(parseISO(`2000-01-01T${group.sessionTime}`), 'h:mm a') : '';
        const headerLabel = group.sessionLabel 
          ? `${group.groupName} – ${group.sessionLabel}${timeStr ? ` (${timeStr})` : ''}`
          : `${group.groupName}${timeStr ? ` (${timeStr})` : ''}`;

        return (
          <Collapsible key={groupKey} open={isExpanded} onOpenChange={() => {
            setExpandedVipGroups(prev => {
              const next = new Set(prev);
              if (next.has(groupKey)) next.delete(groupKey);
              else next.add(groupKey);
              return next;
            });
          }}>
            <Card className="border-purple-200">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <Star className="w-4 h-4 text-purple-600" />
                    VIP Event: {headerLabel}
                    <Badge variant="secondary" className="ml-auto text-xs">{group.members.length} guests</Badge>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-2 pt-0">
                  {group.members.map(b => renderIntroCard(b, false, true))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      {/* ═══════════════ SOON LAYER ═══════════════ */}

      {/* Tomorrow's Intros */}
      <Card className={sectionEmphasis('tomorrow')}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-info" />
            Tomorrow's Intros ({tomorrowBookings.length})
          </CardTitle>
          {emphasisLabel('tomorrow') && (
            <p className="text-[10px] text-primary font-medium">{emphasisLabel('tomorrow')}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : tomorrowBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No intros scheduled for tomorrow</p>
          ) : (
            tomorrowBookings.map(b => renderIntroCard(b, true))
          )}
        </CardContent>
      </Card>

      {/* Part 3: SOON Layer (Day after tomorrow, upcoming follow-ups, weekly snapshot) */}
      <SoonLayer />

      {/* ═══════════════ COMPLETED TODAY ═══════════════ */}

      {completedTodayBookings.length > 0 && (
        <Collapsible open={completedExpanded} onOpenChange={setCompletedExpanded}>
          <Card className="border-emerald-200/60">
            <CollapsibleTrigger className="w-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                  {completedExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Completed Today ({completedTodayBookings.length})
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-2 pt-0">
                {completedTodayBookings.map(b => {
                  const resultLabel = b.intro_result || 'Logged';
                  const actionInfo = scriptActionsMap.get(b.id);
                  return (
                    <div key={b.id} className="rounded-lg border bg-muted/30 p-3 space-y-1 opacity-80">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{b.member_name}</span>
                        <Badge variant="secondary" className="text-[10px]">{resultLabel}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {b.intro_time ? format(parseISO(`2000-01-01T${b.intro_time}`), 'h:mm a') : ''} · {b.coach_name}
                        {actionInfo && ` · Logged by ${actionInfo.completed_by} at ${format(new Date(actionInfo.completed_at), 'h:mm a')}`}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Shift Handoff Summary */}
      <ShiftHandoffSummary
        todayCompletedCount={completedTodayBookings.length}
        todayActiveCount={activeTodayBookings.length}
        scriptsSentCount={todayScriptsSent}
        followUpsSentCount={todayFollowUpsSent}
        userName={user?.name || ''}
      />

      {/* Dialogs */}
      {bookIntroLead && (
        <BookIntroDialog
          open={!!bookIntroLead}
          onOpenChange={open => { if (!open) setBookIntroLead(null); }}
          lead={bookIntroLead}
          onDone={() => { setBookIntroLead(null); fetchMyDayData(); }}
        />
      )}

      <LeadDetailSheet
        lead={detailLead}
        activities={[]}
        open={!!detailLead}
        onOpenChange={open => { if (!open) setDetailLead(null); }}
        onRefresh={fetchMyDayData}
      />
    </div>
  );
}
