import { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '@/context/DataContext';
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
  Filter,
  MessageSquare,
  Star,
  ClipboardList,
  Briefcase,
  UserCheck,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { capitalizeName, parseLocalDate, getLocalDateString } from '@/lib/utils';
import { isMembershipSale } from '@/lib/sales-detection';
import { Button } from '@/components/ui/button';
import { PipelineScriptPicker } from './PipelineScriptPicker';
import { ClientProfileSheet } from './ClientProfileSheet';
import { IntroPrepCard } from './IntroPrepCard';
import { IntroTypeBadge, LeadSourceTag } from './IntroTypeBadge';

type PipelineSort = 'recent' | 'oldest' | 'az' | 'za' | 'date_asc' | 'date_desc';

// Tab types
type JourneyTab = 'all' | 'upcoming' | 'today' | 'no_show' | 'missed_guest' | 'second_intro' | 'not_interested' | 'by_lead_source' | 'vip_class';

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
  paired_booking_id: string | null;
  vip_class_name: string | null;
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

interface VipInfo {
  birthday: string | null;
  weight_lbs: number | null;
}

export function ClientJourneyReadOnly() {
  const { lastUpdated: globalLastUpdated } = useData();
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<JourneyTab>('all');
  const [journeys, setJourneys] = useState<ClientJourney[]>([]);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [selectedLeadSource, setSelectedLeadSource] = useState<string | null>(null);
  const [scriptTargetKey, setScriptTargetKey] = useState<string | null>(null);
  const [vipInfoMap, setVipInfoMap] = useState<Map<string, VipInfo>>(new Map());
  const [questionnaireMap, setQuestionnaireMap] = useState<Map<string, string>>(new Map()); // booking_id -> status
  const [profileTarget, setProfileTarget] = useState<ClientJourney | null>(null);
  const [prepTarget, setPrepTarget] = useState<{ booking: ClientBooking; journey: ClientJourney } | null>(null);
  const [sortBy, setSortBy] = useState<PipelineSort>('recent');
  const hasMountedRef = useRef(false);

  const fetchVipInfo = async () => {
    const { data } = await supabase
      .from('vip_registrations')
      .select('booking_id, birthday, weight_lbs');
    if (data) {
      const map = new Map<string, VipInfo>();
      data.forEach((r: any) => {
        if (r.booking_id) map.set(r.booking_id, { birthday: r.birthday, weight_lbs: r.weight_lbs });
      });
      setVipInfoMap(map);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [bookingsRes, runsRes] = await Promise.all([
        supabase
          .from('intros_booked')
          .select('id, member_name, class_date, intro_time, coach_name, booked_by, lead_source, fitness_goal, booking_status, intro_owner, originating_booking_id, paired_booking_id, vip_class_name')
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

  const fetchQuestionnaireStatuses = async () => {
    const { data } = await supabase
      .from('intro_questionnaires')
      .select('booking_id, status');
    if (data) {
      const map = new Map<string, string>();
      (data as any[]).forEach(r => {
        if (r.booking_id) map.set(r.booking_id, r.status);
      });
      setQuestionnaireMap(map);
    }
  };

  useEffect(() => {
    fetchData();
    fetchVipInfo();
    fetchQuestionnaireStatuses();
    hasMountedRef.current = true;
  }, []);

  // Re-fetch when global data is refreshed (e.g., from Admin edits)
  useEffect(() => {
    if (hasMountedRef.current && globalLastUpdated) {
      fetchData();
    }
  }, [globalLastUpdated]);

  // Use shared getLocalDateString from utils (avoids UTC conversion issues)

  // Helper to check if a booking's scheduled time has passed
  const isBookingPast = (booking: ClientBooking): boolean => {
    const now = new Date();
    const today = getLocalDateString(now);
    
    if (booking.class_date < today) return true;
    if (booking.class_date > today) return false;
    
    if (!booking.intro_time) return false;
    
    const currentTime = now.toTimeString().slice(0, 5);
    return booking.intro_time <= currentTime;
  };

  const isBookingToday = (booking: ClientBooking): boolean => {
    const today = getLocalDateString(new Date());
    return booking.class_date === today;
  };

  const isBookingUpcoming = (booking: ClientBooking): boolean => {
    const now = new Date();
    const today = getLocalDateString(now);
    
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

  // Lead source options for filter dropdown
  const leadSourceOptions = useMemo(() => {
    const sources = new Set<string>();
    journeys.forEach(j => {
      j.bookings.forEach(b => {
        if (b.lead_source) sources.add(b.lead_source);
      });
    });
    return Array.from(sources).sort();
  }, [journeys]);

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
      by_lead_source: 0,
      vip_class: 0,
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

      // By lead source count (shows all when no specific source selected)
      counts.by_lead_source++;
    });

    // VIP count - includes ALL journeys (even purchased) with VIP Class lead source
    journeys.forEach(journey => {
      const isVip = journey.bookings.some(b => b.lead_source === 'VIP Class');
      if (isVip) counts.vip_class++;
    });

    return counts;
  }, [journeys]);

  // Filter by tab - always exclude purchased members
  const filterJourneysByTab = (journeyList: ClientJourney[], tab: JourneyTab): ClientJourney[] => {
    // VIP tab: show ALL VIP Class clients regardless of purchase status
    if (tab === 'vip_class') {
      return journeyList.filter(j => j.bookings.some(b => b.lead_source === 'VIP Class'));
    }

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

        case 'by_lead_source':
          // If a lead source is selected, filter by it
          if (selectedLeadSource) {
            return journey.bookings.some(b => b.lead_source === selectedLeadSource);
          }
          // If no source selected, show all
          return true;

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

    // Apply sort
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'recent': {
          const aDate = a.bookings[0]?.class_date || '';
          const bDate = b.bookings[0]?.class_date || '';
          return bDate.localeCompare(aDate);
        }
        case 'oldest': {
          const aDate = a.bookings[0]?.class_date || '';
          const bDate = b.bookings[0]?.class_date || '';
          return aDate.localeCompare(bDate);
        }
        case 'az':
          return a.memberName.localeCompare(b.memberName);
        case 'za':
          return b.memberName.localeCompare(a.memberName);
        case 'date_asc': {
          const aDate = a.bookings[0]?.class_date || '9999';
          const bDate = b.bookings[0]?.class_date || '9999';
          return aDate.localeCompare(bDate);
        }
        case 'date_desc': {
          const aDate = a.bookings[0]?.class_date || '';
          const bDate = b.bookings[0]?.class_date || '';
          return bDate.localeCompare(aDate);
        }
        default: return 0;
      }
    });
    return sorted;
  }, [journeys, searchTerm, activeTab, selectedLeadSource, sortBy]);

  // Group VIP journeys by class name
  const vipGroups = useMemo(() => {
    if (activeTab !== 'vip_class') return null;
    const groups: Record<string, typeof filteredJourneys> = {};
    filteredJourneys.forEach(j => {
      const className = j.bookings.find(b => (b as any).vip_class_name)?.vip_class_name || 'Ungrouped';
      if (!groups[className]) groups[className] = [];
      groups[className].push(j);
    });
    // Sort: named groups first, Ungrouped last
    const sorted = Object.entries(groups).sort(([a], [b]) => {
      if (a === 'Ungrouped') return 1;
      if (b === 'Ungrouped') return -1;
      return a.localeCompare(b);
    });
    return sorted;
  }, [filteredJourneys, activeTab]);

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
    return parseLocalDate(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '';
    return timeStr.substring(0, 5);
  };

  const renderJourneyCard = (journey: ClientJourney) => (
    <>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
          <div className="flex items-center gap-3">
            {expandedClients.has(journey.memberKey) ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <div className="text-left">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-medium">{journey.memberName}</p>
                <IntroTypeBadge isSecondIntro={journey.bookings.some(b => b.originating_booking_id != null) || journey.bookings.length > 1} />
                <LeadSourceTag source={journey.bookings[0]?.lead_source || 'Unknown'} />
                {(() => {
                  const is2nd = journey.bookings.some(b => b.originating_booking_id != null) || journey.bookings.length > 1;
                  if (is2nd) return null; // Hide questionnaire for 2nd intros
                  const qStatus = journey.bookings.map(b => questionnaireMap.get(b.id)).find(s => s);
                  if (!qStatus) return null;
                  if (qStatus === 'completed') return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[9px] px-1.5 py-0"><ClipboardList className="w-2.5 h-2.5 mr-0.5" />Done</Badge>;
                  if (qStatus === 'sent') return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] px-1.5 py-0"><ClipboardList className="w-2.5 h-2.5 mr-0.5" />Sent</Badge>;
                  return <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-[9px] px-1.5 py-0"><ClipboardList className="w-2.5 h-2.5 mr-0.5" />Not Sent</Badge>;
                })()}
              </div>
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
                {activeTab === 'vip_class' && (() => {
                  const vip = journey.bookings.map(b => vipInfoMap.get(b.id)).find(v => v);
                  if (!vip) return null;
                  return (
                    <>
                      {vip.birthday && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">🎂 {vip.birthday}</span>}
                      {vip.weight_lbs && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">⚖️ {vip.weight_lbs} lbs</span>}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setScriptTargetKey(journey.memberKey);
              }}
              className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
              title="Create text"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
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
                      {booking.booked_by && <span>Booked by: {capitalizeName(booking.booked_by)}</span>}
                      {booking.coach_name && <span>Coach: {booking.coach_name}</span>}
                      {booking.lead_source && <span>Source: {booking.lead_source}</span>}
                    </div>
                    {booking.fitness_goal && (
                      <div className="mt-1 text-xs">
                        <span className="font-medium">Goal: </span>
                        {booking.fitness_goal}
                      </div>
                    )}
                    <div className="flex gap-1 mt-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px] h-6 px-2"
                        onClick={(e) => { e.stopPropagation(); setPrepTarget({ booking, journey }); }}
                      >
                        <Briefcase className="w-3 h-3 mr-1" />
                        Intro Prep
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px] h-6 px-2"
                        onClick={(e) => { e.stopPropagation(); setProfileTarget(journey); }}
                      >
                        <UserCheck className="w-3 h-3 mr-1" />
                        Profile
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
                      {run.ran_by && <span>Ran by: {capitalizeName(run.ran_by)}</span>}
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
    </>
  );

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
        {/* Search + Sort */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as PipelineSort)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="az">A → Z</SelectItem>
              <SelectItem value="za">Z → A</SelectItem>
              <SelectItem value="date_asc">Intro Soonest</SelectItem>
              <SelectItem value="date_desc">Intro Latest</SelectItem>
            </SelectContent>
          </Select>
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
            <TabsTrigger value="vip_class" className="flex-1 min-w-[60px] gap-1 text-xs text-purple-600 data-[state=active]:text-purple-700">
              <Star className="w-3 h-3" />
              VIP ({tabCounts.vip_class})
            </TabsTrigger>
            <TabsTrigger value="by_lead_source" className="flex-1 min-w-[60px] gap-1 text-xs">
              <Filter className="w-3 h-3" />
              By Source
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Lead Source Filter - shown when By Source tab is active */}
        {activeTab === 'by_lead_source' && (
          <Select 
            value={selectedLeadSource || 'all'} 
            onValueChange={(v) => setSelectedLeadSource(v === 'all' ? null : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select lead source..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Lead Sources</SelectItem>
              {leadSourceOptions.map(source => (
                <SelectItem key={source} value={source}>{source}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Client List */}
        <ScrollArea className="h-[400px]">
          {filteredJourneys.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No clients found
            </p>
          ) : activeTab === 'vip_class' && vipGroups ? (
            <div className="space-y-4">
              {vipGroups.map(([groupName, groupJourneys]) => (
                <div key={groupName}>
                  <div className="flex items-center gap-2 px-2 py-1.5 mb-2 rounded-md bg-purple-50 border border-purple-200">
                    <Star className="w-3.5 h-3.5 text-purple-600" />
                    <span className="text-sm font-semibold text-purple-700">{groupName}</span>
                    <Badge variant="secondary" className="ml-auto text-[10px] h-5">{groupJourneys.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {groupJourneys.map(journey => (
                      <Collapsible
                        key={journey.memberKey}
                        open={expandedClients.has(journey.memberKey)}
                        onOpenChange={() => toggleExpand(journey.memberKey)}
                      >
                        {renderJourneyCard(journey)}
                      </Collapsible>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredJourneys.map(journey => (
                <Collapsible
                  key={journey.memberKey}
                  open={expandedClients.has(journey.memberKey)}
                  onOpenChange={() => toggleExpand(journey.memberKey)}
                >
                  {renderJourneyCard(journey)}
                </Collapsible>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Script Picker for selected client */}
        {scriptTargetKey && (() => {
          const targetJourney = journeys.find(j => j.memberKey === scriptTargetKey);
          if (!targetJourney) return null;
          return (
            <PipelineScriptPicker
              journey={targetJourney}
              open={true}
              onOpenChange={(open) => { if (!open) setScriptTargetKey(null); }}
            />
          );
        })()}
        {/* Client Profile Sheet */}
        {profileTarget && (
          <ClientProfileSheet
            open={true}
            onOpenChange={(open) => { if (!open) setProfileTarget(null); }}
            memberName={profileTarget.memberName}
            memberKey={profileTarget.memberKey}
            bookings={profileTarget.bookings}
            runs={profileTarget.runs}
          />
        )}

        {/* Intro Prep Card */}
        {prepTarget && (
          <IntroPrepCard
            open={true}
            onOpenChange={(open) => { if (!open) setPrepTarget(null); }}
            memberName={prepTarget.journey.memberName}
            classDate={prepTarget.booking.class_date}
            classTime={prepTarget.booking.intro_time}
            coachName={prepTarget.booking.coach_name}
            bookingId={prepTarget.booking.id}
          />
        )}
      </CardContent>
    </Card>
  );
}
