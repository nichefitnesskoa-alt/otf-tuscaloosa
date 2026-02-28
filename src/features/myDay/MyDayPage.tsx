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
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { formatDisplayTime } from '@/lib/time/timeUtils';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CalendarDays, Clock, ClipboardList, Users, Moon, Sun, CheckCircle2, UserPlus, Instagram } from 'lucide-react';
import { TodayActivityLog } from '@/components/dashboard/TodayActivityLog';

// Existing components
import { OnboardingOverlay } from '@/components/dashboard/OnboardingOverlay';
import { OfflineBanner } from '@/components/dashboard/OfflineBanner';
import { QuestionnaireHub } from '@/components/dashboard/QuestionnaireHub';
import { QuickAddFAB } from '@/components/dashboard/QuickAddFAB';
import { BookIntroDialog } from '@/components/leads/BookIntroDialog';
import { LeadDetailSheet } from '@/components/leads/LeadDetailSheet';
import { useRealtimeMyDay } from '@/hooks/useRealtimeMyDay';
import FollowUpTabs from '@/features/followUp/FollowUpTabs';
import { CloseOutShift } from '@/components/dashboard/CloseOutShift';

// Prep/Script/Coach drawers
import { PrepDrawer } from '@/components/dashboard/PrepDrawer';
import { ScriptPickerSheet } from '@/components/scripts/ScriptPickerSheet';


// Canonical intros queue
import UpcomingIntrosCard from './UpcomingIntrosCard';
import { MyDayNewLeadsTab } from './MyDayNewLeadsTab';
import { MyDayIgDmTab } from './MyDayIgDmTab';
import { WinTheDay } from './WinTheDay';
import { WhatsChangedDialog } from '@/components/shared/WhatsChangedDialog';
import { StudioIntelligenceCard } from '@/components/admin/StudioIntelligenceCard';

// Dark mode helpers
function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('otf-dark-mode');
    return stored === null ? true : stored === 'true';
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('otf-dark-mode', String(isDark));
  }, [isDark]);

  return { isDark, toggle: () => setIsDark(v => !v) };
}

export default function MyDayPage() {
  const { user } = useAuth();
  const { introsBooked, introsRun, sales, refreshData } = useData();
  const { isDark, toggle: toggleDark } = useDarkMode();

  const [followUpsDueCount, setFollowUpsDueCount] = useState(0);
  const [todayScriptsSent, setTodayScriptsSent] = useState(0);
  const [todayFollowUpsSent, setTodayFollowUpsSent] = useState(0);
  const [bookIntroLead, setBookIntroLead] = useState<Tables<'leads'> | null>(null);
  const [detailLead, setDetailLead] = useState<Tables<'leads'> | null>(null);
  const [needsOutcomeCount, setNeedsOutcomeCount] = useState(0);
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  const [igDmCount, setIgDmCount] = useState(0);
  const [activeTab, setActiveTab] = useState('today');
  const [isAdmin, setIsAdmin] = useState(false);
  const [intelligenceDismissed, setIntelligenceDismissed] = useState(false);

  // Prep/Script/Coach drawer state
  const [prepBookingId, setPrepBookingId] = useState<string | null>(null);
  const [scriptBookingId, setScriptBookingId] = useState<string | null>(null);
  const [scriptIsSecondIntro, setScriptIsSecondIntro] = useState(false);
  
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
  

  // Today's stats
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayBookingsCount = useMemo(() =>
    introsBooked.filter(b => b.class_date === todayStr && !b.deleted_at).length,
    [introsBooked, todayStr],
  );
  const todayRuns = useMemo(() =>
    introsRun.filter(r => r.run_date === todayStr),
    [introsRun, todayStr],
  );
  const completedTodayCount = todayRuns.length;
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

  // Realtime
  const handleRealtimeUpdate = useCallback(() => {
    const timer = setTimeout(() => fetchMetrics(), 1500);
    return () => clearTimeout(timer);
  }, []);
  useRealtimeMyDay(handleRealtimeUpdate);

  // Listen for Prep/Script/Coach events from IntroRowCard
  useEffect(() => {
    const onPrep = (e: Event) => setPrepBookingId((e as CustomEvent).detail.bookingId);
    const onScript = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setScriptBookingId(detail.bookingId);
      setScriptIsSecondIntro(!!detail.isSecondIntro);
    };
    window.addEventListener('myday:open-prep', onPrep);
    window.addEventListener('myday:open-script', onScript);
    return () => {
      window.removeEventListener('myday:open-prep', onPrep);
      window.removeEventListener('myday:open-script', onScript);
    };
  }, []);

  useEffect(() => {
    fetchMetrics();
    // Check admin role
    if (user?.id) {
      supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
        .then(({ data }) => { setIsAdmin(!!data); });
    }
    // Check intelligence dismissal for today
    const todayKey = `si-dismissed-${format(new Date(), 'yyyy-MM-dd')}`;
    setIntelligenceDismissed(localStorage.getItem(todayKey) === 'true');
  }, [user?.name, user?.id]);

  const fetchMetrics = async () => {
    if (!user?.name) return;
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayStart = today + 'T00:00:00';

      const { data: actionsData } = await supabase
        .from('script_actions')
        .select('action_type')
        .gte('completed_at', todayStart)
        .eq('completed_by', user.name);
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
        .neq('booking_status_canon', 'CANCELLED');
      setNeedsOutcomeCount(unresolved || 0);
    } catch (err) {
      console.error('MyDay metrics fetch error:', err);
    }
  };

  const { completedActions, totalActions } = useMemo(() => {
    const total = todayBookingsCount + followUpsDueCount;
    const completed = completedTodayCount + todayFollowUpsSent;
    return { completedActions: completed, totalActions: total };
  }, [todayBookingsCount, completedTodayCount, followUpsDueCount, todayFollowUpsSent]);

  const progressPct = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;

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

  return (
    <div className="max-w-full overflow-x-hidden">
      <OnboardingOverlay />
      <WhatsChangedDialog />

      {/* ═══ FLOATING HEADER — always visible ═══ */}
      <div className="sticky top-0 z-20 bg-background border-b-2 border-primary px-4 py-3 space-y-2.5 shadow-sm">
        {/* Greeting + date + dark toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold leading-tight">Good {greeting}, {user?.name}! 👋</h1>
            <p className="text-xs text-muted-foreground">{format(new Date(), 'EEEE, MMMM d')}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDark}
            className="h-8 w-8"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>

        {/* Progress bar */}
        {totalActions > 0 && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {completedActions}/{totalActions} actions
              </span>
              <span className="font-semibold text-primary">{progressPct}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <OfflineBanner />

      {/* End Shift floating bar rendered below */}

      {/* ═══ WIN THE DAY CHECKLIST ═══ */}
      <WinTheDay onSwitchTab={setActiveTab} />

      {/* ═══ INTERNAL TABS ═══ */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Persistent tab bar */}
        <div className="sticky top-[var(--floating-header-h,140px)] z-10 bg-background px-3 pt-2 pb-0">
          <TabsList className="w-full grid grid-cols-7 h-auto gap-0 bg-muted/60 p-0 rounded-lg border border-primary/40 divide-x divide-primary/20">
            <TabsTrigger value="today" className="flex flex-col items-center gap-0.5 py-1.5 text-[10px] leading-tight rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Today</span>
              {todayBookingsCount > 0 && (
                <Badge variant="secondary" className="h-3.5 px-1 text-[9px] min-w-[18px] flex items-center justify-center">{todayBookingsCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="week" className="flex flex-col items-center gap-0.5 py-1.5 text-[10px] leading-tight rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Week</span>
            </TabsTrigger>
            <TabsTrigger value="followups" className="flex flex-col items-center gap-0.5 py-1.5 text-[10px] leading-tight rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <Clock className="w-3.5 h-3.5" />
              <span>F/U</span>
              {followUpsDueCount > 0 && (
                <Badge variant="destructive" className="h-3.5 px-1 text-[9px] min-w-[18px] flex items-center justify-center">{followUpsDueCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="leads" className="flex flex-col items-center gap-0.5 py-1.5 text-[10px] leading-tight rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <UserPlus className="w-3.5 h-3.5" />
              <span>Leads</span>
              {newLeadsCount > 0 && (
                <Badge variant="destructive" className="h-3.5 px-1 text-[9px] min-w-[18px] flex items-center justify-center">{newLeadsCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="igdm" className="flex flex-col items-center gap-0.5 py-1.5 text-[10px] leading-tight rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <Instagram className="w-3.5 h-3.5" />
              <span>IG DMs</span>
              {igDmCount > 0 && (
                <Badge variant="secondary" className="h-3.5 px-1 text-[9px] min-w-[18px] flex items-center justify-center">{igDmCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="qhub" className="flex flex-col items-center gap-0.5 py-1.5 text-[10px] leading-tight rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Q Hub</span>
            </TabsTrigger>
            <TabsTrigger value="outcome" className="flex flex-col items-center gap-0.5 py-1.5 text-[10px] leading-tight rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <Users className="w-3.5 h-3.5" />
              <span>Outcomes</span>
              {needsOutcomeCount > 0 && (
                <Badge variant="outline" className="h-3.5 px-1 text-[9px] min-w-[18px] flex items-center justify-center border-warning text-warning">{needsOutcomeCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
          {/* Separator line between tabs and content */}
          <div className="h-[2px] bg-primary/40 mt-2" />
        </div>

        {/* Tab content */}
        <div className="px-4 pb-24 pt-3 space-y-3">
          <TabsContent value="today" className="mt-0 space-y-3">
            <TodayActivityLog refreshKey={todayBookingsCount + completedTodayCount} />
            <UpcomingIntrosCard userName={user?.name || ''} fixedTimeRange="today" />
          </TabsContent>

          <TabsContent value="week" className="mt-0 space-y-3">
            <UpcomingIntrosCard userName={user?.name || ''} fixedTimeRange="restOfWeek" />
          </TabsContent>

          <TabsContent value="followups" className="mt-0 space-y-3">
            <FollowUpTabs onCountChange={setFollowUpsDueCount} onRefresh={fetchMetrics} />
          </TabsContent>

          <TabsContent value="leads" className="mt-0 space-y-3">
            <div className="mb-1">
              <h2 className="text-sm font-semibold">New Leads</h2>
              <p className="text-xs text-muted-foreground">Email-parsed leads — speed to contact matters</p>
            </div>
            <MyDayNewLeadsTab onCountChange={setNewLeadsCount} />
          </TabsContent>

          <TabsContent value="igdm" className="mt-0 space-y-3">
            <div className="mb-1">
              <h2 className="text-sm font-semibold">IG DM Tracker</h2>
              <p className="text-xs text-muted-foreground">Track Instagram outreach — DMs, interest, bookings</p>
            </div>
            <MyDayIgDmTab onCountChange={setIgDmCount} />
          </TabsContent>

          <TabsContent value="qhub" className="mt-0 space-y-3">
            <QuestionnaireHub />
          </TabsContent>

          <TabsContent value="outcome" className="mt-0 space-y-3">
            <div className="mb-1">
              <h2 className="text-sm font-semibold">Needs Outcome</h2>
              <p className="text-xs text-muted-foreground">Past intros from the last 45 days with no result logged</p>
            </div>
            <UpcomingIntrosCard userName={user?.name || ''} fixedTimeRange="needsOutcome" />
          </TabsContent>
        </div>
      </Tabs>

      {/* ═══ FLOATING END SHIFT BAR ═══ */}
      <div className="fixed bottom-[4.5rem] left-0 right-0 z-30 px-4 py-2 bg-background/95 backdrop-blur border-t border-primary/30 shadow-lg">
        <CloseOutShift
          completedIntros={completedTodayCount}
          activeIntros={todayBookingsCount - completedTodayCount}
          scriptsSent={todayScriptsSent}
          followUpsSent={todayFollowUpsSent}
          purchaseCount={purchaseTodayCount}
          noShowCount={noShowTodayCount}
          didntBuyCount={didntBuyTodayCount}
          topObjection={topObjectionToday}
          asButton
        />
      </div>

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
          onOpenChange={(open) => { if (!open) setPrepBookingId(null); }}
          memberName={prepBooking.member_name}
          memberKey={prepBooking.member_name}
          bookingId={prepBooking.id}
          classDate={prepBooking.class_date}
          classTime={prepBooking.intro_time}
          coachName={prepBooking.coach_name}
          leadSource={prepBooking.lead_source}
          isSecondIntro={!!prepBooking.originating_booking_id}
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
          onLogged={() => { setScriptBookingId(null); fetchMetrics(); }}
        />
      )}


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
