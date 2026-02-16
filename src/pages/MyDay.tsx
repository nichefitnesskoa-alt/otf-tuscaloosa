import { useState, useEffect, useMemo, useCallback } from 'react';
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
  Clock, FileText, CalendarCheck, Star, ChevronDown, ChevronRight, CalendarPlus, CheckCircle2,
  Phone as PhoneIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { InlinePhoneInput, NoPhoneBadge } from '@/components/dashboard/InlinePhoneInput';
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
import { PrepScoreDot } from '@/components/dashboard/PrepScoreDot';
import { ShiftHandoffSummary } from '@/components/dashboard/ShiftHandoffSummary';
import { WinStreak } from '@/components/dashboard/WinStreak';
import { StickyDayScore } from '@/components/dashboard/StickyDayScore';
import { UnresolvedIntros } from '@/components/dashboard/UnresolvedIntros';
import { FollowUpsDueToday } from '@/components/dashboard/FollowUpsDueToday';
import { SoonLayer } from '@/components/dashboard/SoonLayer';
import { ShiftScanOverlay } from '@/components/dashboard/ShiftScanOverlay';
import { OnboardingOverlay } from '@/components/dashboard/OnboardingOverlay';
import { SectionHelp } from '@/components/dashboard/SectionHelp';
import { CardGuidance, CardGuidanceWithAction, getIntroGuidance, getLeadGuidance, getTomorrowGuidance, getJourneyGuidance, getJourneyGuidanceWithAction, JourneyContext } from '@/components/dashboard/CardGuidance';
import { CollapsibleSection } from '@/components/dashboard/CollapsibleSection';
import { CloseOutShift } from '@/components/dashboard/CloseOutShift';
import { InlineEditField } from '@/components/dashboard/InlineEditField';
import { QuickAddFAB } from '@/components/dashboard/QuickAddFAB';
import { OfflineBanner } from '@/components/dashboard/OfflineBanner';
import { SectionReorderButton, getSectionOrder } from '@/components/dashboard/SectionReorder';
import { useRealtimeMyDay } from '@/hooks/useRealtimeMyDay';
import { NextActionCard } from '@/components/dashboard/NextActionCard';
import { IntroCountdown } from '@/components/dashboard/IntroCountdown';
import { ConversionSignal } from '@/components/dashboard/ConversionSignal';
import { PostPurchaseActions } from '@/components/dashboard/PostPurchaseActions';
import { NoShowWarning } from '@/components/dashboard/NoShowWarning';
import { DailyInsight } from '@/components/dashboard/DailyInsight';
import { toast } from 'sonner';
import { OutcomeEditor } from '@/components/dashboard/OutcomeEditor';
import { Tables } from '@/integrations/supabase/types';
import { isMembershipSale } from '@/lib/sales-detection';

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

function getShiftEmphasis(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 8 || (hour === 8 && new Date().getMinutes() < 30)) return 'morning';
  if (hour < 13 || (hour === 13 && new Date().getMinutes() < 30)) return 'afternoon';
  return 'evening';
}

// Staff list for coach dropdown
const COACHES = ['TBD', 'Elizabeth', 'Corinne', 'Lauren', 'Sophie', 'Faith', 'Carter', 'Haleigh', 'Tiffany', 'Brittany', 'Lydia'];

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
  const [scriptActionsMap, setScriptActionsMap] = useState<Map<string, Array<{ action_type: string; script_category: string | null; completed_by: string; completed_at: string }>>>(new Map());
  const [todayScriptsSent, setTodayScriptsSent] = useState(0);
  const [todayFollowUpsSent, setTodayFollowUpsSent] = useState(0);
  const [followUpsDueCount, setFollowUpsDueCount] = useState(0);
  const [loggingOpenId, setLoggingOpenId] = useState<string | null>(null);
  const [followUpVerifiedMap, setFollowUpVerifiedMap] = useState<Map<string, boolean>>(new Map());
  const [completedRunsMap, setCompletedRunsMap] = useState<Map<string, { sa_name: string; created_at: string }>>(new Map());
  const [editingOutcomeId, setEditingOutcomeId] = useState<string | null>(null);

  // Accordion: only one card expanded at a time
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Lead actions state
  const [bookIntroLead, setBookIntroLead] = useState<Tables<'leads'> | null>(null);
  const [detailLead, setDetailLead] = useState<Tables<'leads'> | null>(null);

  // Section reorder
  const [sectionOrder, setSectionOrder] = useState<string[]>(getSectionOrder());

  const { isSecondIntro, getFirstBookingId } = useIntroTypeDetection(allBookings);
  const shiftEmphasis = getShiftEmphasis();

  // Realtime subscriptions - debounce to avoid rapid-fire reloads
  const handleRealtimeUpdate = useCallback(() => {
    // Small delay to batch multiple rapid updates
    const timer = setTimeout(() => fetchMyDayData(), 1500);
    return () => clearTimeout(timer);
  }, []);
  useRealtimeMyDay(handleRealtimeUpdate);

  useEffect(() => {
    fetchMyDayData();
  }, [user?.name, introsBooked]);

  const fetchMyDayData = async () => {
    if (!user?.name) return;
    setIsLoading(true);

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      // Fetch today (include Closed-Bought so completed intros remain visible) and tomorrow (exclude Closed-Bought)
      const [todayRes, tomorrowRes] = await Promise.all([
        supabase
          .from('intros_booked')
          .select('id, member_name, intro_time, coach_name, lead_source, originating_booking_id, class_date, created_at, phone, email')
          .eq('class_date', today)
          .is('deleted_at', null)
          .is('vip_class_name', null)
          .order('intro_time', { ascending: true }),
        supabase
          .from('intros_booked')
          .select('id, member_name, intro_time, coach_name, lead_source, originating_booking_id, class_date, created_at, phone, email')
          .eq('class_date', tomorrow)
          .is('deleted_at', null)
          .is('vip_class_name', null)
          .neq('booking_status', 'Closed – Bought')
          .order('intro_time', { ascending: true }),
      ]);
      const bookings = [...(todayRes.data || []), ...(tomorrowRes.data || [])];

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

      if (bookings && bookings.length > 0) {
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
          const map = new Map<string, Array<{ action_type: string; script_category: string | null; completed_by: string; completed_at: string }>>();
          let scriptsCount = 0;
          for (const a of actionsData) {
            if (a.booking_id) {
              const existing = map.get(a.booking_id) || [];
              existing.push({ action_type: a.action_type, script_category: a.script_category, completed_by: a.completed_by, completed_at: a.completed_at });
              map.set(a.booking_id, existing);
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

        // Fetch completed run details (who logged, when) and follow-up verification
        const completedBookingIds = enriched.filter(b => b.class_date === today && b.intro_result).map(b => b.id);
        if (completedBookingIds.length > 0) {
          const [runsDetail, fuVerify] = await Promise.all([
            supabase.from('intros_run')
              .select('linked_intro_booked_id, sa_name, created_at')
              .in('linked_intro_booked_id', completedBookingIds),
            supabase.from('follow_up_queue')
              .select('booking_id')
              .in('booking_id', completedBookingIds)
              .limit(200),
          ]);
          const runsMap = new Map<string, { sa_name: string; created_at: string }>();
          (runsDetail.data || []).forEach((r: any) => {
            if (r.linked_intro_booked_id) runsMap.set(r.linked_intro_booked_id, { sa_name: r.sa_name || 'Unknown', created_at: r.created_at });
          });
          setCompletedRunsMap(runsMap);

          const verifiedSet = new Set((fuVerify.data || []).map((f: any) => f.booking_id).filter(Boolean));
          const verifyMap = new Map<string, boolean>();
          completedBookingIds.forEach(id => {
            const result = enriched.find(b => b.id === id)?.intro_result;
            if (result === 'No-show' || result === "Didn't Buy") {
              verifyMap.set(id, verifiedSet.has(id));
            }
          });
          setFollowUpVerifiedMap(verifyMap);
        } else {
          setCompletedRunsMap(new Map());
          setFollowUpVerifiedMap(new Map());
        }
      }

      // New leads
      const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .in('stage', ['new', 'contacted'])
        .order('created_at', { ascending: false })
        .limit(30);

      if (leads && leads.length > 0) {
        const { data: matchingBookings } = await supabase
          .from('intros_booked')
          .select('id, member_name, phone, class_date')
          .is('deleted_at', null);

        if (matchingBookings) {
          // Build lookup maps for unambiguous matching
          const bookedByFullName = new Map<string, { id: string; class_date: string }>();
          const bookedByPhone = new Map<string, { id: string; class_date: string }>();
          matchingBookings.forEach(b => {
            const name = b.member_name.toLowerCase().trim();
            if (!bookedByFullName.has(name)) bookedByFullName.set(name, { id: b.id, class_date: b.class_date });
            const phone = (b as any).phone?.replace(/\D/g, '') || '';
            if (phone.length >= 7 && !bookedByPhone.has(phone)) bookedByPhone.set(phone, { id: b.id, class_date: b.class_date });
          });

          const autoRemoveIds: string[] = [];
          const autoRemoveNotes: { id: string; note: string }[] = [];
          const ambiguousIds = new Set<string>();
          const remaining: Tables<'leads'>[] = [];

          for (const lead of leads) {
            const fullName = `${lead.first_name} ${lead.last_name}`.toLowerCase().trim();
            const cleanPhone = lead.phone?.replace(/\D/g, '') || '';
            
            // Unambiguous: full name (first+last) matches exactly, OR phone matches
            const fullNameMatch = bookedByFullName.get(fullName);
            const phoneMatch = cleanPhone.length >= 7 ? bookedByPhone.get(cleanPhone) : undefined;
            
            if (fullNameMatch || phoneMatch) {
              // Unambiguous match → auto-remove
              const matchedBooking = fullNameMatch || phoneMatch!;
              autoRemoveIds.push(lead.id);
              autoRemoveNotes.push({
                id: lead.id,
                note: `Auto-moved to Booked. Matched booking ${matchedBooking.id.substring(0, 8)} for ${matchedBooking.class_date}`,
              });
            } else {
              // Check partial match (first name only) → ambiguous
              const firstNameLower = lead.first_name.toLowerCase().trim();
              const partialMatch = matchingBookings.some(b => {
                const bFirst = b.member_name.split(' ')[0]?.toLowerCase().trim();
                return bFirst === firstNameLower && b.member_name.toLowerCase().trim() !== fullName;
              });
              if (partialMatch) {
                ambiguousIds.add(lead.id);
              }
              remaining.push(lead);
            }
          }

          // Auto-move unambiguous matches to 'booked' in background
          if (autoRemoveIds.length > 0) {
            await supabase.from('leads').update({ stage: 'booked' }).in('id', autoRemoveIds);
            const activities = autoRemoveNotes.map(n => ({
              lead_id: n.id,
              activity_type: 'stage_change',
              performed_by: 'System',
              notes: n.note,
            }));
            await supabase.from('lead_activities').insert(activities);
          }

          // Only show genuinely new/contacted leads (exclude won, booked, lost, etc.)
          const actualNewLeads = remaining.filter(l => l.stage === 'new');
          setNewLeads(actualNewLeads);
          setAlreadyBookedLeadIds(ambiguousIds);
        } else {
          setNewLeads(leads.filter(l => l.stage === 'new'));
          setAlreadyBookedLeadIds(new Set());
        }
      } else {
        setNewLeads([]);
        setAlreadyBookedLeadIds(new Set());
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

  // Completed today stats for CloseOut
  const purchaseCount = useMemo(() => completedTodayBookings.filter(b => isMembershipSale(b.intro_result || '')).length, [completedTodayBookings]);
  const noShowCount = useMemo(() => completedTodayBookings.filter(b => b.intro_result === 'No-show').length, [completedTodayBookings]);
  const didntBuyCount = useMemo(() => completedTodayBookings.filter(b => b.intro_result === "Didn't Buy").length, [completedTodayBookings]);
  const topObjection = useMemo(() => {
    const objections = completedTodayBookings.map(b => b.primary_objection).filter(Boolean) as string[];
    if (objections.length === 0) return null;
    const counts = objections.reduce((acc, o) => { acc[o] = (acc[o] || 0) + 1; return acc; }, {} as Record<string, number>);
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }, [completedTodayBookings]);

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

    total += todayBookings.length;
    completed += completedTodayBookings.length;

    total += followUpsDueCount;
    completed += todayFollowUpsSent;

    total += newLeads.length;
    completed += todayScriptsSent > 0 ? Math.min(todayScriptsSent, newLeads.length) : 0;

    const unconfirmedTomorrow = tomorrowBookings.filter(b => !reminderSentMap.has(b.id)).length;
    total += tomorrowBookings.length;
    completed += tomorrowBookings.length - unconfirmedTomorrow;

    return { completedActions: completed, totalActions: total };
  }, [todayBookings, completedTodayBookings, followUpsDueCount, todayFollowUpsSent, newLeads, todayScriptsSent, tomorrowBookings, reminderSentMap]);

  // Sort leads by priority
  const sortedLeads = useMemo(() => {
    return [...newLeads].sort((a, b) => {
      const aRef = a.source?.toLowerCase().includes('referral') ? 0 : 1;
      const bRef = b.source?.toLowerCase().includes('referral') ? 0 : 1;
      if (aRef !== bRef) return aRef - bRef;
      if (a.phone && !b.phone) return -1;
      if (!a.phone && b.phone) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [newLeads]);

  // ─── Inline edit handlers ──────────────────────────────────────────
  const handleUpdateBookingField = async (bookingId: string, field: string, value: string) => {
    await supabase.from('intros_booked').update({ [field]: value } as any).eq('id', bookingId);
    fetchMyDayData();
  };

  // ─── Card rendering ───────────────────────────────────────────────

  const toggleCard = (id: string) => {
    setExpandedCardId(prev => prev === id ? null : id);
  };

  const renderCompactIntroCard = (b: DayBooking, showReminderStatus = false, isVipCard = false) => {
    const is2nd = isVipCard ? false : isSecondIntro(b.id);
    const reminderSent = reminderSentMap.has(b.id);
    const isClassToday = b.class_date === format(new Date(), 'yyyy-MM-dd');
    const isExpanded = expandedCardId === b.id;

    let classTimePassed = false;
    let hoursSinceClass = 0;
    if (b.intro_time && isClassToday) {
      const parts = b.intro_time.split(':').map(Number);
      const ct = new Date();
      ct.setHours(parts[0], parts[1], 0, 0);
      classTimePassed = new Date() > ct;
      hoursSinceClass = Math.max(0, (Date.now() - ct.getTime()) / 3600000);
    }
    const showLogButton = isClassToday && classTimePassed && !b.intro_result;
    const isLoggingThis = loggingOpenId === b.id;

    const firstId = is2nd ? getFirstBookingId(b.member_name) : null;

    return (
      <div key={b.id} className="rounded-lg border bg-card transition-all">
        {/* Compact header - always visible */}
        <div
          className="p-3 md:p-2.5 cursor-pointer"
          onClick={() => toggleCard(b.id)}
        >
          {/* Row 1: Name only on mobile, name+badges on desktop */}
          <div className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-1.5 min-w-0">
            <span className="font-semibold text-[17px] md:text-sm whitespace-normal break-words leading-tight flex items-center gap-1.5">
              {!isVipCard && !b.intro_result && (
                <PrepScoreDot
                  hasPhone={!!b.phone}
                  qCompleted={b.questionnaire_status === 'completed' || b.questionnaire_status === 'submitted'}
                  confirmationSent={confirmationSentMap.has(b.id)}
                  isSecondIntro={is2nd}
                />
              )}
              {isExpanded ? (
                <InlineEditField
                  value={b.member_name}
                  onSave={v => handleUpdateBookingField(b.id, 'member_name', v)}
                />
              ) : b.member_name}
            </span>

            {/* Row 2 on mobile: badges + time + coach */}
            <div className="flex items-center gap-1.5 flex-wrap text-[13px] md:text-[11px]">
              {isVipCard ? (
                <Badge className="text-[10px] px-1.5 py-0 h-4 bg-purple-600 text-white border-transparent">VIP</Badge>
              ) : (
                <>
                  <IntroTypeBadge isSecondIntro={is2nd} />
                  <LeadSourceTag source={b.lead_source} />
                </>
              )}
              <span className="text-muted-foreground">
                {isExpanded ? (
                  <InlineEditField
                    value={b.intro_time || ''}
                    displayValue={b.intro_time ? format(parseISO(`2000-01-01T${b.intro_time}`), 'h:mm a') : 'Time TBD'}
                    onSave={v => handleUpdateBookingField(b.id, 'intro_time', v)}
                    type="time"
                    muted
                  />
                ) : (
                  b.intro_time ? format(parseISO(`2000-01-01T${b.intro_time}`), 'h:mm a') : 'Time TBD'
                )}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {isExpanded ? (
                  <InlineEditField
                    value={b.coach_name}
                    onSave={v => handleUpdateBookingField(b.id, 'coach_name', v)}
                    options={COACHES.map(c => ({ label: c, value: c }))}
                    muted
                  />
                ) : b.coach_name}
              </span>
            </div>

            {/* Row 3 on mobile: status badges */}
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5 md:mt-0 md:ml-auto">
              {!b.phone && <NoPhoneBadge />}
              {!isVipCard && !isClassToday && b.class_date === format(addDays(new Date(), 1), 'yyyy-MM-dd') && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 bg-warning/15 text-warning border-warning/30">
                  TOMORROW
                </Badge>
              )}
              {!isVipCard && isClassToday && !classTimePassed && (
                <IntroCountdown classTime={b.intro_time} classDate={b.class_date} />
              )}
              {showReminderStatus && !reminderSent && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 bg-warning/15 text-warning border-warning/30">Not Confirmed</Badge>
              )}
              {!isVipCard && !isExpanded && getQBadge(b.questionnaire_status, is2nd)}
              {/* ConversionSignal: desktop only */}
              {!isVipCard && !isExpanded && (
                <span className="hidden md:inline-flex">
                  <ConversionSignal
                    isSecondIntro={is2nd}
                    qCompleted={b.questionnaire_status === 'completed' || b.questionnaire_status === 'submitted'}
                    hasPhone={!!b.phone}
                    leadSource={b.lead_source}
                  />
                </span>
              )}
            </div>
          </div>

          {/* Script action indicator */}
          {scriptActionsMap.has(b.id) && !isExpanded && (() => {
            const actions = scriptActionsMap.get(b.id)!;
            const latest = actions[actions.length - 1];
            return (
              <div className="flex items-center gap-1 text-[9px] text-emerald-700 mt-0.5">
                <CheckCircle2 className="w-2.5 h-2.5" />
                {latest.completed_by} · {format(new Date(latest.completed_at), 'h:mm a')}
              </div>
            );
          })()}

          {/* Journey guidance with action button - always visible */}
          {!isExpanded && !b.intro_result && (() => {
            const bookingActions = scriptActionsMap.get(b.id) || [];
            const hasAction = (type: string) => bookingActions.some(a => a.action_type === type);
            const getActionInfo = (type: string) => {
              const a = bookingActions.find(a => a.action_type === type);
              return a ? { by: a.completed_by, at: a.completed_at } : null;
            };
            const ctx: JourneyContext = {
              isBooked: true,
              classDate: b.class_date,
              classTime: b.intro_time,
              introResult: b.intro_result,
              isSecondIntro: is2nd,
              confirmationSent: confirmationSentMap.has(b.id) || hasAction('confirmation_sent'),
              qCompleted: b.questionnaire_status === 'completed' || b.questionnaire_status === 'submitted',
              qSent: b.questionnaire_status === 'sent',
            };
            const { text, actionType } = getJourneyGuidanceWithAction(ctx);
            if (!text) return null;
            if (actionType) {
              return (
                <CardGuidanceWithAction
                  text={text}
                  actionType={actionType}
                  bookingId={b.id}
                  completedBy={user?.name || 'Unknown'}
                  completedInfo={getActionInfo(actionType)}
                  onCompleted={fetchMyDayData}
                  className="mx-3 mb-2 mt-1"
                />
              );
            }
            return <CardGuidance text={text} className="mx-3 mb-2 mt-1" />;
          })()}
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-2.5 pb-2.5 space-y-2 border-t pt-2">
            <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted-foreground">
              <span>{formatBookedTime(b.created_at)}</span>
              {!b.phone && (
                <InlinePhoneInput
                  personName={b.member_name}
                  bookingId={b.id}
                  onSaved={fetchMyDayData}
                  compact
                />
              )}
              {b.phone && !b.email && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">No Email</Badge>}
              {!isVipCard && getQBadge(b.questionnaire_status, is2nd)}
            </div>

            {/* No-show warning */}
            {!isVipCard && <NoShowWarning memberName={b.member_name} />}

            {/* Ready checklist */}
            {!b.intro_result && !isVipCard && (
              <ReadyForIntroChecklist
                hasPhone={!!b.phone}
                qCompleted={b.questionnaire_status === 'completed' || b.questionnaire_status === 'submitted'}
                confirmationSent={confirmationSentMap.has(b.id)}
                isSecondIntro={is2nd}
              />
            )}

            {/* Post-purchase actions */}
            {b.intro_result && isMembershipSale(b.intro_result) && (
              <PostPurchaseActions memberName={b.member_name} bookingId={b.id} />
            )}

            {scriptActionsMap.has(b.id) && (() => {
              const actions = scriptActionsMap.get(b.id)!;
              return (
                <div className="space-y-1">
                  {actions.map((action, i) => {
                    const timeStr = format(new Date(action.completed_at), 'h:mm a');
                    const label = action.action_type === 'script_sent'
                      ? `${action.completed_by} sent ${action.script_category === 'booking_confirmation' ? 'confirmation' : 'script'}`
                      : action.action_type === 'intro_logged'
                        ? `${action.completed_by} logged intro`
                        : `${action.completed_by} completed ${action.action_type.replace(/_/g, ' ')}`;
                    return (
                      <div key={i} className="flex items-center gap-1.5 text-[10px] text-emerald-700 bg-emerald-50 rounded px-2 py-1">
                        <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                        {label} at {timeStr}
                      </div>
                    );
                  })}
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
                  onQuestionnaireCreated={(slug) => {
                    setTodayBookings(prev => prev.map(bk => bk.id === b.id ? {...bk, questionnaire_slug: slug, questionnaire_status: 'not_sent'} : bk));
                    setTomorrowBookings(prev => prev.map(bk => bk.id === b.id ? {...bk, questionnaire_slug: slug, questionnaire_status: 'not_sent'} : bk));
                  }}
                />
                {showLogButton && !isLoggingThis && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] w-full"
                    onClick={(e) => { e.stopPropagation(); setLoggingOpenId(b.id); }}
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
                    onLogged={(undoData) => {
                      setLoggingOpenId(null);
                      fetchMyDayData();
                      if (undoData) {
                        toast.success(`Intro logged`, {
                          action: {
                            label: 'Undo',
                            onClick: async () => {
                              try {
                                // Delete the intro run
                                await supabase.from('intros_run').delete().eq('id', undoData.introRunId);
                                // Delete follow-up entries
                                if (undoData.followUpIds.length > 0) {
                                  await supabase.from('follow_up_queue').delete().in('id', undoData.followUpIds);
                                }
                                // Restore booking status
                                await supabase.from('intros_booked')
                                  .update({ booking_status: undoData.previousStatus, closed_at: null, closed_by: null })
                                  .eq('id', undoData.bookingId);
                                // Delete the script_action
                                await supabase.from('script_actions').delete()
                                  .eq('booking_id', undoData.bookingId)
                                  .eq('action_type', 'intro_logged');
                                toast.success('Intro log undone');
                                fetchMyDayData();
                              } catch { toast.error('Undo failed'); }
                            },
                          },
                          duration: 5000,
                        });
                      }
                    }}
                  />
                )}
                <CardGuidance text={getIntroGuidance({
                  classTimePassed,
                  introResult: b.intro_result,
                  qCompleted: b.questionnaire_status === 'completed' || b.questionnaire_status === 'submitted',
                  confirmationSent: confirmationSentMap.has(b.id),
                  isSecondIntro: is2nd,
                })} />
              </>
            )}
          </div>
        )}

        {/* Compact action icons (when collapsed, non-VIP only) */}
        {!isExpanded && !isVipCard && (
          <div className="px-3 md:px-2.5 pb-2.5 -mt-0.5">
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
              onQuestionnaireCreated={(slug) => {
                setTodayBookings(prev => prev.map(bk => bk.id === b.id ? {...bk, questionnaire_slug: slug, questionnaire_status: 'not_sent'} : bk));
                setTomorrowBookings(prev => prev.map(bk => bk.id === b.id ? {...bk, questionnaire_slug: slug, questionnaire_status: 'not_sent'} : bk));
              }}
            />
          </div>
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
    <div className="px-4 md:px-4 pb-24 space-y-3 md:space-y-4 max-w-full overflow-x-hidden">
      <OnboardingOverlay />

      {/* 1. Greeting (always visible) */}
      <div className="mb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user?.name}! 👋</h1>
            <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d')}</p>
          </div>
          <SectionReorderButton onReorder={setSectionOrder} />
        </div>
      </div>

      {/* Monday Meeting Card */}
      {new Date().getDay() === 1 && !sessionStorage.getItem('meeting-card-dismissed') && (
        <Card className="border-2 border-primary bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-lg flex items-center gap-2">📋 Team Meeting Today</p>
              <p className="text-sm text-muted-foreground">View the agenda before the meeting</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => navigate('/meeting')}>View Agenda</Button>
              <Button variant="ghost" size="sm" onClick={() => { sessionStorage.setItem('meeting-card-dismissed', '1'); fetchMyDayData(); }}>✕</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Insight */}
      <DailyInsight />

      {/* Offline Banner */}
      <OfflineBanner />

      {/* 2. Sticky Day Score */}
      <StickyDayScore completedActions={completedActions} totalActions={totalActions} />

      {/* 3. Next Action Card */}
      <NextActionCard
        unresolvedIntros={unresolvedIntros}
        newLeads={sortedLeads}
        followUpsDueCount={followUpsDueCount}
        tomorrowUnconfirmedCount={tomorrowBookings.filter(b => !reminderSentMap.has(b.id)).length}
        allHandled={completedActions >= totalActions && totalActions > 0}
        onLogIntro={(id) => { setExpandedCardId(id); setLoggingOpenId(id); }}
        onContactLead={(id) => { setExpandedCardId(`lead-${id}`); }}
        onOpenFollowUps={() => {
          const el = document.getElementById('section-followups-due');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
        onOpenTomorrow={() => {
          const el = document.getElementById('section-tomorrows-intros');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* Shift Scan Overlay */}
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

      {/* ═══════════════ REORDERABLE SECTIONS ═══════════════ */}

      {/* Unresolved Intros always first (not reorderable, urgent) */}
      <UnresolvedIntros intros={unresolvedIntros} onRefresh={fetchMyDayData} />

      {/* Today's VIP Classes always after unresolved */}
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
                  {group.members.map(b => renderCompactIntroCard(b, false, true))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      {/* Reorderable sections */}
      {sectionOrder.map(sectionId => {
        switch (sectionId) {
          case 'todays-intros': {
            // Sort: unlogged first, then logged (preserve time order within each group)
            const sortedTodayBookings = [...todayBookings].sort((a, b) => {
              if (!a.intro_result && b.intro_result) return -1;
              if (a.intro_result && !b.intro_result) return 1;
              return 0;
            });
            const loggedCount = completedTodayBookings.length;
            const remainingCount = activeTodayBookings.length;
            const allLogged = remainingCount === 0 && loggedCount > 0;

            // Mini outcome summary
            const outcomeDots = [];
            if (purchaseCount > 0) outcomeDots.push(<span key="p" className="flex items-center gap-0.5 text-[10px] text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />{purchaseCount} purchased</span>);
            if (didntBuyCount > 0) outcomeDots.push(<span key="d" className="flex items-center gap-0.5 text-[10px] text-amber-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />{didntBuyCount} didn't buy</span>);
            if (noShowCount > 0) outcomeDots.push(<span key="n" className="flex items-center gap-0.5 text-[10px] text-destructive"><span className="w-1.5 h-1.5 rounded-full bg-destructive inline-block" />{noShowCount} no-show</span>);

            return (
              <CollapsibleSection
                key="todays-intros"
                id="todays-intros"
                title="Today's Intros"
                icon={<Calendar className="w-4 h-4 text-primary" />}
                count={todayBookings.length}
                countLabel={loggedCount > 0 ? (allLogged ? `· ${loggedCount} logged ✓` : `· ${loggedCount} logged · ${remainingCount} remaining`) : undefined}
                defaultOpen={true}
                forceOpen={true}
                emphasis={sectionEmphasis('intros')}
                subLabel={emphasisLabel('intros') || undefined}
                headerRight={
                  outcomeDots.length > 0 ? (
                    <div className="flex items-center gap-2 flex-wrap">{outcomeDots}</div>
                  ) : undefined
                }
              >
                <SectionHelp text="Everyone coming in for a class today. Tap any card to expand for details. Use Prep to review, Script to message, Log Intro after class." />
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : sortedTodayBookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No intros scheduled today</p>
                ) : (
                  <>
                    {sortedTodayBookings.map(b => {
                      const resultLabel = b.intro_result || '';
                      const isPurchased = isMembershipSale(resultLabel);
                      const isNoShow = resultLabel === 'No-show';
                      const isDidntBuy = resultLabel === "Didn't Buy";
                      const isLogged = !!b.intro_result;

                      if (!isLogged) {
                        return renderCompactIntroCard(b, false, false);
                      }

                      // Logged card - ALWAYS VISIBLE with all rows shown
                      const borderClass = isPurchased ? 'border-l-4 border-l-[#2E7D32]'
                        : isDidntBuy ? 'border-l-4 border-l-[#F59E0B]'
                        : isNoShow ? 'border-l-4 border-l-[#DC2626]' : '';
                      const badgeClass = isPurchased
                        ? 'bg-emerald-600 text-white border-transparent'
                        : isDidntBuy
                        ? 'bg-amber-400 text-amber-950 border-transparent'
                        : isNoShow
                        ? 'bg-red-600 text-white border-transparent'
                        : '';
                      const badgeLabel = isPurchased ? 'Purchased'
                        : isDidntBuy ? "Didn't Buy"
                        : isNoShow ? 'No Show' : resultLabel;
                      const runInfo = completedRunsMap.get(b.id);
                      const is2nd = isSecondIntro(b.id);
                      const firstId = is2nd ? getFirstBookingId(b.member_name) : null;
                      const followUpVerified = followUpVerifiedMap.get(b.id);
                      const isEditingOutcome = editingOutcomeId === b.id;

                      // Row 3: outcome detail line
                      const loggedByText = runInfo
                        ? `Logged by ${runInfo.sa_name} at ${format(new Date(runInfo.created_at), 'h:mm a')}`
                        : '';
                      let detailLine = '';
                      if (isPurchased) {
                        detailLine = `${resultLabel} membership. ${loggedByText}`;
                      } else if (isDidntBuy) {
                        detailLine = b.primary_objection
                          ? `Objection: ${b.primary_objection}. ${loggedByText}`
                          : `No objection recorded. ${loggedByText}`;
                      } else if (isNoShow) {
                        detailLine = `No show. ${loggedByText}`;
                      }

                      return (
                        <div key={b.id} className={cn('rounded-lg border bg-card transition-all', borderClass)}>
                          {/* Row 1: Name + Outcome Badge */}
                          <div className="p-3 pb-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-[17px] md:text-sm whitespace-normal break-words leading-tight">
                                {b.member_name}
                              </span>
                              {!isEditingOutcome && (
                                <Badge
                                  className={cn('text-[10px] cursor-pointer hover:opacity-80 shrink-0', badgeClass)}
                                  onClick={(e) => { e.stopPropagation(); setEditingOutcomeId(b.id); }}
                                  title="Tap to edit outcome"
                                >
                                  {badgeLabel}
                                </Badge>
                              )}
                            </div>

                            {/* Inline outcome editor */}
                            {isEditingOutcome && (
                              <OutcomeEditor
                                bookingId={b.id}
                                memberName={b.member_name}
                                classDate={b.class_date}
                                currentResult={resultLabel}
                                currentObjection={b.primary_objection}
                                onDone={() => { setEditingOutcomeId(null); fetchMyDayData(); }}
                              />
                            )}

                            {/* Row 2: Intro type + Lead source + Time · Coach (unchanged from pre-log) */}
                            <div className="flex items-center gap-1.5 flex-wrap mt-1 text-[13px] md:text-[11px]">
                              <IntroTypeBadge isSecondIntro={is2nd} />
                              <LeadSourceTag source={b.lead_source} />
                              <span className="text-muted-foreground">
                                {b.intro_time ? format(parseISO(`2000-01-01T${b.intro_time}`), 'h:mm a') : 'Time TBD'}
                              </span>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-muted-foreground">{b.coach_name}</span>
                            </div>

                            {/* Row 3: Outcome details in small gray text */}
                            {detailLine && (
                              <p className="text-[11px] text-muted-foreground mt-1">{detailLine}</p>
                            )}

                            {/* Journey guidance for logged cards */}
                            {(() => {
                              const guidance = getJourneyGuidance({
                                isBooked: true,
                                classDate: b.class_date,
                                classTime: b.intro_time,
                                introResult: b.intro_result,
                                primaryObjection: b.primary_objection,
                                isSecondIntro: is2nd,
                                confirmationSent: true,
                                qCompleted: true,
                                welcomeSent: (scriptActionsMap.get(b.id) || []).some(a => a.action_type === 'welcome_sent' || a.script_category === 'welcome_congrats'),
                                followUpSent: followUpVerifiedMap.get(b.id) === true,
                              });
                              return guidance ? <CardGuidance text={guidance} className="mt-1.5" /> : null;
                            })()}
                          </div>
                          <div className="px-3 pt-2 pb-1">
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
                              onQuestionnaireCreated={(slug) => {
                                setTodayBookings(prev => prev.map(bk => bk.id === b.id ? {...bk, questionnaire_slug: slug, questionnaire_status: 'not_sent'} : bk));
                                setTomorrowBookings(prev => prev.map(bk => bk.id === b.id ? {...bk, questionnaire_slug: slug, questionnaire_status: 'not_sent'} : bk));
                              }}
                            />
                          </div>

                          {/* Row 5: Contextual actions - ALWAYS visible */}
                          <div className="px-3 pb-3">
                            {isPurchased && (
                              <PostPurchaseActions memberName={b.member_name} bookingId={b.id} />
                            )}
                            {isDidntBuy && (
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-amber-50 rounded px-2 py-1.5 mt-1">
                                <CheckCircle2 className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                {followUpVerified === false
                                  ? <span className="text-destructive">Follow-up queue not created. <button className="underline" onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        const { generateFollowUpEntries } = await import('@/components/dashboard/FollowUpQueue');
                                        const entries = generateFollowUpEntries(b.member_name, 'didnt_buy', b.class_date, b.id, null, false, b.primary_objection, null);
                                        await supabase.from('follow_up_queue').insert(entries);
                                        toast.success('Follow-up queue created');
                                        fetchMyDayData();
                                      } catch { toast.error('Failed'); }
                                    }}>Tap to retry</button></span>
                                  : "Follow-up Touch 1 queued for today. Tap Script to send."
                                }
                              </div>
                            )}
                            {isNoShow && (
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-red-50 rounded px-2 py-1.5 mt-1">
                                <CheckCircle2 className="w-3 h-3 text-red-500 flex-shrink-0" />
                                {followUpVerified === false
                                  ? <span className="text-destructive">Follow-up queue not created. <button className="underline" onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        const { generateFollowUpEntries } = await import('@/components/dashboard/FollowUpQueue');
                                        const entries = generateFollowUpEntries(b.member_name, 'no_show', b.class_date, b.id, null, false, null, null);
                                        await supabase.from('follow_up_queue').insert(entries);
                                        toast.success('Follow-up queue created');
                                        fetchMyDayData();
                                      } catch { toast.error('Failed'); }
                                    }}>Tap to retry</button></span>
                                  : "No-show follow-up queued. Tap Script to send rebook text."
                                }
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {allLogged && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        All intros logged! Great work.
                      </div>
                    )}
                  </>
                )}
              </CollapsibleSection>
            );
          }

          case 'new-leads':
            if (sortedLeads.length === 0) return null;
            return (
              <CollapsibleSection
                key="new-leads"
                id="new-leads"
                title="New Leads"
                icon={<UserPlus className="w-4 h-4 text-info" />}
                count={sortedLeads.length}
                defaultOpen={sortedLeads.length > 0}
                emphasis={sectionEmphasis('leads')}
                subLabel={emphasisLabel('leads') || undefined}
              >
                <SectionHelp text="New people who haven't been contacted yet. Tap Script to get a personalized opener. Green = just came in, red = waiting too long." />
                {sortedLeads.map(lead => {
                  const minutesAgo = differenceInMinutes(new Date(), new Date(lead.created_at));
                  const speedColor = minutesAgo < 5 ? 'bg-success text-success-foreground' 
                    : minutesAgo < 30 ? 'bg-warning text-warning-foreground' 
                    : 'bg-destructive text-destructive-foreground';
                  const isAlreadyBooked = alreadyBookedLeadIds.has(lead.id);
                  const isExpanded = expandedCardId === `lead-${lead.id}`;

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
                    <div key={lead.id} className="rounded-lg border bg-card transition-all">
                      <div
                        className="p-3 md:p-2.5 cursor-pointer min-h-[44px]"
                        onClick={() => toggleCard(`lead-${lead.id}`)}
                      >
                        {/* Row 1: Full name (never truncate) */}
                        <p className="font-semibold text-[17px] md:text-sm whitespace-normal break-words leading-tight">{lead.first_name} {lead.last_name}</p>
                        {/* Row 2: Source + timing */}
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <LeadSourceTag source={lead.source} className="flex-shrink-0" />
                          <span className="text-[13px] md:text-[11px] text-muted-foreground">
                            {minutesAgo < 60 ? `${minutesAgo}m ago` : isToday(new Date(lead.created_at)) ? format(new Date(lead.created_at), 'h:mm a') : format(new Date(lead.created_at), 'MMM d')}
                          </span>
                          <Badge className={`text-[10px] px-1.5 py-0 h-4 flex-shrink-0 ${speedColor}`}>
                            {minutesAgo < 5 ? 'Just now' : minutesAgo < 30 ? 'Act fast' : 'Overdue'}
                          </Badge>
                        </div>
                        {/* Row 3: Already booked badge if applicable */}
                        {isAlreadyBooked && (
                          <div className="mt-1">
                            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-warning text-warning-foreground border-transparent">
                              Already Booked?
                            </Badge>
                          </div>
                        )}
                        {/* Journey guidance - always visible on lead cards */}
                        <CardGuidance text={getLeadGuidance(minutesAgo)} className="mt-1.5" />
                      </div>
                      {isExpanded && (
                        <div className="px-2.5 pb-2.5 space-y-2 border-t pt-2">
                          {isAlreadyBooked && (
                            <Button variant="outline" size="sm" className="w-full h-7 text-[11px]" onClick={handleDismissBooked}>
                              Dismiss – Move to Booked
                            </Button>
                          )}
                          <CardGuidance text={getLeadGuidance(minutesAgo)} />
                        </div>
                      )}
                      <div className="px-3 md:px-2.5 pb-2.5">
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
                    </div>
                  );
                })}
                <Button variant="ghost" size="sm" className="w-full text-primary" onClick={() => navigate('/leads')}>
                  View all leads →
                </Button>
              </CollapsibleSection>
            );

          case 'tomorrows-intros':
            return (
              <CollapsibleSection
                key="tomorrows-intros"
                id="tomorrows-intros"
                title="Tomorrow's Intros"
                icon={<CalendarCheck className="w-4 h-4 text-info" />}
                count={tomorrowBookings.length}
                defaultOpen={tomorrowBookings.length > 0}
                emphasis={sectionEmphasis('tomorrow')}
                subLabel={emphasisLabel('tomorrow') || undefined}
              >
                <SectionHelp text="Intros booked for tomorrow. Send confirmation texts today." />
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : tomorrowBookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No intros scheduled for tomorrow</p>
                ) : (
                  tomorrowBookings.map(b => renderCompactIntroCard(b, true))
                )}
              </CollapsibleSection>
            );

          case 'coming-up':
            return (
              <CollapsibleSection
                key="coming-up"
                id="coming-up"
                title="Coming Up"
                icon={<Clock className="w-4 h-4 text-muted-foreground" />}
                defaultOpen={false}
              >
                <SoonLayer />
              </CollapsibleSection>
            );

          case 'followups-due':
            return (
              <CollapsibleSection
                key="followups-due"
                id="followups-due"
                title="Follow-Ups Due"
                icon={<Clock className="w-4 h-4 text-warning" />}
                count={followUpsDueCount}
                defaultOpen={false}
                emphasis={sectionEmphasis('followups')}
                subLabel={emphasisLabel('followups') || undefined}
              >
                <FollowUpsDueToday onRefresh={fetchMyDayData} onCountChange={setFollowUpsDueCount} />
              </CollapsibleSection>
            );

          case 'completed-today':
            // No longer rendered as separate section - completed cards are shown inline in todays-intros
            return null;

          case 'shift-handoff':
            return (
              <CollapsibleSection
                key="shift-handoff"
                id="shift-handoff"
                title="Shift Summary"
                icon={<FileText className="w-4 h-4 text-primary" />}
                defaultOpen={false}
              >
                <ShiftHandoffSummary
                  todayCompletedCount={completedTodayBookings.length}
                  todayActiveCount={activeTodayBookings.length}
                  scriptsSentCount={todayScriptsSent}
                  followUpsSentCount={todayFollowUpsSent}
                  userName={user?.name || ''}
                />
              </CollapsibleSection>
            );

          default:
            return null;
        }
      })}

      {/* Close Out Shift */}
      <CloseOutShift
        completedIntros={completedTodayBookings.length}
        activeIntros={activeTodayBookings.length}
        scriptsSent={todayScriptsSent}
        followUpsSent={todayFollowUpsSent}
        purchaseCount={purchaseCount}
        noShowCount={noShowCount}
        didntBuyCount={didntBuyCount}
        topObjection={topObjection}
      />

      {/* Quick-Add FAB */}
      <QuickAddFAB onRefresh={fetchMyDayData} />

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
