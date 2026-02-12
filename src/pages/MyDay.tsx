import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, parseISO, addDays } from 'date-fns';
import { 
  Calendar, AlertTriangle, UserPlus, 
  Clock, FileText, CalendarCheck
} from 'lucide-react';
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
  originating_booking_id: string | null;
  class_date: string;
  created_at: string;
  phone: string | null;
  email: string | null;
}

interface AllBookingMinimal {
  id: string;
  member_name: string;
  originating_booking_id: string | null;
  class_date: string;
  created_at: string;
}

interface OverdueFollowUp {
  personName: string;
  nextAction: string;
  daysOverdue: number;
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

      // 1. Today's and tomorrow's booked intros
      const { data: bookings } = await supabase
        .from('intros_booked')
        .select('id, member_name, intro_time, coach_name, lead_source, originating_booking_id, class_date, created_at, phone, email')
        .in('class_date', [today, tomorrow])
        .is('deleted_at', null)
        .is('vip_class_name', null)
        .neq('booking_status', 'Closed – Bought')
        .order('intro_time', { ascending: true });

      // Fetch all bookings for intro type detection
      const { data: allBookingsData } = await supabase
        .from('intros_booked')
        .select('id, member_name, originating_booking_id, class_date, created_at')
        .is('deleted_at', null);

      if (allBookingsData) setAllBookings(allBookingsData as AllBookingMinimal[]);

      if (bookings) {
        const bookingIds = bookings.map(b => b.id);
        const { data: questionnaires } = await supabase
          .from('intro_questionnaires')
          .select('booking_id, status')
          .in('booking_id', bookingIds.length > 0 ? bookingIds : ['none']);

        const qMap = new Map(questionnaires?.map(q => [q.booking_id, q.status]) || []);
        
        const enriched = bookings.map(b => ({
          ...b,
          questionnaire_status: qMap.get(b.id) || null,
          phone: (b as any).phone || null,
          email: (b as any).email || null,
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

      if (leads) setNewLeads(leads);
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
        lead_id: leadId,
        activity_type: 'stage_change',
        performed_by: user?.name || 'Unknown',
        notes: 'Marked as contacted from My Day',
      });
      toast.success('Lead marked as contacted');
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

  const renderIntroCard = (b: DayBooking, showReminderStatus = false) => {
    const is2nd = isSecondIntro(b.id);
    const firstId = is2nd ? getFirstBookingId(b.member_name) : null;
    const reminderSent = reminderSentMap.has(b.id);

    return (
      <div key={b.id} className="rounded-lg border bg-card p-3 space-y-2">
        {/* Main row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-sm">{b.member_name}</span>
              <IntroTypeBadge isSecondIntro={is2nd} />
              <LeadSourceTag source={b.lead_source} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {b.intro_time ? format(parseISO(`2000-01-01T${b.intro_time}`), 'h:mm a') : 'Time TBD'} · {b.coach_name}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!b.phone && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">No Phone</Badge>
            )}
            {b.phone && !b.email && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">No Email</Badge>
            )}
            {getQBadge(b.questionnaire_status, is2nd)}
            {showReminderStatus && !reminderSent && (
              <Badge variant="outline" className="text-[10px] bg-warning/15 text-warning border-warning/30">
                Reminder Not Sent
              </Badge>
            )}
          </div>
        </div>

        {/* Inline action bar */}
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
        />
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

      {/* Tomorrow's Intros */}
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
            {newLeads.map(lead => (
              <div key={lead.id} className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm">{lead.first_name} {lead.last_name}</span>
                      <LeadSourceTag source={lead.source} />
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] flex-shrink-0">
                    {isToday(new Date(lead.created_at)) ? 'Today' : format(new Date(lead.created_at), 'MMM d')}
                  </Badge>
                </div>
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
                />
              </div>
            ))}
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
