import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  RefreshCw, 
  Loader2,
  Search,
  ChevronDown,
  ChevronRight,
  User,
  Calendar,
  DollarSign,
  Target,
  Clock,
  CalendarCheck,
  UserMinus,
  Users,
  CalendarPlus,
  Phone,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { capitalizeName } from '@/lib/utils';
import { isMembershipSale } from '@/lib/sales-detection';
import { Button } from '@/components/ui/button';

// Tab types
type JourneyTab = 'all' | 'upcoming' | 'today' | 'no_show' | 'missed_guest' | 'second_intro' | 'not_interested';

interface ClientBooking {
  id: string;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  coach_name: string;
  booked_by: string | null;
  lead_source: string;
  fitness_goal: string | null;
  booking_status: string | null;
  intro_owner: string | null;
  originating_booking_id: string | null;
}

interface ClientRun {
  id: string;
  member_name: string;
  run_date: string | null;
  class_time: string;
  result: string;
  intro_owner: string | null;
  ran_by: string | null;
  lead_source: string | null;
  notes: string | null;
  commission_amount: number | null;
  linked_intro_booked_id: string | null;
}

interface ClientJourney {
  memberKey: string;
  memberName: string;
  bookings: ClientBooking[];
  runs: ClientRun[];
  hasSale: boolean;
  totalCommission: number;
  latestIntroOwner: string | null;
  status: 'active' | 'purchased' | 'not_interested' | 'no_show' | 'unknown';
}

export function ClientJourneyReadOnly() {
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<JourneyTab>('all');
  const [journeys, setJourneys] = useState<ClientJourney[]>([]);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [bookingsRes, runsRes] = await Promise.all([
        supabase
          .from('intros_booked')
          .select('id, member_name, class_date, intro_time, coach_name, booked_by, lead_source, fitness_goal, booking_status, intro_owner, originating_booking_id')
          .order('class_date', { ascending: false }),
        supabase
          .from('intros_run')
          .select('id, member_name, run_date, class_time, result, intro_owner, ran_by, lead_source, notes, commission_amount, linked_intro_booked_id')
          .order('run_date', { ascending: false }),
      ]);

      if (bookingsRes.error) throw bookingsRes.error;
      if (runsRes.error) throw runsRes.error;

      const bookings = (bookingsRes.data || []) as ClientBooking[];
      const runs = (runsRes.data || []) as ClientRun[];

      // Group by member_key (lowercase, no spaces)
      const clientMap = new Map<string, { bookings: ClientBooking[]; runs: ClientRun[] }>();

      bookings.forEach(b => {
        const key = b.member_name.toLowerCase().replace(/\s+/g, '');
        if (!clientMap.has(key)) {
          clientMap.set(key, { bookings: [], runs: [] });
        }
        clientMap.get(key)!.bookings.push(b);
      });

      runs.forEach(r => {
        const key = r.member_name.toLowerCase().replace(/\s+/g, '');
        if (!clientMap.has(key)) {
          clientMap.set(key, { bookings: [], runs: [] });
        }
        clientMap.get(key)!.runs.push(r);
      });

      // Build journeys
      const clientJourneys: ClientJourney[] = [];

      clientMap.forEach((data, key) => {
        const memberName = data.bookings[0]?.member_name || data.runs[0]?.member_name || key;
        
        // Determine status
        let status: ClientJourney['status'] = 'unknown';
        const hasSale = data.runs.some(r => isMembershipSale(r.result));
        const hasNotInterested = data.bookings.some(b => b.booking_status === 'Not interested');
        const hasClosed = data.bookings.some(b => b.booking_status === 'Closed (Purchased)');
        const hasActive = data.bookings.some(b => b.booking_status === 'Active' || !b.booking_status);
        const hasNoShow = data.runs.some(r => r.result === 'No-show');

        if (hasSale || hasClosed) {
          status = 'purchased';
        } else if (hasNotInterested) {
          status = 'not_interested';
        } else if (hasNoShow && !hasActive) {
          status = 'no_show';
        } else if (hasActive) {
          status = 'active';
        }

        const latestRun = data.runs.find(r => r.result !== 'No-show');
        const latestIntroOwner = latestRun?.intro_owner || latestRun?.ran_by || data.bookings[0]?.intro_owner || null;
        const totalCommission = data.runs.reduce((sum, r) => sum + (r.commission_amount || 0), 0);

        clientJourneys.push({
          memberKey: key,
          memberName: capitalizeName(memberName) || memberName,
          bookings: data.bookings,
          runs: data.runs,
          hasSale,
          totalCommission,
          latestIntroOwner: capitalizeName(latestIntroOwner),
          status,
        });
      });

      // Sort by recent activity
      clientJourneys.sort((a, b) => {
        const aDate = a.runs[0]?.run_date || a.bookings[0]?.class_date || '';
        const bDate = b.runs[0]?.run_date || b.bookings[0]?.class_date || '';
        return bDate.localeCompare(aDate);
      });

      setJourneys(clientJourneys);
    } catch (error) {
      console.error('Error fetching client data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper to check if a booking's scheduled time has passed
  const isBookingPast = (booking: ClientBooking): boolean => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    if (booking.class_date < today) return true;
    if (booking.class_date > today) return false;
    
    if (!booking.intro_time) return false;
    
    const currentTime = now.toTimeString().slice(0, 5);
    return booking.intro_time <= currentTime;
  };

  const isBookingToday = (booking: ClientBooking): boolean => {
    const today = new Date().toISOString().split('T')[0];
    return booking.class_date === today;
  };

  const isBookingUpcoming = (booking: ClientBooking): boolean => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    if (booking.class_date > today) return true;
    if (booking.class_date < today) return false;
    
    if (!booking.intro_time) return true;
    
    const currentTime = now.toTimeString().slice(0, 5);
    return booking.intro_time > currentTime;
  };

  const hasPurchasedMembership = (journey: ClientJourney): boolean => {
    const hasSaleResult = journey.runs.some(r => isMembershipSale(r.result));
    const hasClosedBooking = journey.bookings.some(b => b.booking_status === 'Closed (Purchased)');
    return hasSaleResult || hasClosedBooking;
  };

  // Calculate tab counts - exclude purchased members from all counts
  const tabCounts = useMemo(() => {
    const counts = {
      all: 0,
      upcoming: 0,
      today: 0,
      no_show: 0,
      missed_guest: 0,
      second_intro: 0,
      not_interested: 0,
    };

    journeys.forEach(journey => {
      const hasPurchased = hasPurchasedMembership(journey);
      
      // Exclude purchased members from pipeline entirely
      if (hasPurchased) return;
      
      counts.all++;

      const latestActiveBooking = journey.bookings.find(b => 
        !b.booking_status || b.booking_status === 'Active'
      );

      if (latestActiveBooking && isBookingUpcoming(latestActiveBooking)) {
        counts.upcoming++;
      }

      if (latestActiveBooking && isBookingToday(latestActiveBooking)) {
        counts.today++;
      }

      // No-show detection
      const hasActiveBooking = journey.bookings.some(b => 
        (!b.booking_status || b.booking_status === 'Active') && isBookingPast(b)
      );
      const hasValidRun = journey.runs.some(r => r.result !== 'No-show');
      
      if (hasActiveBooking && !hasValidRun && journey.runs.every(r => !r || r.result === 'No-show')) {
        counts.no_show++;
      }

      // Missed guest
      const hasMissedResult = journey.runs.some(r => 
        r.result === 'Follow-up needed' || r.result === 'Booked 2nd intro'
      );
      if (hasMissedResult) {
        counts.missed_guest++;
      }

      // 2nd intro
      const has2ndIntro = journey.bookings.some(b => b.originating_booking_id) ||
        journey.runs.some(r => r.result === 'Booked 2nd intro') ||
        (journey.bookings.length > 1 && journey.bookings.some(b => 
          (!b.booking_status || b.booking_status === 'Active') && isBookingUpcoming(b)
        ) && journey.runs.length > 0);
      
      if (has2ndIntro) {
        counts.second_intro++;
      }

      // Not interested
      const hasNotInterested = journey.bookings.some(b => b.booking_status === 'Not interested') ||
        journey.runs.some(r => r.result === 'Not interested');
      if (hasNotInterested) {
        counts.not_interested++;
      }
    });

    return counts;
  }, [journeys]);

  // Filter by tab - always exclude purchased members
  const filterJourneysByTab = (journeyList: ClientJourney[], tab: JourneyTab): ClientJourney[] => {
    // First, exclude all purchased members from the pipeline
    const nonPurchased = journeyList.filter(j => !hasPurchasedMembership(j));
    
    if (tab === 'all') return nonPurchased;

    return nonPurchased.filter(journey => {
      const latestActiveBooking = journey.bookings.find(b => 
        !b.booking_status || b.booking_status === 'Active'
      );

      switch (tab) {
        case 'upcoming':
          return latestActiveBooking && isBookingUpcoming(latestActiveBooking);

        case 'today':
          return latestActiveBooking && isBookingToday(latestActiveBooking);

        case 'no_show': {
          const hasActiveBooking = journey.bookings.some(b => 
            (!b.booking_status || b.booking_status === 'Active') && isBookingPast(b)
          );
          const hasValidRun = journey.runs.some(r => r.result !== 'No-show');
          return hasActiveBooking && !hasValidRun && journey.runs.every(r => !r || r.result === 'No-show');
        }

        case 'missed_guest':
          return journey.runs.some(r => 
            r.result === 'Follow-up needed' || r.result === 'Booked 2nd intro'
          );

        case 'second_intro':
          return journey.bookings.some(b => b.originating_booking_id) ||
            journey.runs.some(r => r.result === 'Booked 2nd intro') ||
            (journey.bookings.length > 1 && journey.bookings.some(b => 
              (!b.booking_status || b.booking_status === 'Active') && isBookingUpcoming(b)
            ) && journey.runs.length > 0);

        case 'not_interested':
          return journey.bookings.some(b => b.booking_status === 'Not interested') ||
            journey.runs.some(r => r.result === 'Not interested');

        default:
          return true;
      }
    });
  };

  const filteredJourneys = useMemo(() => {
    let filtered = journeys;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(j => 
        j.memberName.toLowerCase().includes(term) ||
        j.latestIntroOwner?.toLowerCase().includes(term)
      );
    }

    filtered = filterJourneysByTab(filtered, activeTab);

    return filtered;
  }, [journeys, searchTerm, activeTab]);

  const toggleExpand = (key: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const getStatusBadge = (status: ClientJourney['status']) => {
    switch (status) {
      case 'purchased':
        return <Badge className="bg-success text-success-foreground">Purchased</Badge>;
      case 'not_interested':
        return <Badge variant="secondary">Not Interested</Badge>;
      case 'no_show':
        return <Badge variant="destructive">No-show</Badge>;
      case 'active':
        return <Badge variant="outline">Active</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '';
    return timeStr.substring(0, 5);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Client Pipeline
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchData} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          View clients to contact and follow up with
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as JourneyTab)}>
          <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="all" className="flex-1 min-w-[60px] gap-1 text-xs">
              <Users className="w-3 h-3" />
              All ({tabCounts.all})
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="flex-1 min-w-[60px] gap-1 text-xs">
              <CalendarPlus className="w-3 h-3" />
              Upcoming ({tabCounts.upcoming})
            </TabsTrigger>
            <TabsTrigger value="today" className="flex-1 min-w-[60px] gap-1 text-xs">
              <CalendarCheck className="w-3 h-3" />
              Today ({tabCounts.today})
            </TabsTrigger>
            <TabsTrigger value="no_show" className="flex-1 min-w-[60px] gap-1 text-xs">
              <UserMinus className="w-3 h-3" />
              No-shows ({tabCounts.no_show})
            </TabsTrigger>
            <TabsTrigger value="missed_guest" className="flex-1 min-w-[60px] gap-1 text-xs">
              <Phone className="w-3 h-3" />
              Missed ({tabCounts.missed_guest})
            </TabsTrigger>
            <TabsTrigger value="second_intro" className="flex-1 min-w-[60px] gap-1 text-xs">
              <Target className="w-3 h-3" />
              2nd Intro ({tabCounts.second_intro})
            </TabsTrigger>
            <TabsTrigger value="not_interested" className="flex-1 min-w-[60px] gap-1 text-xs">
              <UserMinus className="w-3 h-3" />
              Not Interested ({tabCounts.not_interested})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Client List */}
        <ScrollArea className="h-[400px]">
          {filteredJourneys.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No clients found
            </p>
          ) : (
            <div className="space-y-2">
              {filteredJourneys.map(journey => (
                <Collapsible
                  key={journey.memberKey}
                  open={expandedClients.has(journey.memberKey)}
                  onOpenChange={() => toggleExpand(journey.memberKey)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
                      <div className="flex items-center gap-3">
                        {expandedClients.has(journey.memberKey) ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        <div className="text-left">
                          <p className="font-medium">{journey.memberName}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                            {journey.latestIntroOwner && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {journey.latestIntroOwner}
                              </span>
                            )}
                            {journey.bookings[0]?.coach_name && journey.bookings[0].coach_name !== 'TBD' && (
                              <span className="flex items-center gap-1">
                                🏋️ {journey.bookings[0].coach_name}
                              </span>
                            )}
                            {journey.bookings[0] && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(journey.bookings[0].class_date)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {journey.totalCommission > 0 && (
                          <Badge variant="outline" className="text-success">
                            <DollarSign className="w-3 h-3 mr-0.5" />
                            {journey.totalCommission.toFixed(0)}
                          </Badge>
                        )}
                        {getStatusBadge(journey.status)}
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="mt-2 ml-7 space-y-3 p-3 border rounded-lg bg-background">
                      {/* Bookings */}
                      {journey.bookings.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Bookings ({journey.bookings.length})
                          </p>
                          <div className="space-y-2">
                            {journey.bookings.map(booking => (
                              <div key={booking.id} className="text-sm p-2 bg-muted/30 rounded">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">
                                    {formatDate(booking.class_date)}
                                    {booking.intro_time && ` @ ${formatTime(booking.intro_time)}`}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {booking.booking_status || 'Active'}
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                                  {booking.booked_by && (
                                    <span>Booked by: {capitalizeName(booking.booked_by)}</span>
                                  )}
                                  {booking.coach_name && (
                                    <span>Coach: {booking.coach_name}</span>
                                  )}
                                  {booking.lead_source && (
                                    <span>Source: {booking.lead_source}</span>
                                  )}
                                </div>
                                {booking.fitness_goal && (
                                  <div className="mt-1 text-xs">
                                    <span className="font-medium">Goal: </span>
                                    {booking.fitness_goal}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Runs */}
                      {journey.runs.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            Intro Runs ({journey.runs.length})
                          </p>
                          <div className="space-y-2">
                            {journey.runs.map(run => (
                              <div key={run.id} className="text-sm p-2 bg-muted/30 rounded">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">
                                    {run.run_date ? formatDate(run.run_date) : 'No date'}
                                    {run.class_time && ` @ ${formatTime(run.class_time)}`}
                                  </span>
                                  <Badge 
                                    variant={isMembershipSale(run.result) ? 'default' : 'outline'}
                                    className={isMembershipSale(run.result) ? 'bg-success text-success-foreground' : ''}
                                  >
                                    {run.result}
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                                  {run.ran_by && (
                                    <span>Ran by: {capitalizeName(run.ran_by)}</span>
                                  )}
                                  {run.intro_owner && run.intro_owner !== run.ran_by && (
                                    <span>Owner: {capitalizeName(run.intro_owner)}</span>
                                  )}
                                  {run.commission_amount && run.commission_amount > 0 && (
                                    <span className="text-success font-medium">
                                      ${run.commission_amount.toFixed(2)} commission
                                    </span>
                                  )}
                                </div>
                                {run.notes && (
                                  <div className="mt-1 text-xs text-muted-foreground italic">
                                    {run.notes}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {journey.bookings.length === 0 && journey.runs.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          No booking or run records
                        </p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
