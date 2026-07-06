/**
 * My Day Page – Internal tab workspace.
 *
 * Layout order:
 * 1. Floating header (greeting + progress)
 * 2. End Shift button (prominent, at top)
 * 3. Activity Tracker (shift summary)
 * 4. Win the Day checklist
 * 5. This Week's Schedule
 * 6. Tabs (Today, Week, F/U, Leads, IG DMs, Q Hub, Outcomes)
 */
import { isAdmin as isAdminCheck } from '@/lib/auth/roles';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { getTodayStartISO, getTodayYMD } from '@/lib/dateUtils';
import { didIntroActuallyRun } from '@/lib/canon/introRules';
import { isMissingCoach } from '@/lib/intros/coachAttribution';
import { AlertTriangle } from 'lucide-react';

import { formatDisplayTime } from '@/lib/time/timeUtils';
import { Tables } from '@/integrations/supabase/types';
import { ShiftChecklist } from './ShiftChecklist';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CalendarDays, Clock, Users, Moon, Sun, UserPlus, FileText } from 'lucide-react';


// Existing components

import { OfflineBanner } from '@/components/dashboard/OfflineBanner';
import { OwnItMentionsCard } from '@/components/shared/OwnItMentionsCard';

import { QuickAddFAB } from '@/components/dashboard/QuickAddFAB';
import { BookIntroDialog } from '@/components/leads/BookIntroDialog';
import { LeadDetailSheet } from '@/components/leads/LeadDetailSheet';
import { useRealtimeMyDay } from '@/hooks/useRealtimeMyDay';
import FollowUpList from '@/features/followUp/FollowUpList';
import { CloseOutShift } from '@/components/dashboard/CloseOutShift';
import { MyDayShiftSummary } from './MyDayShiftSummary';


// Prep/Script/Coach/Outcome drawers
import { PrepDrawer } from '@/components/dashboard/PrepDrawer';
import { ScriptPickerSheet } from '@/components/scripts/ScriptPickerSheet';
import { OutcomeDrawer } from '@/components/myday/OutcomeDrawer';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';


// Canonical intros queue
import UpcomingIntrosCard from './UpcomingIntrosCard';
import { MyDayNewLeadsTab } from './MyDayNewLeadsTab';


import { WhatsChangedDialog } from '@/components/shared/WhatsChangedDialog';
import { StudioIntelligenceCard } from '@/components/admin/StudioIntelligenceCard';

import { useDarkMode } from '@/hooks/useDarkMode';
import { NewLeadsAlert } from './NewLeadsAlert';
import { MyDayScriptsTab } from './MyDayScriptsTab';
import { VipClaimBanner } from './VipClaimBanner';

import { ClassMilestoneChecks } from './ClassMilestoneChecks';
import { ReferralAskActions } from './ReferralAskActions';
import { MilestonesDeploySection } from '@/components/dashboard/MilestonesDeploySection';
import { IntroLinkBookingBanner } from './IntroLinkBookingBanner';
import { PlanningToBuyUrgent } from './PlanningToBuyUrgent';
import { AssignCoachDialog } from './AssignCoachDialog';

import { OTF, Theme, brandFont } from '@/lib/otfBrand';
import { NetGainScoreboard } from '@/components/shared/NetGainScoreboard';

export default function MyDayPage() {
  const { user } = useAuth();
  const { introsBooked, introsRun, sales, refreshData } = useData();
  const { isDark, toggle: toggleDark } = useDarkMode();

  const isUserAdmin = isAdminCheck(user);

  const [followUpsDueCount, setFollowUpsDueCount] = useState(0);
  const [todayScriptsSent, setTodayScriptsSent] = useState(0);
  const [todayFollowUpsSent, setTodayFollowUpsSent] = useState(0);
  const [bookIntroLead, setBookIntroLead] = useState<Tables<'leads'> | null>(null);
  const [detailLead, setDetailLead] = useState<Tables<'leads'> | null>(null);
  const [needsOutcomeCount, setNeedsOutcomeCount] = useState(0);
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  
  const [activeTab, setActiveTab] = useState('intros');
  const [isAdmin, setIsAdmin] = useState(false);
  const [intelligenceDismissed, setIntelligenceDismissed] = useState(false);

  // Prep/Script/Coach/Outcome drawer state
  const [prepBookingId, setPrepBookingId] = useState<string | null>(null);
  const [prepIsSecondIntro, setPrepIsSecondIntro] = useState(false);
  const [prepAutoPrint, setPrepAutoPrint] = useState(false);
  const [scriptBookingId, setScriptBookingId] = useState<string | null>(null);
  const [scriptIsSecondIntro, setScriptIsSecondIntro] = useState(false);
  const [scriptFromFollowUp, setScriptFromFollowUp] = useState(false);
  const [outcomeBookingId, setOutcomeBookingId] = useState<string | null>(null);
  
  const [scriptQLink, setScriptQLink] = useState<string | undefined>();

  // Fetch Q link when script drawer opens
  useEffect(() => {
    if (!scriptBookingId) { setScriptQLink(undefined); return; }
    (async () => {
      const { data } = await supabase
        .from('intro_questionnaires')
        .select('slug')
        .eq('booking_id', scriptBookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.slug) {
        setScriptQLink(`https://otf-tuscaloosa.lovable.app/q/${(data as any).slug}`);
      } else {
        setScriptQLink(undefined);
      }
    })();
  }, [scriptBookingId]);

  // Derived booking data for drawers
  const getBookingById = useCallback((id: string) =>
    introsBooked.find(b => b.id === id), [introsBooked]);

  const prepBooking = prepBookingId ? getBookingById(prepBookingId) : null;
  const scriptBooking = scriptBookingId ? getBookingById(scriptBookingId) : null;
  const localOutcomeBooking = outcomeBookingId ? getBookingById(outcomeBookingId) : null;

  // Fallback: fetch booking from DB when not in current week's introsBooked (e.g. follow-up items)
  const [fallbackBooking, setFallbackBooking] = useState<any>(null);
  // Boolean-ify localOutcomeBooking so reference churn from introsBooked refreshes
  // doesn't re-fire this effect (which would re-fetch and create a new fallbackBooking
  // ref → re-render → loop).
  const hasLocalOutcomeBooking = !!localOutcomeBooking;
  useEffect(() => {
    if (!outcomeBookingId || hasLocalOutcomeBooking) {
      setFallbackBooking(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('intros_booked')
        .select('*')
        .eq('id', outcomeBookingId)
        .maybeSingle();
      setFallbackBooking(data);
    })();
  }, [outcomeBookingId, hasLocalOutcomeBooking]);

  const outcomeBooking = localOutcomeBooking || fallbackBooking;
  

  // Today's stats
  const todayStr = getTodayYMD();
  const todayBookingsCount = useMemo(() =>
    introsBooked.filter(b => b.class_date === todayStr && !b.deleted_at && b.booking_status_canon !== 'PLANNING_RESCHEDULE' && b.booking_status_canon !== 'CANCELLED').length,
    [introsBooked, todayStr],
  );
  const todayRuns = useMemo(() =>
    introsRun.filter(r => r.run_date === todayStr),
    [introsRun, todayStr],
  );

  // Any recent intro (today or last 7 days) missing a coach → red banner + card alerts.
  // Anchoring to "today or ran-recently" keeps ancient no-coach ghosts out of the alert.
  const tbdCoachBookings = useMemo(() => {
    return introsBooked.filter(b => {
      if (b.deleted_at) return false;
      if (!isMissingCoach(b.coach_name)) return false;
      const status = b.booking_status_canon;
      if (status === 'CANCELLED' || status === 'DELETED_SOFT' || status === 'PLANNING_RESCHEDULE') return false;
      // Show for today or up to 7 days back — the SA should pick immediately
      if (!b.class_date) return false;
      const [y, m, d] = b.class_date.split('-').map(Number);
      const bookingDate = new Date(y, m - 1, d);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diff = (today.getTime() - bookingDate.getTime()) / 86400000;
      return diff >= -1 && diff <= 7;
    });
  }, [introsBooked]);
  const tbdCoachCount = tbdCoachBookings.length;
  const [assignCoachOpen, setAssignCoachOpen] = useState(false);

  // Intros ≥2h past class start with NO logged outcome (missing-outcome banner).
  const missingOutcomeBookings = useMemo(() => {
    const now = Date.now();
    const TWO_HR = 2 * 60 * 60 * 1000;
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    // Set of booking ids that already have a run row
    const ranBookingIds = new Set(
      introsRun.map(r => (r as any).linked_intro_booked_id).filter(Boolean) as string[]
    );
    return introsBooked.filter(b => {
      if (b.deleted_at) return false;
      const status = b.booking_status_canon;
      if (status === 'CANCELLED' || status === 'DELETED_SOFT' || status === 'PLANNING_RESCHEDULE') return false;
      if (ranBookingIds.has(b.id)) return false;
      if (!b.class_date) return false;
      // Prefer explicit class_start_at; else compute local from class_date + intro_time.
      let startMs: number | null = null;
      const startIso = (b as any).class_start_at as string | null | undefined;
      if (startIso) {
        const t = Date.parse(startIso);
        if (!isNaN(t)) startMs = t;
      }
      if (startMs == null) {
        const [y, m, d] = b.class_date.split('-').map(Number);
        const [hh, mm] = (b.intro_time || '00:00').split(':').map(Number);
        startMs = new Date(y, m - 1, d, hh || 0, mm || 0).getTime();
      }
      const elapsed = now - startMs;
      return elapsed >= TWO_HR && elapsed <= SEVEN_DAYS;
    });
  }, [introsBooked, introsRun]);
  const missingOutcomeCount = missingOutcomeBookings.length;

  const completedTodayCount = todayRuns.filter(r => didIntroActuallyRun(r)).length;

  const purchaseTodayCount = useMemo(() =>
    todayRuns.filter(r => {
      const result = r.result || '';
      return ['Premier + OTbeat', 'Premier', 'Elite + OTbeat', 'Elite', 'Basic + OTbeat', 'Basic'].some(
        t => result === t
      );
    }).length,
    [todayRuns],
  );
  const noShowTodayCount = useMemo(() =>
    todayRuns.filter(r => r.result_canon === 'NO_SHOW').length,
    [todayRuns],
  );
  const didntBuyTodayCount = useMemo(() =>
    todayRuns.filter(r => r.result_canon === 'DIDNT_BUY').length,
    [todayRuns],
  );
  const topObjectionToday = useMemo(() => {
    const objections = todayRuns.map(r => (r as any).primary_objection).filter(Boolean) as string[];
    if (!objections.length) return null;
    const freq = objections.reduce<Record<string, number>>((acc, o) => { acc[o] = (acc[o] || 0) + 1; return acc; }, {});
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [todayRuns]);

  // Realtime — debounced so a burst of writes (script_actions, questionnaires)
  // collapses into ONE metrics refetch per ~2.5s window.
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleRealtimeUpdate = useCallback(() => {
    if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
    realtimeTimerRef.current = setTimeout(() => { fetchMetrics(); }, 2500);
  }, []);
  useEffect(() => () => {
    if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
  }, []);
  useRealtimeMyDay(handleRealtimeUpdate);


  // Listen for Prep/Script/Coach events from IntroRowCard
  useEffect(() => {
    const onPrep = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setPrepBookingId(detail.bookingId);
      setPrepIsSecondIntro(!!detail.isSecondIntro);
      setPrepAutoPrint(!!detail.autoPrint);
    };
    const onScript = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setScriptBookingId(detail.bookingId);
      setScriptIsSecondIntro(!!detail.isSecondIntro);
      setScriptFromFollowUp(!!detail.fromFollowUp);
    };
    const onOutcome = (e: Event) => setOutcomeBookingId((e as CustomEvent).detail.bookingId);
    window.addEventListener('myday:open-prep', onPrep);
    window.addEventListener('myday:open-script', onScript);
    window.addEventListener('myday:open-outcome', onOutcome);
    return () => {
      window.removeEventListener('myday:open-prep', onPrep);
      window.removeEventListener('myday:open-script', onScript);
      window.removeEventListener('myday:open-outcome', onOutcome);
    };
  }, []);

  // Listen for tab switch events from ShiftChecklist follow-up deep link
  useEffect(() => {
    const onSwitchTab = (e: Event) => {
      const tab = (e as CustomEvent).detail?.tab;
      if (tab) setActiveTab(tab);
    };
    window.addEventListener('myday:switch-tab', onSwitchTab);
    return () => window.removeEventListener('myday:switch-tab', onSwitchTab);
  }, []);

  useEffect(() => {
    fetchMetrics();
    // Check admin role
    if (user?.id) {
      supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
        .then(({ data }) => { setIsAdmin(!!data); });
    }
    // Check intelligence dismissal for today
    const todayKey = `si-dismissed-${getTodayYMD()}`;
    setIntelligenceDismissed(localStorage.getItem(todayKey) === 'true');
    // fetchMetrics intentionally omitted — it's stable via useCallback on the same primitive deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name, user?.id]);

  // Stable primitive deps only — never depend on the user object reference, which
  // changes on every AuthContext re-render and would cause an infinite refetch loop.
  const userName = user?.name ?? '';
  const userId = user?.id ?? '';
  const fetchMetrics = useCallback(async () => {
    if (!userName) return;
    try {
      const today = getTodayYMD();
      const todayStart = getTodayStartISO();

      const { data: actionsData } = await supabase
        .from('script_actions')
        .select('action_type')
        .gte('completed_at', todayStart)
        .eq('completed_by', userName);
      setTodayScriptsSent((actionsData || []).filter(a => a.action_type === 'script_sent').length);

      const { count: fuSentCount } = await supabase
        .from('follow_up_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'sent')
        .gte('sent_at', todayStart);
      setTodayFollowUpsSent(fuSentCount || 0);

      const cutoff = format(new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
      const { count: unresolved } = await supabase
        .from('intros_booked')
        .select('id', { count: 'exact', head: true })
        .gte('class_date', cutoff)
        .lt('class_date', today)
        .is('deleted_at', null)
        .not('booking_status_canon', 'in', '("CANCELLED","PLANNING_RESCHEDULE")');
      setNeedsOutcomeCount(unresolved || 0);
    } catch (err) {
      console.error('MyDay metrics fetch error:', err);
    }
  }, [userName, userId]);


  // Build script merge context for ScriptPickerSheet
  const scriptMergeContext = useMemo(() => {
    if (!scriptBooking) return {};
    const firstName = scriptBooking.member_name.split(' ')[0] || '';
    const lastName = scriptBooking.member_name.split(' ').slice(1).join(' ') || '';
    const rawCoach = scriptBooking.coach_name?.trim();
    const coachResolved = rawCoach && !/^tbd$/i.test(rawCoach) ? rawCoach : null;
    const classDate = scriptBooking.class_date;
    let todayTomorrow = '';
    if (classDate === todayStr) {
      todayTomorrow = 'today';
    } else {
      const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');
      todayTomorrow = classDate === tomorrow ? 'tomorrow' : (() => { try { return format(new Date(classDate + 'T12:00:00'), 'EEEE'); } catch { return ''; } })();
    }
    return {
      'first-name': firstName,
      'last-name': lastName,
      'sa-name': user?.name || '',
      'coach-name': coachResolved || 'your coach',
      'coach-first-name': coachResolved ? coachResolved.split(/\s+/)[0] : 'your coach',
      'today/tomorrow': todayTomorrow,
      day: (() => { try { return format(new Date(classDate + 'T12:00:00'), 'EEEE, MMMM d'); } catch { return ''; } })(),
      time: formatDisplayTime(scriptBooking.intro_time),
      'location-name': 'Tuscaloosa',
      'questionnaire-link': scriptQLink || '',
    };
  }, [scriptBooking, user?.name, todayStr, scriptQLink]);

  const greeting = new Date().getHours() < 12 ? 'morning' : 'afternoon';

  // OTF brand tab-trigger styling — applied inline so tokens beat theme defaults
  const tabTriggerBase =
    'flex flex-col items-center gap-0.5 py-2 text-[10px] leading-tight transition-colors ' +
    'data-[state=active]:font-bold';
  const tabTriggerStyle = {
    color: OTF.bone,
    backgroundColor: 'transparent',
    borderRadius: 0,
    ...brandFont,
  } as const;
  // Active tab: orange bottom bar via box-shadow (works inside grid)
  const activeShadow = { boxShadow: `inset 0 -2px 0 ${OTF.orange}` };

  return (
    <div
      className="max-w-full overflow-x-hidden pb-[calc(7rem_+_env(safe-area-inset-bottom))]"
      style={{ backgroundColor: OTF.dark, color: OTF.bone, ...brandFont }}
    >

      <WhatsChangedDialog />

      {/* ═══ FLOATING HEADER — always visible ═══ */}
      <div
        className="sticky top-0 z-20 px-4 py-4"
        style={{
          backgroundColor: OTF.dark,
          borderBottom: `1px solid ${Theme.border}`,
        }}
      >
        <p
          className="text-[10px] uppercase mb-1"
          style={{ color: OTF.bone, opacity: 0.55, letterSpacing: '0.18em' }}
        >
          Good {greeting}
        </p>
        <h1
          className="text-2xl leading-none"
          style={{ color: OTF.bone, fontWeight: 800, ...brandFont }}
        >
          {user?.name}.
        </h1>
        <p className="text-xs mt-1.5" style={{ color: OTF.bone, opacity: 0.6 }}>
          {format(new Date(), 'EEEE, MMMM d')} · Your shift home.
        </p>
      </div>

      {/* ═══ PERSISTENT REMINDER BANNER ═══ */}
      <div
        className="mx-4 mt-3 px-3 py-2"
        style={{ borderLeft: `2px solid ${OTF.orange}` }}
      >
        <p className="text-xs" style={{ color: OTF.bone, opacity: 0.9 }}>
          Book in Mindbody <span style={{ color: OTF.orange, fontWeight: 700 }}>and</span> here.
          That's how you get credit and commission.
        </p>
      </div>

      <OfflineBanner />

      <div className="mx-4 mt-3">
        <NetGainScoreboard />
      </div>



      {tbdCoachCount > 0 && (
        <div className="mx-4 mt-3">
          <button
            type="button"
            onClick={() => setOutcomeBookingId(tbdCoachBookings[0].id)}
            className="w-full flex items-center justify-center gap-2 px-3 py-3 text-sm min-h-[44px] transition-opacity hover:opacity-90"
            style={{
              backgroundColor: OTF.orange,
              color: OTF.dark,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              ...brandFont,
            }}
            aria-label="Assign coach to intros missing a coach"
          >
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>
              {tbdCoachCount} intro{tbdCoachCount === 1 ? '' : 's'} missing a coach — tap to assign
            </span>
          </button>
        </div>
      )}

      <div className="px-4 pt-3">
        <IntroLinkBookingBanner />
      </div>

      <div className="px-4 pt-3">
        <PlanningToBuyUrgent />
      </div>

      <OwnItMentionsCard />
      <VipClaimBanner />

      {/* ═══ SHIFT TASK CHECKLIST ═══ */}
      <div className="px-[5px] py-[10px] my-0 pb-0 pr-[5px] pt-0">
        <ShiftChecklist />
      </div>

      {/* ═══ INTERNAL TABS ═══ */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div
          className="sticky top-[var(--floating-header-h,140px)] z-10 px-3 pt-2 pb-0"
          style={{ backgroundColor: OTF.dark }}
        >
          <TabsList
            className="w-full grid grid-cols-4 h-auto gap-0 p-0 rounded-none"
            style={{
              backgroundColor: 'transparent',
              borderBottom: `1px solid ${Theme.border}`,
            }}
          >
            <TabsTrigger
              value="intros"
              className={tabTriggerBase}
              style={{ ...tabTriggerStyle, ...(activeTab === 'intros' ? activeShadow : {}) }}
            >
              <CalendarDays className="w-3.5 h-3.5" style={{ color: activeTab === 'intros' ? OTF.orange : OTF.bone }} />
              <span>Intros</span>
              {todayBookingsCount > 0 && (
                <span
                  className="h-3.5 px-1 text-[9px] min-w-[18px] flex items-center justify-center"
                  style={{ backgroundColor: OTF.orange, color: OTF.dark, fontWeight: 700 }}
                >
                  {todayBookingsCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="leads"
              className={tabTriggerBase}
              style={{ ...tabTriggerStyle, ...(activeTab === 'leads' ? activeShadow : {}) }}
            >
              <UserPlus className="w-3.5 h-3.5" style={{ color: activeTab === 'leads' ? OTF.orange : OTF.bone }} />
              <span>Leads</span>
              {newLeadsCount > 0 && (
                <span
                  className="h-3.5 px-1 text-[9px] min-w-[18px] flex items-center justify-center"
                  style={{ backgroundColor: OTF.orange, color: OTF.dark, fontWeight: 700 }}
                >
                  {newLeadsCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="followups"
              className={tabTriggerBase}
              style={{ ...tabTriggerStyle, ...(activeTab === 'followups' ? activeShadow : {}) }}
            >
              <Clock className="w-3.5 h-3.5" style={{ color: activeTab === 'followups' ? OTF.orange : OTF.bone }} />
              <span>Follow-Up</span>
              {followUpsDueCount > 0 && (
                <span
                  className="h-3.5 px-1 text-[9px] min-w-[18px] flex items-center justify-center"
                  style={{ backgroundColor: OTF.orange, color: OTF.dark, fontWeight: 700 }}
                >
                  {followUpsDueCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="scripts"
              className={tabTriggerBase}
              style={{ ...tabTriggerStyle, ...(activeTab === 'scripts' ? activeShadow : {}) }}
            >
              <FileText className="w-3.5 h-3.5" style={{ color: activeTab === 'scripts' ? OTF.orange : OTF.bone }} />
              <span>Scripts</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab content */}
        <div className="px-4 pt-3 space-y-3 rounded-none pb-[10px]">
          <TabsContent value="intros" className="mt-0 space-y-3">
            <UpcomingIntrosCard userName={user?.name || ''} fixedTimeRange="weekFull" />
            <NewLeadsAlert />
          </TabsContent>

          <TabsContent value="scripts" className="mt-0 space-y-3">
            <MyDayScriptsTab />
          </TabsContent>

          <TabsContent value="followups" className="mt-0 space-y-3">
            <FollowUpList onCountChange={setFollowUpsDueCount} onRefresh={fetchMetrics} />
          </TabsContent>

          <TabsContent value="leads" className="mt-0 space-y-3">
            <div className="mb-1">
              <h2 className="text-sm font-semibold">New Leads</h2>
              <p className="text-xs text-muted-foreground">Email-parsed leads — speed to contact matters</p>
            </div>
            <MyDayNewLeadsTab onCountChange={setNewLeadsCount} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Log-a-lead + Sourced-leads-to-text sections removed per SA feedback */}

      {/* ═══ CLASS MILESTONE CHECKS ═══ */}
      <div className="px-[5px] py-[10px] my-0 pb-0 pr-[5px] pt-0">
        <ClassMilestoneChecks />
      </div>

      {/* ═══ MILESTONES & DEPLOY (moved from WIG) ═══ */}
      <div className="px-[5px] pt-2">
        <MilestonesDeploySection />
      </div>

      {/* ═══ ASK FOR A REFERRAL ═══ */}
      <div className="px-[5px] py-[10px] my-0 pb-0 pr-[5px] pt-0">
        <ReferralAskActions />
      </div>

      {/* Floating End Shift bar removed — End Shift stays reachable from the FAB. */}

      {/* FAB */}
      <QuickAddFAB
        onRefresh={fetchMetrics}
        completedIntros={completedTodayCount}
        activeIntros={todayBookingsCount - completedTodayCount}
        scriptsSent={todayScriptsSent}
        followUpsSent={todayFollowUpsSent}
        purchaseCount={purchaseTodayCount}
        noShowCount={noShowTodayCount}
        didntBuyCount={didntBuyTodayCount}
        topObjection={topObjectionToday}
        onEndShift={refreshData}
      />

      {/* ═══ DRAWERS / DIALOGS ═══ */}
      {prepBooking && (
        <PrepDrawer
          open={!!prepBookingId}
          onOpenChange={(open) => { if (!open) { setPrepBookingId(null); setPrepAutoPrint(false); } }}
          memberName={prepBooking.member_name}
          memberKey={prepBooking.member_name}
          bookingId={prepBooking.id}
          classDate={prepBooking.class_date}
          classTime={prepBooking.intro_time}
          coachName={prepBooking.coach_name}
          leadSource={prepBooking.lead_source}
          isSecondIntro={prepIsSecondIntro}
          originatingBookingId={prepBooking.originating_booking_id}
          autoPrint={prepAutoPrint}
          phone={null}
          email={null}
        />
      )}

      {scriptBooking && (
        <ScriptPickerSheet
          open={!!scriptBookingId}
          onOpenChange={(open) => { if (!open) setScriptBookingId(null); }}
          suggestedCategories={scriptIsSecondIntro ? ['confirmation'] : ['confirmation', 'questionnaire', 'follow_up']}
          mergeContext={scriptMergeContext}
          bookingId={scriptBooking.id}
          onLogged={async () => {
            const bId = scriptBookingId;
            const wasFollowUp = scriptFromFollowUp;
            setScriptBookingId(null);
            setScriptFromFollowUp(false);
            fetchMetrics();
            // Auto-advance follow-up contact date when script sent from F/U
            if (wasFollowUp && bId) {
              try {
                const { count } = await supabase
                  .from('script_actions')
                  .select('id', { count: 'exact', head: true })
                  .eq('booking_id', bId);
                const touchCount = count || 0;
                let daysUntilNext = 2;
                if (touchCount >= 4) daysUntilNext = 7;
                else if (touchCount >= 3) daysUntilNext = 5;
                else if (touchCount >= 2) daysUntilNext = 3;
                const nextDate = format(new Date(Date.now() + daysUntilNext * 86400000), 'yyyy-MM-dd');
                await supabase.from('intros_booked').update({
                  reschedule_contact_date: nextDate,
                  last_edited_at: new Date().toISOString(),
                } as any).eq('id', bId);
                toast.success('Script sent — follow-up contact date advanced');
              } catch (err) {
                console.error('Failed to advance contact date:', err);
              }
            }
          }}
        />
      )}

      <Sheet open={!!outcomeBookingId} onOpenChange={(open) => { if (!open) setOutcomeBookingId(null); }}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Log Outcome</SheetTitle>
          </SheetHeader>
          {outcomeBooking && (
            <OutcomeDrawer
              bookingId={outcomeBooking.id}
              memberName={outcomeBooking.member_name}
              classDate={outcomeBooking.class_date}
              introTime={outcomeBooking.intro_time}
              leadSource={outcomeBooking.lead_source}
              editedBy={user?.name || 'Unknown'}
              initialCoach={outcomeBooking.coach_name || ''}
              onSaved={() => { setOutcomeBookingId(null); refreshData(); fetchMetrics(); }}
              onCancel={() => setOutcomeBookingId(null)}
            />
          )}
        </SheetContent>
      </Sheet>


      {bookIntroLead && (
        <BookIntroDialog
          open={!!bookIntroLead}
          onOpenChange={open => { if (!open) setBookIntroLead(null); }}
          lead={bookIntroLead}
          onDone={() => { setBookIntroLead(null); fetchMetrics(); }}
        />
      )}
      <LeadDetailSheet
        lead={detailLead}
        activities={[]}
        open={!!detailLead}
        onOpenChange={open => { if (!open) setDetailLead(null); }}
        onRefresh={fetchMetrics}
      />
    </div>
  );
}
