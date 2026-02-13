import { useState, useEffect } from 'react';
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
  Clock, FileText, CalendarCheck, Star, ChevronDown, ChevronRight, CalendarPlus
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

interface OverdueFollowUp {
  personName: string;
  nextAction: string;
  daysOverdue: number;
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

export default function MyDay() {
  const { user } = useAuth();
  const { introsBooked } = useData();
  const navigate = useNavigate();
  const [todayBookings, setTodayBookings] = useState<DayBooking[]>([]);
  const [tomorrowBookings, setTomorrowBookings] = useState<DayBooking[]>([]);
  const [allBookings, setAllBookings] = useState<AllBookingMinimal[]>([]);
  const [overdueFollowUps, setOverdueFollowUps] = useState<OverdueFollowUp[]>([]);
  const [newLeads, setNewLeads] = useState<Tables<'leads'>[]>([]);
  const [alreadyBookedLeadIds, setAlreadyBookedLeadIds] = useState<Set<string>>(new Set());
  const [vipGroups, setVipGroups] = useState<VipGroup[]>([]);
  const [expandedVipGroups, setExpandedVipGroups] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [reminderSentMap, setReminderSentMap] = useState<Set<string>>(new Set());

  // Lead actions state
  const [bookIntroLead, setBookIntroLead] = useState<Tables<'leads'> | null>(null);
  const [detailLead, setDetailLead] = useState<Tables<'leads'> | null>(null);

  const { isSecondIntro, getFirstBookingId } = useIntroTypeDetection(allBookings);

  useEffect(() => {
    fetchMyDayData();
  }, [user?.name, introsBooked]);

  const fetchMyDayData = async () => {
    if (!user?.name) return;
    setIsLoading(true);

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      // 1. Today's and tomorrow's booked intros (non-VIP)
      const { data: bookings } = await supabase
        .from('intros_booked')
        .select('id, member_name, intro_time, coach_name, lead_source, originating_booking_id, class_date, created_at, phone, email')
        .in('class_date', [today, tomorrow])
        .is('deleted_at', null)
        .is('vip_class_name', null)
        .neq('booking_status', 'Closed – Bought')
        .order('intro_time', { ascending: true });

      // 1b. Today's VIP intros (grouped by session)
      const { data: vipBookings } = await supabase
        .from('intros_booked')
        .select('id, member_name, intro_time, coach_name, lead_source, originating_booking_id, class_date, created_at, phone, email, vip_class_name, vip_session_id')
        .in('class_date', [today])
        .is('deleted_at', null)
        .not('vip_class_name', 'is', null)
        .neq('booking_status', 'Closed – Bought')
        .neq('booking_status', 'Unscheduled')
        .order('intro_time', { ascending: true });

      // Process VIP bookings into groups
      if (vipBookings && vipBookings.length > 0) {
        // Fetch session info for these bookings
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

        // Group by vip_class_name + vip_session_id
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
            ...b,
            questionnaire_status: null,
            phone: b.phone || null,
            email: b.email || null,
          });
        });
        setVipGroups(Array.from(groupMap.values()));
      } else {
        setVipGroups([]);
      }

      // Fetch all bookings for intro type detection
      const { data: allBookingsData } = await supabase
        .from('intros_booked')
        .select('id, member_name, originating_booking_id, class_date, created_at, is_vip')
        .is('deleted_at', null);

      if (allBookingsData) setAllBookings(allBookingsData as AllBookingMinimal[]);

      if (bookings) {
        const bookingIds = bookings.map(b => b.id);
        const [qRes, runRes] = await Promise.all([
          supabase
            .from('intro_questionnaires')
            .select('booking_id, status, slug')
            .in('booking_id', bookingIds.length > 0 ? bookingIds : ['none']),
          supabase
            .from('intros_run')
            .select('linked_intro_booked_id, result, primary_objection')
            .in('linked_intro_booked_id', bookingIds.length > 0 ? bookingIds : ['none'])
            .limit(200),
        ]);

        const questionnaires = qRes.data;
        const runsData = runRes.data;

        const qMap = new Map(questionnaires?.map(q => [q.booking_id, { status: q.status, slug: (q as any).slug }]) || []);
        const runMap = new Map((runsData || []).map((r: any) => [r.linked_intro_booked_id, { result: r.result, primary_objection: r.primary_objection }]));
        
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

        // Check reminder sent status for tomorrow's bookings
        const tomorrowIds = enriched.filter(b => b.class_date === tomorrow).map(b => b.id);
        if (tomorrowIds.length > 0) {
          const { data: sendLogs } = await supabase
            .from('script_send_log')
            .select('booking_id')
            .in('booking_id', tomorrowIds);
          
          const sentSet = new Set((sendLogs || []).map(l => l.booking_id).filter(Boolean) as string[]);
          setReminderSentMap(sentSet);
        }
      }

      // 2. Overdue follow-ups
      const { data: sendLogs } = await supabase
        .from('script_send_log')
        .select('*, booking:intros_booked(member_name), lead:leads(first_name, last_name)')
        .eq('sent_by', user.name)
        .order('sent_at', { ascending: false })
        .limit(50);

      if (sendLogs) {
        const grouped = new Map<string, typeof sendLogs[0]>();
        for (const log of sendLogs) {
          const key = log.booking_id || log.lead_id || log.id;
          if (!grouped.has(key)) grouped.set(key, log);
        }

        const overdue: OverdueFollowUp[] = [];
        for (const [, log] of grouped) {
          const daysSince = Math.floor((Date.now() - new Date(log.sent_at).getTime()) / (1000 * 60 * 60 * 24));
          if (daysSince >= 2) {
            const name = (log as any).booking?.member_name || 
              ((log as any).lead ? `${(log as any).lead.first_name} ${(log as any).lead.last_name}` : 'Unknown');
            overdue.push({
              personName: name,
              nextAction: 'Follow-up needed',
              daysOverdue: daysSince,
            });
          }
        }
        setOverdueFollowUps(overdue.slice(0, 5));
      }

      // 3. New uncontacted leads
      const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .eq('stage', 'new')
        .order('created_at', { ascending: false })
        .limit(5);

      if (leads) {
        setNewLeads(leads);

        // Check for already-booked leads (name or phone match in intros_booked)
        if (leads.length > 0) {
          const names = leads.map(l => `${l.first_name} ${l.last_name}`.toLowerCase());
          const phones = leads.map(l => l.phone).filter(Boolean);
          
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
      // Auto-progress to "contacted" stage (which represents "In Progress")
      await supabase.from('leads').update({ stage: 'contacted' }).eq('id', leadId);
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        activity_type: 'stage_change',
        performed_by: user?.name || 'Unknown',
        notes: 'Marked as contacted from My Day',
      });
      toast.success('Lead moved to In Progress');
      fetchMyDayData();
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleMarkAlreadyBooked = async (leadId: string) => {
    try {
      await supabase.from('leads').update({ stage: 'booked' }).eq('id', leadId);
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        activity_type: 'stage_change',
        performed_by: user?.name || 'Unknown',
        notes: 'Manually marked as Already Booked from My Day',
      });
      toast.success('Lead moved to Booked');
      fetchMyDayData();
    } catch {
      toast.error('Failed to update');
    }
  };

  const getQBadge = (status: string | null, is2nd: boolean) => {
    if (is2nd) return null;
    if (!status) return <Badge variant="outline" className="text-muted-foreground text-[10px]">No Q</Badge>;
    if (status === 'submitted' || status === 'completed') return <Badge className="bg-success text-success-foreground text-[10px]">Q Done</Badge>;
    if (status === 'sent') return <Badge className="bg-warning text-warning-foreground text-[10px]">Q Sent</Badge>;
    return <Badge variant="outline" className="text-muted-foreground text-[10px]">Not Sent</Badge>;
  };

  const renderIntroCard = (b: DayBooking, showReminderStatus = false, isVipCard = false) => {
    const is2nd = isVipCard ? false : isSecondIntro(b.id);
    const firstId = is2nd ? getFirstBookingId(b.member_name) : null;
    const reminderSent = reminderSentMap.has(b.id);

    return (
      <div key={b.id} className={cn(
        'rounded-lg border bg-card p-3 space-y-2',
        isVipCard && 'border-purple-200 bg-purple-50/30'
      )}>
        {/* Main row */}
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
            <p className="text-[10px] text-muted-foreground/70">
              {formatBookedTime(b.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!b.phone && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">No Phone</Badge>
            )}
            {b.phone && !b.email && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">No Email</Badge>
            )}
            {!isVipCard && getQBadge(b.questionnaire_status, is2nd)}
            {showReminderStatus && !reminderSent && (
              <Badge variant="outline" className="text-[10px] bg-warning/15 text-warning border-warning/30">
                Reminder Not Sent
              </Badge>
            )}
          </div>
        </div>

        {/* Inline action bar - VIP cards get "Book Real Intro" instead of script generate */}
        {isVipCard ? (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] flex-1 text-purple-700 border-purple-300 hover:bg-purple-50"
              onClick={() => {
                setBookIntroLead({
                  id: '',
                  first_name: b.member_name.split(' ')[0] || '',
                  last_name: b.member_name.split(' ').slice(1).join(' ') || '',
                  phone: b.phone || '',
                  email: b.email || '',
                  source: 'VIP Class',
                  stage: 'new',
                  created_at: b.created_at,
                  updated_at: b.created_at,
                  last_name_2: '',
                } as any);
              }}
            >
              <CalendarPlus className="w-3 h-3 mr-1" />
              Book Real Intro
            </Button>
          </div>
        ) : (
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
        )}
      </div>
    );
  };

  return (
    <div className="p-4 pb-8 space-y-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user?.name}! 👋</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d')}</p>
      </div>

      {/* Quick Start Button */}
      <Button 
        className="w-full gap-2" 
        size="lg"
        onClick={() => navigate('/shift-recap')}
      >
        <FileText className="w-5 h-5" />
        Start Shift Recap
      </Button>

      {/* Today's Intros */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Today's Intros ({todayBookings.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : todayBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No intros scheduled today</p>
          ) : (
            todayBookings.map(b => renderIntroCard(b))
          )}
        </CardContent>
      </Card>

      {/* Today's VIP Classes */}
      {vipGroups.length > 0 && vipGroups.map((group, gi) => {
        const groupKey = `${group.groupName}__${group.sessionLabel || gi}`;
        const isExpanded = expandedVipGroups.has(groupKey);
        const timeStr = group.sessionTime 
          ? format(parseISO(`2000-01-01T${group.sessionTime}`), 'h:mm a')
          : '';
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


      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-info" />
            Tomorrow's Intros ({tomorrowBookings.length})
          </CardTitle>
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

      {/* Overdue Follow-Ups */}
      {overdueFollowUps.length > 0 && (
        <Card className="border-warning/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Overdue Follow-Ups ({overdueFollowUps.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueFollowUps.map((fu, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-warning/10">
                <div>
                  <p className="font-medium text-sm">{fu.personName}</p>
                  <p className="text-xs text-muted-foreground">{fu.nextAction}</p>
                </div>
                <Badge variant="outline" className="text-destructive border-destructive text-[10px]">
                  <Clock className="w-3 h-3 mr-1" />
                  {fu.daysOverdue}d overdue
                </Badge>
              </div>
            ))}
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-primary"
              onClick={() => navigate('/leads')}
            >
              View all in Leads →
            </Button>
          </CardContent>
        </Card>
      )}

      {/* New Leads */}
      {newLeads.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-info" />
              New Leads ({newLeads.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {newLeads.map(lead => {
              const minutesAgo = differenceInMinutes(new Date(), new Date(lead.created_at));
              const speedColor = minutesAgo < 5 ? 'bg-success text-success-foreground' 
                : minutesAgo < 30 ? 'bg-warning text-warning-foreground' 
                : 'bg-destructive text-destructive-foreground';
              const isAlreadyBooked = alreadyBookedLeadIds.has(lead.id);

              const handleDismissBooked = async () => {
                try {
                  await supabase.from('leads').update({ stage: 'booked' }).eq('id', lead.id);
                  await supabase.from('lead_activities').insert({
                    lead_id: lead.id,
                    activity_type: 'stage_change',
                    performed_by: user?.name || 'Unknown',
                    notes: 'Auto-dismissed: already booked',
                  });
                  toast.success('Lead moved to Booked');
                  fetchMyDayData();
                } catch {
                  toast.error('Failed to update');
                }
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
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Badge className={`text-[10px] px-1.5 py-0 h-4 ${speedColor}`}>
                        {minutesAgo < 60 ? `${minutesAgo}m` : isToday(new Date(lead.created_at)) ? format(new Date(lead.created_at), 'h:mm a') : format(new Date(lead.created_at), 'MMM d')}
                      </Badge>
                    </div>
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
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-primary"
              onClick={() => navigate('/leads')}
            >
              View all leads →
            </Button>
          </CardContent>
        </Card>
      )}

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
