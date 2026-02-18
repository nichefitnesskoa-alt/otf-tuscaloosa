/**
 * My Day Page – Simple, card-based workflow.
 *
 * Sections (visible cards, no nudges):
 * 1. Unresolved Intros
 * 2. Today's Intros (Upcoming Intros queue for today)
 * 3. New Leads
 * 4. Tomorrow & Coming Up (Upcoming Intros queue for future)
 * 5. Follow-Ups Due
 * 6. Questionnaire Hub
 *
 * Every intro card shows: Prep | Script | Coach (3-button muscle memory)
 *
 * ── Regression Checklist ──
 * - No duplicate intro lists rendered.
 * - Filters change the same list, not swap.
 * - No writes bypass Pipeline canonical outcome logic.
 * - Prep/Script/Coach always visible on every card.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format, differenceInMinutes, isToday } from 'date-fns';
import { formatDisplayTime } from '@/lib/time/timeUtils';
import { FileText, UserPlus, Clock, ClipboardList } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Existing dashboard components
import { OnboardingOverlay } from '@/components/dashboard/OnboardingOverlay';
import { OfflineBanner } from '@/components/dashboard/OfflineBanner';
import { StickyDayScore } from '@/components/dashboard/StickyDayScore';
import { FollowUpsDueToday } from '@/components/dashboard/FollowUpsDueToday';
import { QuestionnaireHub } from '@/components/dashboard/QuestionnaireHub';
import { ShiftHandoffSummary } from '@/components/dashboard/ShiftHandoffSummary';
import { CloseOutShift } from '@/components/dashboard/CloseOutShift';
import { QuickAddFAB } from '@/components/dashboard/QuickAddFAB';
import { SectionReorderButton, getSectionOrder } from '@/components/dashboard/SectionReorder';
import { CollapsibleSection } from '@/components/dashboard/CollapsibleSection';
import { SectionHelp } from '@/components/dashboard/SectionHelp';
import { LeadActionBar } from '@/components/ActionBar';
import { LeadSourceTag } from '@/components/dashboard/IntroTypeBadge';
import { CardGuidance, getLeadGuidance } from '@/components/dashboard/CardGuidance';
import { BookIntroDialog } from '@/components/leads/BookIntroDialog';
import { LeadDetailSheet } from '@/components/leads/LeadDetailSheet';
import { useRealtimeMyDay } from '@/hooks/useRealtimeMyDay';
import { Badge } from '@/components/ui/badge';
import { Phone as PhoneIcon, Calendar } from 'lucide-react';

// Prep, Script, Coach drawers
import { PrepDrawer } from '@/components/dashboard/PrepDrawer';
import { ScriptPickerSheet } from '@/components/scripts/ScriptPickerSheet';
import { CoachDrawer } from '@/components/myday/CoachDrawer';

// Collapsible optional tools
import { DailyProgress } from '@/components/dashboard/DailyProgress';
import { ExecutionCard } from '@/components/dashboard/ExecutionCard';
import { TouchLeaderboard } from '@/components/dashboard/TouchLeaderboard';
import { WinStreak } from '@/components/dashboard/WinStreak';
import { DailyInsight } from '@/components/dashboard/DailyInsight';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// Canonical intros queue
import UpcomingIntrosCard from './UpcomingIntrosCard';
import { MyDayShiftSummary } from './MyDayShiftSummary';

export default function MyDayPage() {
  const { user } = useAuth();
  const { introsBooked, introsRun, sales, refreshData } = useData();
  const navigate = useNavigate();

  // Leads state
  const [newLeads, setNewLeads] = useState<Tables<'leads'>[]>([]);
  const [alreadyBookedLeadIds, setAlreadyBookedLeadIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [followUpsDueCount, setFollowUpsDueCount] = useState(0);
  const [todayScriptsSent, setTodayScriptsSent] = useState(0);
  const [todayFollowUpsSent, setTodayFollowUpsSent] = useState(0);
  const [bookIntroLead, setBookIntroLead] = useState<Tables<'leads'> | null>(null);
  const [detailLead, setDetailLead] = useState<Tables<'leads'> | null>(null);
  const [sectionOrder, setSectionOrder] = useState<string[]>(getSectionOrder());
  const [optionalToolsOpen, setOptionalToolsOpen] = useState(false);

  // Prep/Script/Coach drawer state
  const [prepBookingId, setPrepBookingId] = useState<string | null>(null);
  const [scriptBookingId, setScriptBookingId] = useState<string | null>(null);
  const [coachBookingId, setCoachBookingId] = useState<string | null>(null);

  // Derived booking data for drawers
  const getBookingById = useCallback((id: string) =>
    introsBooked.find(b => b.id === id), [introsBooked]);

  const prepBooking = prepBookingId ? getBookingById(prepBookingId) : null;
  const scriptBooking = scriptBookingId ? getBookingById(scriptBookingId) : null;
  const coachBooking = coachBookingId ? getBookingById(coachBookingId) : null;

  // Today's stats
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayBookingsCount = useMemo(() =>
    introsBooked.filter(b => b.class_date === todayStr).length,
    [introsBooked, todayStr],
  );
  const todayRuns = useMemo(() =>
    introsRun.filter(r => r.run_date === todayStr),
    [introsRun, todayStr],
  );
  const completedTodayCount = todayRuns.length;
  const purchaseTodayCount = useMemo(() =>
    todayRuns.filter(r => r.result_canon === 'PURCHASED' || r.result?.toLowerCase().includes('membership') || r.result?.toLowerCase().includes('bought')).length,
    [todayRuns],
  );
  const noShowTodayCount = useMemo(() =>
    todayRuns.filter(r => r.result_canon === 'NO_SHOW' || r.result === 'No-show').length,
    [todayRuns],
  );
  const didntBuyTodayCount = useMemo(() =>
    todayRuns.filter(r => r.result_canon === 'DIDNT_BUY' || r.result === "Didn't Buy").length,
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
    const timer = setTimeout(() => fetchNonIntroData(), 1500);
    return () => clearTimeout(timer);
  }, []);
  useRealtimeMyDay(handleRealtimeUpdate);

  // Listen for Prep/Script/Coach events from IntroRowCard
  useEffect(() => {
    const onPrep = (e: Event) => setPrepBookingId((e as CustomEvent).detail.bookingId);
    const onScript = (e: Event) => setScriptBookingId((e as CustomEvent).detail.bookingId);
    const onCoach = (e: Event) => setCoachBookingId((e as CustomEvent).detail.bookingId);
    window.addEventListener('myday:open-prep', onPrep);
    window.addEventListener('myday:open-script', onScript);
    window.addEventListener('myday:open-coach', onCoach);
    return () => {
      window.removeEventListener('myday:open-prep', onPrep);
      window.removeEventListener('myday:open-script', onScript);
      window.removeEventListener('myday:open-coach', onCoach);
    };
  }, []);

  useEffect(() => {
    fetchNonIntroData();
  }, [user?.name]);

  const fetchNonIntroData = async () => {
    if (!user?.name) return;
    setIsLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayStart = today + 'T00:00:00';

      // Leads
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
          const bookedByFullName = new Map<string, string>();
          const bookedByPhone = new Map<string, string>();
          matchingBookings.forEach(b => {
            const name = b.member_name.toLowerCase().trim();
            if (!bookedByFullName.has(name)) bookedByFullName.set(name, b.id);
            const phone = (b.phone || '').replace(/\D/g, '');
            if (phone.length >= 7 && !bookedByPhone.has(phone)) bookedByPhone.set(phone, b.id);
          });

          const autoRemoveIds: string[] = [];
          const ambiguousIds = new Set<string>();
          const remaining: Tables<'leads'>[] = [];

          for (const lead of leads) {
            const fullName = `${lead.first_name} ${lead.last_name}`.toLowerCase().trim();
            const cleanPhone = lead.phone?.replace(/\D/g, '') || '';
            if (bookedByFullName.has(fullName) || (cleanPhone.length >= 7 && bookedByPhone.has(cleanPhone))) {
              autoRemoveIds.push(lead.id);
            } else {
              const firstNameLower = lead.first_name.toLowerCase().trim();
              const partialMatch = matchingBookings.some(b =>
                b.member_name.split(' ')[0]?.toLowerCase().trim() === firstNameLower &&
                b.member_name.toLowerCase().trim() !== fullName,
              );
              if (partialMatch) ambiguousIds.add(lead.id);
              remaining.push(lead);
            }
          }

          if (autoRemoveIds.length > 0) {
            await supabase.from('leads').update({ stage: 'booked' }).in('id', autoRemoveIds);
          }

          setNewLeads(remaining.filter(l => l.stage === 'new'));
          setAlreadyBookedLeadIds(ambiguousIds);
        } else {
          setNewLeads(leads.filter(l => l.stage === 'new'));
        }
      } else {
        setNewLeads([]);
      }

      // Script actions count
      const { data: actionsData } = await supabase
        .from('script_actions')
        .select('action_type, completed_by')
        .gte('completed_at', todayStart)
        .eq('completed_by', user.name);

      setTodayScriptsSent((actionsData || []).filter(a => a.action_type === 'script_sent').length);

      // Follow-ups sent today
      const { count: fuSentCount } = await supabase
        .from('follow_up_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'sent')
        .gte('sent_at', todayStart);
      setTodayFollowUpsSent(fuSentCount || 0);
    } catch (err) {
      console.error('MyDay non-intro fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

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

  const { completedActions, totalActions } = useMemo(() => {
    let total = todayBookingsCount + followUpsDueCount + newLeads.length;
    let completed = completedTodayCount + todayFollowUpsSent + Math.min(todayScriptsSent, newLeads.length);
    return { completedActions: completed, totalActions: total };
  }, [todayBookingsCount, completedTodayCount, followUpsDueCount, todayFollowUpsSent, newLeads, todayScriptsSent]);

  // Handlers for Prep/Script/Coach
  const handleOpenPrep = useCallback((bookingId: string) => {
    setPrepBookingId(bookingId);
  }, []);

  const handleOpenScript = useCallback((bookingId: string) => {
    setScriptBookingId(bookingId);
  }, []);

  const handleOpenCoach = useCallback((bookingId: string) => {
    setCoachBookingId(bookingId);
  }, []);

  const handleMarkContacted = async (leadId: string) => {
    try {
      await supabase.from('leads').update({ stage: 'contacted' }).eq('id', leadId);
      toast.success('Lead moved to In Progress');
      fetchNonIntroData();
    } catch { toast.error('Failed to update'); }
  };

  const handleMarkAlreadyBooked = async (leadId: string) => {
    try {
      await supabase.from('leads').update({ stage: 'booked' }).eq('id', leadId);
      toast.success('Lead moved to Booked');
      fetchNonIntroData();
    } catch { toast.error('Failed to update'); }
  };

  // Build script merge context for ScriptPickerSheet
  const scriptMergeContext = useMemo(() => {
    if (!scriptBooking) return {};
    const firstName = scriptBooking.member_name.split(' ')[0] || '';
    const lastName = scriptBooking.member_name.split(' ').slice(1).join(' ') || '';

    // Coach name resolution
    const rawCoach = scriptBooking.coach_name?.trim();
    const coachResolved = rawCoach && !/^tbd$/i.test(rawCoach) ? rawCoach : null;

    // Today/tomorrow resolution
    const classDate = scriptBooking.class_date;
    let todayTomorrow = '';
    if (classDate === todayStr) {
      todayTomorrow = 'today';
    } else {
      const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');
      if (classDate === tomorrow) {
        todayTomorrow = 'tomorrow';
      } else {
        try { todayTomorrow = format(new Date(classDate + 'T12:00:00'), 'EEEE'); } catch { todayTomorrow = ''; }
      }
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
    };
  }, [scriptBooking, user?.name, todayStr]);

  return (
    <div className="px-4 md:px-4 pb-24 space-y-3 md:space-y-4 max-w-full overflow-x-hidden">
      <OnboardingOverlay />

      {/* Greeting */}
      <div className="mb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user?.name}! 👋</h1>
            <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d')}</p>
          </div>
          <SectionReorderButton onReorder={setSectionOrder} />
        </div>
      </div>

      {/* Monday Meeting */}
      {new Date().getDay() === 1 && !sessionStorage.getItem('meeting-card-dismissed') && (
        <Card className="border-2 border-primary bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-lg flex items-center gap-2">📋 Team Meeting Today</p>
              <p className="text-sm text-muted-foreground">View the agenda before the meeting</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => navigate('/meeting')}>View Agenda</Button>
              <Button variant="ghost" size="sm" onClick={() => { sessionStorage.setItem('meeting-card-dismissed', '1'); fetchNonIntroData(); }}>✕</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <DailyInsight />
      <OfflineBanner />
      <StickyDayScore completedActions={completedActions} totalActions={totalActions} />


      {/* Per-shift activity log — writes to shift_recaps, feeds Studio tab */}
      <MyDayShiftSummary />

      {/* ═══════════════ CORE SECTIONS ═══════════════ */}

      {/* Canonical Upcoming Intros Queue — Today | Rest of Week | Needs Outcome */}
      <UpcomingIntrosCard userName={user?.name || ''} />

      {/* Sections driven by sectionOrder */}
      {sectionOrder.map((sectionId) => {
        switch (sectionId) {
          case 'todays-intros':
          case 'tomorrows-intros':
            // Handled by UpcomingIntrosCard
            return null;

          case 'new-leads':
            if (sortedLeads.length === 0) return null;
            return (
              <CollapsibleSection
                key="new-leads"
                id="new-leads"
                title="New Leads"
                icon={<UserPlus className="w-4 h-4 text-info" />}
                accentColor="border-l-blue-400"
                headerBgClass="bg-blue-50 dark:bg-blue-950/30"
                count={sortedLeads.length}
                defaultOpen={sortedLeads.length > 0}
              >
                <SectionHelp text="New people who haven't been contacted yet." />
                {sortedLeads.map(lead => {
                  const minutesAgo = differenceInMinutes(new Date(), new Date(lead.created_at));
                  const speedColor = minutesAgo < 5 ? 'bg-emerald-500 text-white'
                    : minutesAgo < 30 ? 'bg-amber-500 text-white'
                    : 'bg-destructive text-destructive-foreground';
                  const isAlreadyBooked = alreadyBookedLeadIds.has(lead.id);

                  return (
                    <div key={lead.id} className="rounded-lg border bg-card transition-all">
                      <div className="p-3 md:p-2.5">
                        <p className="font-semibold text-sm">{lead.first_name} {lead.last_name}</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <LeadSourceTag source={lead.source} className="flex-shrink-0" />
                          <span className="text-xs text-muted-foreground">
                            {minutesAgo < 60 ? `${minutesAgo}m ago` : isToday(new Date(lead.created_at)) ? format(new Date(lead.created_at), 'h:mm a') : format(new Date(lead.created_at), 'MMM d')}
                          </span>
                          <Badge className={`text-[10px] px-1.5 py-0 h-4 ${speedColor}`}>
                            {minutesAgo < 5 ? 'Just now' : minutesAgo < 30 ? 'Act fast' : 'Overdue'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {lead.phone && (
                            <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0 h-4 rounded border text-muted-foreground font-normal hover:text-primary" onClick={e => e.stopPropagation()}>
                              <PhoneIcon className="w-2.5 h-2.5" />
                              {lead.phone}
                            </a>
                          )}
                        </div>
                        {isAlreadyBooked && (
                          <div className="mt-1">
                            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-500 text-white border-transparent">
                              Already Booked?
                            </Badge>
                          </div>
                        )}
                        <CardGuidance text={getLeadGuidance(minutesAgo)} className="mt-1.5" />
                      </div>
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

          case 'followups-due':
            return (
              <CollapsibleSection
                key="followups-due"
                id="followups-due"
                title="Follow-Ups Due"
                icon={<Clock className="w-4 h-4 text-warning" />}
                accentColor="border-l-yellow-500"
                headerBgClass="bg-yellow-50 dark:bg-yellow-950/30"
                count={followUpsDueCount}
                defaultOpen={false}
              >
                <FollowUpsDueToday onRefresh={fetchNonIntroData} onCountChange={setFollowUpsDueCount} />
              </CollapsibleSection>
            );

          case 'questionnaire-hub':
            return (
              <CollapsibleSection
                key="questionnaire-hub"
                id="questionnaire-hub"
                title="Questionnaire Hub"
                icon={<ClipboardList className="w-4 h-4 text-primary" />}
                accentColor="border-l-teal-400"
                headerBgClass="bg-teal-50 dark:bg-teal-950/30"
                defaultOpen={false}
              >
                <QuestionnaireHub />
              </CollapsibleSection>
            );

          case 'shift-handoff':
            return (
              <CollapsibleSection
                key="shift-handoff"
                id="shift-handoff"
                title="Shift Summary"
                icon={<FileText className="w-4 h-4 text-primary" />}
                accentColor="border-l-slate-400"
                headerBgClass="bg-slate-100 dark:bg-slate-900/30"
                defaultOpen={false}
              >
                <ShiftHandoffSummary
                  todayCompletedCount={completedTodayCount}
                  todayActiveCount={todayBookingsCount - completedTodayCount}
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

      {/* ═══════════════ OPTIONAL TOOLS (collapsed by default, no nudges) ═══════════════ */}
      <Collapsible open={optionalToolsOpen} onOpenChange={setOptionalToolsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
            {optionalToolsOpen ? '▾ Hide Optional Tools' : '▸ Optional Tools (Progress, Streaks, Leaderboard)'}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 mt-2">
          <DailyProgress
            completedIntros={completedTodayCount}
            totalIntros={todayBookingsCount}
            followUpsDue={followUpsDueCount}
          />
          <ExecutionCard />
          <TouchLeaderboard />
          <WinStreak userName={user?.name || ''} introsRun={introsRun} sales={sales} />
        </CollapsibleContent>
      </Collapsible>

      {/* Close Out Shift — now powered by real today metrics */}
      <CloseOutShift
        completedIntros={completedTodayCount}
        activeIntros={todayBookingsCount - completedTodayCount}
        scriptsSent={todayScriptsSent}
        followUpsSent={todayFollowUpsSent}
        purchaseCount={purchaseTodayCount}
        noShowCount={noShowTodayCount}
        didntBuyCount={didntBuyTodayCount}
        topObjection={topObjectionToday}
      />

      <QuickAddFAB
        onRefresh={fetchNonIntroData}
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

      {/* ═══════════════ DRAWERS / DIALOGS ═══════════════ */}

      {/* Prep Drawer */}
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

      {/* Script Picker */}
      {scriptBooking && (
        <ScriptPickerSheet
          open={!!scriptBookingId}
          onOpenChange={(open) => { if (!open) setScriptBookingId(null); }}
          suggestedCategories={['confirmation', 'questionnaire', 'follow_up']}
          mergeContext={scriptMergeContext}
          bookingId={scriptBooking.id}
          onLogged={() => { setScriptBookingId(null); fetchNonIntroData(); }}
        />
      )}

      {/* Coach Drawer */}
      {coachBooking && (
        <CoachDrawer
          open={!!coachBookingId}
          onOpenChange={(open) => { if (!open) setCoachBookingId(null); }}
          memberName={coachBooking.member_name}
          bookingId={coachBooking.id}
          classTime={coachBooking.intro_time}
          coachName={coachBooking.coach_name}
        />
      )}

      {/* Lead Dialogs */}
      {bookIntroLead && (
        <BookIntroDialog
          open={!!bookIntroLead}
          onOpenChange={open => { if (!open) setBookIntroLead(null); }}
          lead={bookIntroLead}
          onDone={() => { setBookIntroLead(null); fetchNonIntroData(); }}
        />
      )}
      <LeadDetailSheet
        lead={detailLead}
        activities={[]}
        open={!!detailLead}
        onOpenChange={open => { if (!open) setDetailLead(null); }}
        onRefresh={fetchNonIntroData}
      />
    </div>
  );
}
