import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, parseISO } from 'date-fns';
import { 
  ClipboardList, Calendar, AlertTriangle, UserPlus, 
  ChevronRight, Clock, FileText
} from 'lucide-react';
import { IntroTypeBadge, LeadSourceTag } from '@/components/dashboard/IntroTypeBadge';
import { ClientActionMenu } from '@/components/dashboard/ClientActionMenu';
import { useIntroTypeDetection } from '@/hooks/useIntroTypeDetection';

interface TodayBooking {
  id: string;
  member_name: string;
  intro_time: string | null;
  coach_name: string;
  lead_source: string;
  questionnaire_status: string | null;
  originating_booking_id: string | null;
  class_date: string;
  created_at: string;
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
  const [todayBookings, setTodayBookings] = useState<TodayBooking[]>([]);
  const [allBookings, setAllBookings] = useState<AllBookingMinimal[]>([]);
  const [overdueFollowUps, setOverdueFollowUps] = useState<OverdueFollowUp[]>([]);
  const [newLeads, setNewLeads] = useState<{ id: string; first_name: string; last_name: string; source: string; created_at: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Intro type detection
  const { isSecondIntro, getFirstBookingId } = useIntroTypeDetection(allBookings);

  useEffect(() => {
    fetchMyDayData();
  }, [user?.name, introsBooked]);

  const fetchMyDayData = async () => {
    if (!user?.name) return;
    setIsLoading(true);

    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // 1. Today's booked intros
      const { data: bookings } = await supabase
        .from('intros_booked')
        .select('id, member_name, intro_time, coach_name, lead_source, originating_booking_id, class_date, created_at')
        .eq('class_date', today)
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
        // Get questionnaire statuses
        const bookingIds = bookings.map(b => b.id);
        const { data: questionnaires } = await supabase
          .from('intro_questionnaires')
          .select('booking_id, status')
          .in('booking_id', bookingIds.length > 0 ? bookingIds : ['none']);

        const qMap = new Map(questionnaires?.map(q => [q.booking_id, q.status]) || []);
        
        setTodayBookings(bookings.map(b => ({
          ...b,
          questionnaire_status: qMap.get(b.id) || null,
        })));
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
        .select('id, first_name, last_name, source, created_at')
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

  const getQBadge = (status: string | null, is2nd: boolean) => {
    // Hide questionnaire badges for 2nd intros
    if (is2nd) return null;
    if (!status) return <Badge variant="outline" className="text-muted-foreground text-[10px]">No Q</Badge>;
    if (status === 'submitted') return <Badge className="bg-success text-success-foreground text-[10px]">Q Done</Badge>;
    if (status === 'sent') return <Badge className="bg-warning text-warning-foreground text-[10px]">Q Sent</Badge>;
    return <Badge variant="outline" className="text-muted-foreground text-[10px]">Not Sent</Badge>;
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
            todayBookings.map(b => {
              const is2nd = isSecondIntro(b.id);
              const firstId = is2nd ? getFirstBookingId(b.member_name) : null;
              return (
                <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <ClientActionMenu
                        memberName={b.member_name}
                        memberKey={b.member_name.toLowerCase().replace(/\s+/g, '')}
                        bookingId={b.id}
                        classDate={b.class_date}
                        classTime={b.intro_time}
                        coachName={b.coach_name}
                        leadSource={b.lead_source}
                        firstBookingId={firstId}
                      >
                        <button className="font-medium text-sm text-primary hover:underline cursor-pointer text-left">
                          {b.member_name}
                        </button>
                      </ClientActionMenu>
                      <IntroTypeBadge isSecondIntro={is2nd} />
                      <LeadSourceTag source={b.lead_source} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {b.intro_time ? format(parseISO(`2000-01-01T${b.intro_time}`), 'h:mm a') : 'Time TBD'} · {b.coach_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getQBadge(b.questionnaire_status, is2nd)}
                  </div>
                </div>
              );
            })
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
              <div key={lead.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-sm">{lead.first_name} {lead.last_name}</p>
                  <p className="text-xs text-muted-foreground">{lead.source}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {isToday(new Date(lead.created_at)) ? 'Today' : format(new Date(lead.created_at), 'MMM d')}
                </Badge>
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
    </div>
  );
}
