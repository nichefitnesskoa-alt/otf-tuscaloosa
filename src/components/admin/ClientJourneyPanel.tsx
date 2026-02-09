import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  RefreshCw, 
  Loader2,
  Search,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  User,
  Calendar,
  DollarSign,
  Target,
  Wand2,
  Edit,
  MoreVertical,
  UserCheck,
  UserX,
  Archive,
  Trash2,
  Link,
  Plus,
  Save,
  X,
  Clock,
  CalendarCheck,
  UserMinus,
  Users,
  CalendarPlus,
  Filter,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ALL_STAFF, SALES_ASSOCIATES, LEAD_SOURCES, MEMBERSHIP_TYPES } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { capitalizeName } from '@/lib/utils';
import { isMembershipSale } from '@/lib/sales-detection';

// Tab types
type JourneyTab = 'all' | 'upcoming' | 'today' | 'completed' | 'no_show' | 'missed_guest' | 'second_intro' | 'not_interested' | 'by_lead_source';

// Booking status types
const BOOKING_STATUSES = [
  'Active',
  'No-show',
  'Not interested',
  'Closed (Purchased)',
  'Duplicate',
  'Deleted (soft)',
] as const;

// Valid run outcomes
const VALID_OUTCOMES = [
  'Closed',
  'Follow-up needed',
  'Booked 2nd intro',
  'No-show',
  'Premier + OTBeat',
  'Premier w/o OTBeat',
  'Elite + OTBeat',
  'Elite w/o OTBeat',
  'Basic + OTBeat',
  'Basic w/o OTBeat',
];

interface ClientBooking {
  id: string;
  booking_id: string | null;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  coach_name: string;
  sa_working_shift: string;
  booked_by: string | null;
  lead_source: string;
  fitness_goal: string | null;
  booking_status: string | null;
  intro_owner: string | null;
  intro_owner_locked: boolean | null;
  originating_booking_id: string | null;
}

interface ClientRun {
  id: string;
  run_id: string | null;
  member_name: string;
  run_date: string | null;
  class_time: string;
  result: string;
  intro_owner: string | null;
  ran_by: string | null;
  lead_source: string | null;
  goal_quality: string | null;
  pricing_engagement: string | null;
  notes: string | null;
  commission_amount: number | null;
  linked_intro_booked_id: string | null;
  coach_name: string | null;
  // Lead measures fields
  goal_why_captured: string | null;
  relationship_experience: string | null;
  made_a_friend: boolean | null;
  buy_date: string | null;
}

interface ClientJourney {
  memberKey: string;
  memberName: string;
  bookings: ClientBooking[];
  runs: ClientRun[];
  hasInconsistency: boolean;
  inconsistencyType: string | null;
  hasSale: boolean;
  totalCommission: number;
  latestIntroOwner: string | null;
  status: 'active' | 'purchased' | 'not_interested' | 'no_show' | 'unknown';
}

// Sync intro_owner from run to linked booking
export async function syncIntroOwnerToBooking(
  bookingId: string, 
  introOwner: string,
  editor: string = 'System'
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('intros_booked')
      .update({
        intro_owner: introOwner,
        intro_owner_locked: true,
        last_edited_at: new Date().toISOString(),
        last_edited_by: `${editor} (Auto-Sync)`,
        edit_reason: 'Synced intro_owner from linked run',
      })
      .eq('id', bookingId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error syncing intro_owner:', error);
    return false;
  }
}

export default function ClientJourneyPanel() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterInconsistencies, setFilterInconsistencies] = useState(false);
  const [activeTab, setActiveTab] = useState<JourneyTab>('all');
  const [journeys, setJourneys] = useState<ClientJourney[]>([]);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [selectedLeadSource, setSelectedLeadSource] = useState<string | null>(null);
  
  // Auto-fix dialog
  const [showFixDialog, setShowFixDialog] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [fixResults, setFixResults] = useState<{ fixed: number; errors: number } | null>(null);

  // Booking editing
  const [editingBooking, setEditingBooking] = useState<ClientBooking | null>(null);
  const [editBookingReason, setEditBookingReason] = useState('');
  
  // Run editing
  const [editingRun, setEditingRun] = useState<ClientRun | null>(null);
  const [editRunReason, setEditRunReason] = useState('');
  
  // Mark as Purchased dialog
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [purchasingBooking, setPurchasingBooking] = useState<ClientBooking | null>(null);
  const [purchaseData, setPurchaseData] = useState({
    date_closed: new Date().toISOString().split('T')[0],
    membership_type: '',
    sale_type: 'Intro' as 'Intro' | 'Outside Intro',
    intro_owner: '',
  });
  
  // Set Intro Owner dialog
  const [showSetOwnerDialog, setShowSetOwnerDialog] = useState(false);
  const [ownerBooking, setOwnerBooking] = useState<ClientBooking | null>(null);
  const [newIntroOwner, setNewIntroOwner] = useState('');
  const [ownerOverrideReason, setOwnerOverrideReason] = useState('');
  
  // Hard Delete confirm dialog
  const [showHardDeleteDialog, setShowHardDeleteDialog] = useState(false);
  const [deletingBooking, setDeletingBooking] = useState<ClientBooking | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // Link run to booking dialog
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkingRun, setLinkingRun] = useState<ClientRun | null>(null);
  const [availableBookingsForLink, setAvailableBookingsForLink] = useState<ClientBooking[]>([]);

  // Create new booking dialog
  const [showCreateBookingDialog, setShowCreateBookingDialog] = useState(false);
  const [isSelfBooked, setIsSelfBooked] = useState(false);
  const [creatingBookingFromRun, setCreatingBookingFromRun] = useState<ClientRun | null>(null);
  const [newBooking, setNewBooking] = useState({
    member_name: '',
    class_date: new Date().toISOString().split('T')[0],
    intro_time: '',
    coach_name: '',
    sa_working_shift: '',
    lead_source: '',
    fitness_goal: '',
  });

  // Create new run dialog
  const [showCreateRunDialog, setShowCreateRunDialog] = useState(false);
  const [creatingRunForJourney, setCreatingRunForJourney] = useState<ClientJourney | null>(null);
  const [newRun, setNewRun] = useState({
    member_name: '',
    run_date: new Date().toISOString().split('T')[0],
    class_time: '',
    ran_by: '',
    lead_source: '',
    result: '',
    notes: '',
    linked_intro_booked_id: '',
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [bookingsRes, runsRes] = await Promise.all([
        supabase
          .from('intros_booked')
          .select('id, booking_id, member_name, class_date, intro_time, coach_name, sa_working_shift, booked_by, lead_source, fitness_goal, booking_status, intro_owner, intro_owner_locked, originating_booking_id')
          .order('class_date', { ascending: false }),
        supabase
          .from('intros_run')
          .select('id, run_id, member_name, run_date, class_time, result, intro_owner, ran_by, lead_source, goal_quality, pricing_engagement, notes, commission_amount, linked_intro_booked_id, goal_why_captured, relationship_experience, made_a_friend, buy_date, coach_name')
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

      // Build journeys with inconsistency detection
      const clientJourneys: ClientJourney[] = [];

      clientMap.forEach((data, key) => {
        const memberName = data.bookings[0]?.member_name || data.runs[0]?.member_name || key;
        
        let hasInconsistency = false;
        let inconsistencyType: string | null = null;

        // Check for linked runs where booking has different intro_owner
        data.runs.forEach(run => {
          if (run.linked_intro_booked_id) {
            const linkedBooking = data.bookings.find(b => b.id === run.linked_intro_booked_id);
            if (linkedBooking) {
              const runOwner = run.intro_owner || run.ran_by;
              if (runOwner && linkedBooking.intro_owner !== runOwner && run.result !== 'No-show') {
                hasInconsistency = true;
                inconsistencyType = `Run shows ${runOwner} but booking shows ${linkedBooking.intro_owner || 'none'}`;
              }
            }
          }
        });

        // Check for corrupted intro_owner (timestamp values)
        data.bookings.forEach(b => {
          if (b.intro_owner && (b.intro_owner.includes('T') && b.intro_owner.includes(':'))) {
            hasInconsistency = true;
            inconsistencyType = 'Corrupted intro_owner (timestamp value)';
          }
        });

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
          hasInconsistency,
          inconsistencyType,
          hasSale,
          totalCommission,
          latestIntroOwner: capitalizeName(latestIntroOwner),
          status,
        });
      });

      // Sort: inconsistencies first, then by recent activity
      clientJourneys.sort((a, b) => {
        if (a.hasInconsistency && !b.hasInconsistency) return -1;
        if (!a.hasInconsistency && b.hasInconsistency) return 1;
        
        const aDate = a.runs[0]?.run_date || a.bookings[0]?.class_date || '';
        const bDate = b.runs[0]?.run_date || b.bookings[0]?.class_date || '';
        return bDate.localeCompare(aDate);
      });

      setJourneys(clientJourneys);
    } catch (error) {
      console.error('Error fetching client data:', error);
      toast.error('Failed to load client data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper to get current local date as YYYY-MM-DD string (avoids UTC conversion issues)
  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to check if a booking's scheduled time has passed
  const isBookingPast = (booking: ClientBooking): boolean => {
    const now = new Date();
    const today = getLocalDateString(now);
    
    if (booking.class_date < today) return true;
    if (booking.class_date > today) return false;
    
    // Same day - check time
    if (!booking.intro_time) {
      // No time set, treat as end of day (so it's not past until tomorrow)
      return false;
    }
    
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM
    return booking.intro_time <= currentTime;
  };

  // Helper to check if a booking is today
  const isBookingToday = (booking: ClientBooking): boolean => {
    const today = getLocalDateString(new Date());
    return booking.class_date === today;
  };

  // Helper to check if a booking is in the future
  const isBookingUpcoming = (booking: ClientBooking): boolean => {
    const now = new Date();
    const today = getLocalDateString(now);
    
    if (booking.class_date > today) return true;
    if (booking.class_date < today) return false;
    
    // Same day - check time
    if (!booking.intro_time) return true; // No time = still upcoming
    
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM
    return booking.intro_time > currentTime;
  };

  // Helper to check if a journey has a membership purchase
  const hasPurchasedMembership = (journey: ClientJourney): boolean => {
    // Check if any run result indicates a sale
    const hasSaleResult = journey.runs.some(r => isMembershipSale(r.result));
    // Also check if any booking is marked as "Closed (Purchased)"
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

  // Calculate tab counts
  const tabCounts = useMemo(() => {
    const counts = {
      all: 0,
      upcoming: 0,
      today: 0,
      completed: 0,
      no_show: 0,
      missed_guest: 0,
      second_intro: 0,
      not_interested: 0,
      by_lead_source: 0,
    };

    journeys.forEach(journey => {
      counts.all++;

      const latestActiveBooking = journey.bookings.find(b => 
        !b.booking_status || b.booking_status === 'Active'
      );

      // Check if this client has purchased a membership
      const hasPurchased = hasPurchasedMembership(journey);

      // Has run records = completed (includes purchases)
      if (journey.runs.length > 0 && journey.runs.some(r => r.result !== 'No-show')) {
        counts.completed++;
      }

      // Check for upcoming bookings
      if (latestActiveBooking && isBookingUpcoming(latestActiveBooking)) {
        counts.upcoming++;
      }

      // Check for today's bookings
      if (latestActiveBooking && isBookingToday(latestActiveBooking)) {
        counts.today++;
      }

      // No-show detection: booking is past AND no run exists (or only no-show runs)
      // EXCLUDE clients who eventually purchased
      const hasActiveBooking = journey.bookings.some(b => 
        (!b.booking_status || b.booking_status === 'Active') && isBookingPast(b)
      );
      const hasValidRun = journey.runs.some(r => r.result !== 'No-show');
      
      if (!hasPurchased && hasActiveBooking && !hasValidRun && journey.runs.every(r => !r || r.result === 'No-show')) {
        counts.no_show++;
      }

      // Missed guest: showed up but didn't buy (Follow-up needed or Booked 2nd intro)
      // EXCLUDE clients who eventually purchased
      const hasMissedResult = journey.runs.some(r => 
        r.result === 'Follow-up needed' || r.result === 'Booked 2nd intro'
      );
      if (!hasPurchased && hasMissedResult) {
        counts.missed_guest++;
      }

      // 2nd intro: has originating_booking_id OR result = 'Booked 2nd intro' OR multiple bookings for same member
      // EXCLUDE clients who eventually purchased
      const has2ndIntro = journey.bookings.some(b => b.originating_booking_id) ||
        journey.runs.some(r => r.result === 'Booked 2nd intro') ||
        (journey.bookings.length > 1 && journey.bookings.some(b => 
          (!b.booking_status || b.booking_status === 'Active') && isBookingUpcoming(b)
        ) && journey.runs.length > 0);
      
      if (!hasPurchased && has2ndIntro) {
        counts.second_intro++;
      }

      // Not interested count
      const hasNotInterestedBooking = journey.bookings.some(b => b.booking_status === 'Not interested');
      if (hasNotInterestedBooking) {
        counts.not_interested++;
      }

      // By lead source count (shows all clients)
      counts.by_lead_source++;
    });

    return counts;
  }, [journeys]);

  // Filter by tab
  const filterJourneysByTab = (journeyList: ClientJourney[], tab: JourneyTab): ClientJourney[] => {
    if (tab === 'all') return journeyList;

    return journeyList.filter(journey => {
      const latestActiveBooking = journey.bookings.find(b => 
        !b.booking_status || b.booking_status === 'Active'
      );
      
      // Check if client has purchased for exclusion logic
      const hasPurchased = hasPurchasedMembership(journey);

      switch (tab) {
        case 'upcoming':
          return latestActiveBooking && isBookingUpcoming(latestActiveBooking);

        case 'today':
          return latestActiveBooking && isBookingToday(latestActiveBooking);

        case 'completed':
          return journey.runs.length > 0 && journey.runs.some(r => r.result !== 'No-show');

        case 'no_show': {
          // Exclude clients who eventually purchased
          if (hasPurchased) return false;
          const hasActiveBooking = journey.bookings.some(b => 
            (!b.booking_status || b.booking_status === 'Active') && isBookingPast(b)
          );
          const hasValidRun = journey.runs.some(r => r.result !== 'No-show');
          return hasActiveBooking && !hasValidRun && journey.runs.every(r => !r || r.result === 'No-show');
        }

        case 'missed_guest':
          // Exclude clients who eventually purchased
          if (hasPurchased) return false;
          return journey.runs.some(r => 
            r.result === 'Follow-up needed' || r.result === 'Booked 2nd intro'
          );

        case 'second_intro':
          // Exclude clients who eventually purchased
          if (hasPurchased) return false;
          return journey.bookings.some(b => b.originating_booking_id) ||
            journey.runs.some(r => r.result === 'Booked 2nd intro') ||
            (journey.bookings.length > 1 && journey.bookings.some(b => 
              (!b.booking_status || b.booking_status === 'Active') && isBookingUpcoming(b)
            ) && journey.runs.length > 0);

        case 'not_interested':
          return journey.bookings.some(b => b.booking_status === 'Not interested');

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

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(j => 
        j.memberName.toLowerCase().includes(term) ||
        j.latestIntroOwner?.toLowerCase().includes(term)
      );
    }

    // Apply inconsistency filter
    if (filterInconsistencies) {
      filtered = filtered.filter(j => j.hasInconsistency);
    }

    // Apply tab filter
    filtered = filterJourneysByTab(filtered, activeTab);

    return filtered;
  }, [journeys, searchTerm, filterInconsistencies, activeTab, selectedLeadSource]);

  const inconsistencyCount = useMemo(() => 
    journeys.filter(j => j.hasInconsistency).length,
    [journeys]
  );

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

  // === BOOKING ACTIONS ===
  
  const handleEditBooking = (booking: ClientBooking) => {
    setEditingBooking({ ...booking });
    setEditBookingReason('');
  };

  const handleSaveBooking = async () => {
    if (!editingBooking) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('intros_booked')
        .update({
          member_name: editingBooking.member_name,
          class_date: editingBooking.class_date,
          intro_time: editingBooking.intro_time,
          coach_name: editingBooking.coach_name,
          sa_working_shift: editingBooking.sa_working_shift,
          booked_by: editingBooking.booked_by,
          lead_source: editingBooking.lead_source,
          fitness_goal: editingBooking.fitness_goal,
          booking_status: editingBooking.booking_status,
          last_edited_at: new Date().toISOString(),
          last_edited_by: user?.name || 'Admin',
          edit_reason: editBookingReason || 'Admin edit',
        })
        .eq('id', editingBooking.id);

      if (error) throw error;
      
      toast.success('Booking updated');
      setEditingBooking(null);
      await fetchData();
    } catch (error) {
      console.error('Error saving booking:', error);
      toast.error('Failed to save booking');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenPurchaseDialog = (booking: ClientBooking) => {
    setPurchasingBooking(booking);
    setPurchaseData({
      date_closed: new Date().toISOString().split('T')[0],
      membership_type: '',
      sale_type: 'Intro',
      intro_owner: booking.intro_owner || '',
    });
    setShowPurchaseDialog(true);
  };

  const handleConfirmPurchase = async () => {
    if (!purchasingBooking) return;
    
    if (!purchaseData.membership_type) {
      toast.error('Membership type is required');
      return;
    }
    
    if (purchaseData.sale_type === 'Intro' && !purchaseData.intro_owner) {
      toast.error('Intro owner is required for intro sales');
      return;
    }
    
    setIsSaving(true);
    try {
      const membershipConfig = MEMBERSHIP_TYPES.find(m => m.label === purchaseData.membership_type);
      const commissionAmount = membershipConfig?.commission || 0;
      
      const saleId = `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const { error: saleError } = await supabase
        .from('sales_outside_intro')
        .insert({
          sale_id: saleId,
          sale_type: purchaseData.sale_type === 'Intro' ? 'intro' : 'outside_intro',
          member_name: purchasingBooking.member_name,
          lead_source: purchasingBooking.lead_source,
          membership_type: purchaseData.membership_type,
          commission_amount: commissionAmount,
          intro_owner: purchaseData.intro_owner || null,
          date_closed: purchaseData.date_closed,
        });

      if (saleError) throw saleError;
      
      const { error: bookingError } = await supabase
        .from('intros_booked')
        .update({
          booking_status: 'Closed (Purchased)',
          closed_at: new Date().toISOString(),
          closed_by: user?.name || 'Admin',
          intro_owner: purchaseData.intro_owner || purchasingBooking.intro_owner,
          intro_owner_locked: true,
          last_edited_at: new Date().toISOString(),
          last_edited_by: user?.name || 'Admin',
          edit_reason: 'Marked as purchased',
        })
        .eq('id', purchasingBooking.id);

      if (bookingError) throw bookingError;
      
      toast.success('Sale recorded and booking closed');
      setShowPurchaseDialog(false);
      setPurchasingBooking(null);
      await fetchData();
    } catch (error) {
      console.error('Error recording purchase:', error);
      toast.error('Failed to record purchase');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkNotInterested = async (booking: ClientBooking) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('intros_booked')
        .update({
          booking_status: 'Not interested',
          closed_at: new Date().toISOString(),
          closed_by: user?.name || 'Admin',
          last_edited_at: new Date().toISOString(),
          last_edited_by: user?.name || 'Admin',
          edit_reason: 'Marked as not interested',
        })
        .eq('id', booking.id);

      if (error) throw error;
      
      toast.success('Booking marked as not interested');
      await fetchData();
    } catch (error) {
      console.error('Error updating booking:', error);
      toast.error('Failed to update booking');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenSetOwnerDialog = (booking: ClientBooking) => {
    setOwnerBooking(booking);
    setNewIntroOwner(booking.intro_owner || '');
    setOwnerOverrideReason('');
    setShowSetOwnerDialog(true);
  };

  const handleConfirmSetOwner = async () => {
    if (!ownerBooking) return;
    
    const isClearing = !newIntroOwner || newIntroOwner === '__CLEAR__';
    
    if (ownerBooking.intro_owner_locked && !isClearing && !ownerOverrideReason) {
      toast.error('Override reason is required to change a locked intro owner');
      return;
    }
    
    setIsSaving(true);
    try {
      if (isClearing) {
        const { error } = await supabase
          .from('intros_booked')
          .update({
            intro_owner: null,
            intro_owner_locked: false,
            last_edited_at: new Date().toISOString(),
            last_edited_by: user?.name || 'Admin',
            edit_reason: ownerOverrideReason || 'Cleared intro owner (unlocked)',
          })
          .eq('id', ownerBooking.id);

        if (error) throw error;
        toast.success('Intro owner cleared and unlocked');
      } else {
        const { error } = await supabase
          .from('intros_booked')
          .update({
            intro_owner: newIntroOwner,
            intro_owner_locked: true,
            last_edited_at: new Date().toISOString(),
            last_edited_by: user?.name || 'Admin',
            edit_reason: ownerOverrideReason || 'Set intro owner',
          })
          .eq('id', ownerBooking.id);

        if (error) throw error;
        toast.success(`Intro owner set to ${newIntroOwner}`);
      }
      
      setShowSetOwnerDialog(false);
      setOwnerBooking(null);
      await fetchData();
    } catch (error) {
      console.error('Error setting intro owner:', error);
      toast.error('Failed to set intro owner');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSoftDelete = async (booking: ClientBooking) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('intros_booked')
        .update({
          booking_status: 'Deleted (soft)',
          last_edited_at: new Date().toISOString(),
          last_edited_by: user?.name || 'Admin',
          edit_reason: 'Archived by admin',
        })
        .eq('id', booking.id);

      if (error) throw error;
      
      toast.success('Booking archived');
      await fetchData();
    } catch (error) {
      console.error('Error archiving booking:', error);
      toast.error('Failed to archive booking');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenHardDeleteDialog = (booking: ClientBooking) => {
    setDeletingBooking(booking);
    setDeleteConfirmText('');
    setShowHardDeleteDialog(true);
  };

  const handleConfirmHardDelete = async () => {
    if (!deletingBooking || deleteConfirmText !== 'DELETE') return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('intros_booked')
        .delete()
        .eq('id', deletingBooking.id);

      if (error) throw error;
      
      toast.success('Booking permanently deleted');
      setShowHardDeleteDialog(false);
      setDeletingBooking(null);
      await fetchData();
    } catch (error) {
      console.error('Error deleting booking:', error);
      toast.error('Failed to delete booking');
    } finally {
      setIsSaving(false);
    }
  };

  // Create new booking
  const handleOpenCreateBookingDialog = () => {
    setNewBooking({
      member_name: '',
      class_date: new Date().toISOString().split('T')[0],
      intro_time: '',
      coach_name: '',
      sa_working_shift: '',
      lead_source: '',
      fitness_goal: '',
    });
    setIsSelfBooked(false);
    setCreatingBookingFromRun(null);
    setShowCreateBookingDialog(true);
  };

  // Create matching booking from an unlinked run
  const handleCreateMatchingBooking = (run: ClientRun) => {
    // Pre-populate with run data
    setNewBooking({
      member_name: run.member_name,
      class_date: run.run_date || new Date().toISOString().split('T')[0],
      intro_time: run.class_time || '',
      coach_name: '',
      sa_working_shift: '',
      lead_source: run.lead_source || '',
      fitness_goal: '',
    });
    // Check if lead source indicates self-booked
    const isSelfBookedSource = run.lead_source === 'Online Intro Offer (self-booked)';
    setIsSelfBooked(isSelfBookedSource);
    setCreatingBookingFromRun(run);
    setShowCreateBookingDialog(true);
  };

  const handleCreateBooking = async () => {
    if (!newBooking.member_name) {
      toast.error('Member name is required');
      return;
    }
    
    if (!isSelfBooked && !newBooking.sa_working_shift) {
      toast.error('Booked By is required when not self-booked');
      return;
    }
    
    setIsSaving(true);
    try {
      const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const bookedBy = isSelfBooked ? 'Self-booked' : newBooking.sa_working_shift;
      const leadSource = isSelfBooked ? 'Online Intro Offer (self-booked)' : (newBooking.lead_source || 'Source Not Found');
      
      // Determine intro_owner from the linked run if creating from run
      const introOwner = creatingBookingFromRun?.intro_owner || creatingBookingFromRun?.ran_by || null;
      
      const { data: insertedBooking, error } = await supabase
        .from('intros_booked')
        .insert({
          booking_id: bookingId,
          member_name: newBooking.member_name,
          class_date: newBooking.class_date,
          intro_time: newBooking.intro_time || null,
          coach_name: newBooking.coach_name || 'TBD',
          sa_working_shift: bookedBy,
          booked_by: bookedBy,
          lead_source: leadSource,
          fitness_goal: newBooking.fitness_goal || null,
          booking_status: creatingBookingFromRun ? 'Active' : 'Active',
          intro_owner: introOwner,
          intro_owner_locked: !!introOwner,
        })
        .select()
        .single();

      if (error) throw error;
      
      // If creating from a run, link the run to this new booking
      if (creatingBookingFromRun && insertedBooking) {
        const { error: linkError } = await supabase
          .from('intros_run')
          .update({
            linked_intro_booked_id: insertedBooking.id,
            last_edited_at: new Date().toISOString(),
            last_edited_by: user?.name || 'Admin',
            edit_reason: 'Linked to newly created matching booking',
          })
          .eq('id', creatingBookingFromRun.id);
          
        if (linkError) {
          console.error('Error linking run to booking:', linkError);
          toast.error('Booking created but failed to link run');
        } else {
          toast.success('Booking created and linked to run');
        }
      } else {
        toast.success('Booking created');
      }
      
      setShowCreateBookingDialog(false);
      setCreatingBookingFromRun(null);
      await fetchData();
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error('Failed to create booking');
    } finally {
      setIsSaving(false);
    }
  };

  // === RUN ACTIONS ===

  // Open create run dialog for a specific client journey
  const handleOpenCreateRunDialog = (journey: ClientJourney) => {
    setCreatingRunForJourney(journey);
    const latestBooking = journey.bookings.find(b => !b.booking_status || b.booking_status === 'Active');
    setNewRun({
      member_name: journey.memberName,
      run_date: new Date().toISOString().split('T')[0],
      class_time: latestBooking?.intro_time || '',
      ran_by: '',
      lead_source: latestBooking?.lead_source || '',
      result: '',
      notes: '',
      linked_intro_booked_id: latestBooking?.id || '',
    });
    setShowCreateRunDialog(true);
  };

  const handleCreateRun = async () => {
    if (!newRun.member_name) {
      toast.error('Member name is required');
      return;
    }
    if (!newRun.ran_by) {
      toast.error('Ran By is required');
      return;
    }
    if (!newRun.result) {
      toast.error('Result/Outcome is required');
      return;
    }
    if (!newRun.class_time) {
      toast.error('Class time is required');
      return;
    }

    setIsSaving(true);
    try {
      const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const { error } = await supabase
        .from('intros_run')
        .insert({
          run_id: runId,
          member_name: newRun.member_name,
          run_date: newRun.run_date,
          class_time: newRun.class_time,
          ran_by: newRun.ran_by,
          intro_owner: newRun.ran_by, // Set intro_owner to ran_by
          lead_source: newRun.lead_source || 'Source Not Found',
          result: newRun.result,
          notes: newRun.notes || null,
          linked_intro_booked_id: newRun.linked_intro_booked_id && newRun.linked_intro_booked_id !== '__NONE__' ? newRun.linked_intro_booked_id : null,
        });

      if (error) throw error;

      // Sync intro_owner to linked booking if applicable
      if (newRun.linked_intro_booked_id && newRun.linked_intro_booked_id !== '__NONE__' && newRun.result !== 'No-show') {
        await syncIntroOwnerToBooking(newRun.linked_intro_booked_id, newRun.ran_by, user?.name || 'Admin');
      }

      toast.success('Intro run logged');
      setShowCreateRunDialog(false);
      setCreatingRunForJourney(null);
      await fetchData();
    } catch (error) {
      console.error('Error creating run:', error);
      toast.error('Failed to create run');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleEditRun = (run: ClientRun) => {
    setEditingRun({ ...run });
    setEditRunReason('');
  };

  const handleSaveRun = async () => {
    if (!editingRun) return;
    
    setIsSaving(true);
    try {
      const effectiveIntroOwner = editingRun.intro_owner || editingRun.ran_by || null;
      
      const { error } = await supabase
        .from('intros_run')
        .update({
          member_name: editingRun.member_name,
          run_date: editingRun.run_date,
          class_time: editingRun.class_time,
          lead_source: editingRun.lead_source,
          intro_owner: effectiveIntroOwner,
          ran_by: editingRun.ran_by,
          result: editingRun.result,
          goal_quality: editingRun.goal_quality,
          pricing_engagement: editingRun.pricing_engagement,
          notes: editingRun.notes,
          linked_intro_booked_id: editingRun.linked_intro_booked_id,
          coach_name: editingRun.coach_name,
          // Lead measures
          goal_why_captured: editingRun.goal_why_captured,
          relationship_experience: editingRun.relationship_experience,
          made_a_friend: editingRun.made_a_friend,
          // Sale fields
          commission_amount: editingRun.commission_amount,
          buy_date: editingRun.buy_date,
          last_edited_at: new Date().toISOString(),
          last_edited_by: user?.name || 'Admin',
          edit_reason: editRunReason || 'Admin edit',
        })
        .eq('id', editingRun.id);

      if (error) throw error;
      
      // Real-time sync to linked booking (intro_owner and coach_name)
      if (editingRun.linked_intro_booked_id && editingRun.result !== 'No-show') {
        const updateData: Record<string, unknown> = {
          last_edited_at: new Date().toISOString(),
          last_edited_by: `${user?.name || 'Admin'} (Auto-Sync)`,
          edit_reason: 'Synced from linked run',
        };
        
        if (effectiveIntroOwner) {
          updateData.intro_owner = effectiveIntroOwner;
          updateData.intro_owner_locked = true;
        }
        
        if (editingRun.coach_name) {
          updateData.coach_name = editingRun.coach_name;
        }
        
        await supabase
          .from('intros_booked')
          .update(updateData)
          .eq('id', editingRun.linked_intro_booked_id);
      }
      
      toast.success('Run updated');
      setEditingRun(null);
      await fetchData();
    } catch (error) {
      console.error('Error saving run:', error);
      toast.error('Failed to save run');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenLinkDialog = (run: ClientRun, allBookings: ClientBooking[]) => {
    setLinkingRun(run);
    // Filter to bookings for this member that aren't already closed
    const available = allBookings.filter(b => 
      b.member_name.toLowerCase() === run.member_name.toLowerCase() &&
      (!b.booking_status || ['Active', 'No-show'].includes(b.booking_status))
    );
    setAvailableBookingsForLink(available);
    setShowLinkDialog(true);
  };

  const handleLinkRunToBooking = async (bookingId: string) => {
    if (!linkingRun) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('intros_run')
        .update({
          linked_intro_booked_id: bookingId,
          last_edited_at: new Date().toISOString(),
          last_edited_by: user?.name || 'Admin',
          edit_reason: 'Linked to booking',
        })
        .eq('id', linkingRun.id);

      if (error) throw error;
      
      // Auto-set intro_owner if this is first non-no-show run
      if (linkingRun.result !== 'No-show' && linkingRun.ran_by) {
        await syncIntroOwnerToBooking(bookingId, linkingRun.ran_by, user?.name || 'Admin');
      }
      
      toast.success('Run linked to booking');
      setShowLinkDialog(false);
      setLinkingRun(null);
      await fetchData();
    } catch (error) {
      console.error('Error linking run:', error);
      toast.error('Failed to link run');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnlinkRun = async (run: ClientRun) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('intros_run')
        .update({
          linked_intro_booked_id: null,
          last_edited_at: new Date().toISOString(),
          last_edited_by: user?.name || 'Admin',
          edit_reason: 'Unlinked from booking',
        })
        .eq('id', run.id);

      if (error) throw error;
      
      toast.success('Run unlinked from booking');
      await fetchData();
    } catch (error) {
      console.error('Error unlinking run:', error);
      toast.error('Failed to unlink run');
    } finally {
      setIsSaving(false);
    }
  };

  // === AUTO-FIX ===
  
  const handleAutoFix = async () => {
    setIsFixing(true);
    setFixResults(null);
    
    let fixed = 0;
    let errors = 0;

    try {
      const inconsistentJourneys = journeys.filter(j => j.hasInconsistency);

      for (const journey of inconsistentJourneys) {
        for (const run of journey.runs) {
          if (run.linked_intro_booked_id && run.result !== 'No-show') {
            const runOwner = run.intro_owner || run.ran_by;
            if (runOwner) {
              const linkedBooking = journey.bookings.find(b => b.id === run.linked_intro_booked_id);
              if (linkedBooking && linkedBooking.intro_owner !== runOwner) {
                const success = await syncIntroOwnerToBooking(
                  run.linked_intro_booked_id,
                  runOwner,
                  user?.name || 'Admin'
                );
                if (success) {
                  fixed++;
                } else {
                  errors++;
                }
              }
            }
          }
        }

        // Fix corrupted intro_owner values
        for (const booking of journey.bookings) {
          if (booking.intro_owner && booking.intro_owner.includes('T') && booking.intro_owner.includes(':')) {
            const linkedRun = journey.runs.find(r => 
              r.linked_intro_booked_id === booking.id && r.result !== 'No-show'
            );
            const correctOwner = linkedRun?.intro_owner || linkedRun?.ran_by || null;
            
            const { error } = await supabase
              .from('intros_booked')
              .update({
                intro_owner: correctOwner,
                intro_owner_locked: !!correctOwner,
                last_edited_at: new Date().toISOString(),
                last_edited_by: `${user?.name || 'Admin'} (Auto-Fix)`,
                edit_reason: 'Fixed corrupted intro_owner value',
              })
              .eq('id', booking.id);

            if (error) {
              errors++;
            } else {
              fixed++;
            }
          }
        }
      }

      setFixResults({ fixed, errors });
      if (fixed > 0) {
        toast.success(`Fixed ${fixed} inconsistencies`);
        await fetchData();
      }
    } catch (error) {
      console.error('Error auto-fixing:', error);
      toast.error('Failed to auto-fix');
    } finally {
      setIsFixing(false);
    }
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
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" />
            Client Journey View
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenCreateBookingDialog}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Booking
            </Button>
            {inconsistencyCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFixDialog(true)}
                className="text-warning"
              >
                <Wand2 className="w-4 h-4 mr-1" />
                Fix {inconsistencyCount}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Unified view of client bookings, runs, and outcomes. Click to expand and edit.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or intro owner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button
            variant={filterInconsistencies ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterInconsistencies(!filterInconsistencies)}
          >
            <AlertTriangle className="w-4 h-4 mr-1" />
            Issues ({inconsistencyCount})
          </Button>
        </div>

        {/* Status-based tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as JourneyTab)} className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="all" className="flex-1 min-w-[70px] text-xs gap-1">
              <Users className="w-3 h-3" />
              All
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{tabCounts.all}</Badge>
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="flex-1 min-w-[80px] text-xs gap-1">
              <Clock className="w-3 h-3" />
              Upcoming
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{tabCounts.upcoming}</Badge>
            </TabsTrigger>
            <TabsTrigger value="today" className="flex-1 min-w-[70px] text-xs gap-1">
              <Calendar className="w-3 h-3" />
              Today
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{tabCounts.today}</Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex-1 min-w-[85px] text-xs gap-1">
              <CalendarCheck className="w-3 h-3" />
              Completed
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{tabCounts.completed}</Badge>
            </TabsTrigger>
            <TabsTrigger value="no_show" className="flex-1 min-w-[80px] text-xs gap-1 text-destructive data-[state=active]:text-destructive">
              <UserX className="w-3 h-3" />
              No-shows
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">{tabCounts.no_show}</Badge>
            </TabsTrigger>
            <TabsTrigger value="missed_guest" className="flex-1 min-w-[80px] text-xs gap-1 text-warning data-[state=active]:text-warning">
              <UserMinus className="w-3 h-3" />
              Missed
              <Badge className="ml-1 h-5 px-1.5 text-[10px] bg-warning text-warning-foreground">{tabCounts.missed_guest}</Badge>
            </TabsTrigger>
            <TabsTrigger value="second_intro" className="flex-1 min-w-[70px] text-xs gap-1">
              <CalendarPlus className="w-3 h-3" />
              2nd
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{tabCounts.second_intro}</Badge>
            </TabsTrigger>
            <TabsTrigger value="not_interested" className="flex-1 min-w-[100px] text-xs gap-1 text-muted-foreground data-[state=active]:text-muted-foreground">
              <UserX className="w-3 h-3" />
              Not Interested
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{tabCounts.not_interested}</Badge>
            </TabsTrigger>
            <TabsTrigger value="by_lead_source" className="flex-1 min-w-[80px] text-xs gap-1">
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

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="p-2 bg-muted/50 rounded">
            <div className="font-bold">{filteredJourneys.length}</div>
            <div className="text-muted-foreground">Showing</div>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <div className="font-bold text-success">{journeys.filter(j => j.hasSale).length}</div>
            <div className="text-muted-foreground">Purchased</div>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <div className="font-bold text-primary">{journeys.filter(j => j.status === 'active').length}</div>
            <div className="text-muted-foreground">Active</div>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <div className="font-bold text-warning">{inconsistencyCount}</div>
            <div className="text-muted-foreground">Issues</div>
          </div>
        </div>

        {/* Client list */}
        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredJourneys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No clients found
            </div>
          ) : (
            <div className="space-y-2">
              {filteredJourneys.slice(0, 100).map((journey) => (
                <Collapsible
                  key={journey.memberKey}
                  open={expandedClients.has(journey.memberKey)}
                  onOpenChange={() => toggleExpand(journey.memberKey)}
                >
                  <CollapsibleTrigger asChild>
                    <div
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        journey.hasInconsistency 
                          ? 'bg-warning/10 border border-warning/30 hover:bg-warning/20' 
                          : 'bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {expandedClients.has(journey.memberKey) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                          <span className="font-medium">{journey.memberName}</span>
                          {journey.hasInconsistency && (
                            <AlertTriangle className="w-4 h-4 text-warning" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(journey.status)}
                          {journey.totalCommission > 0 && (
                            <Badge variant="outline" className="text-success">
                              ${journey.totalCommission.toFixed(0)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>{journey.bookings.length} booking(s)</span>
                        <span>{journey.runs.length} run(s)</span>
                        {journey.latestIntroOwner && (
                          <span>Owner: {journey.latestIntroOwner}</span>
                        )}
                        {journey.bookings[0]?.coach_name && journey.bookings[0].coach_name !== 'TBD' && (
                          <span>🏋️ Coach: {journey.bookings[0].coach_name}</span>
                        )}
                      </div>
                      {journey.hasInconsistency && journey.inconsistencyType && (
                        <div className="mt-1 text-xs text-warning">
                          ⚠️ {journey.inconsistencyType}
                        </div>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-6 mt-2 space-y-3 pb-2">
                      {/* Bookings */}
                      {journey.bookings.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Bookings
                          </div>
                          <div className="space-y-1">
                            {journey.bookings.map(b => (
                              <div key={b.id} className="text-xs p-2 bg-background rounded border">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <span className="font-medium">{b.class_date}</span>
                                    {b.intro_time && <span className="text-muted-foreground"> @ {b.intro_time}</span>}
                                    <div className="text-muted-foreground">
                                      Booked by: {capitalizeName(b.booked_by || b.sa_working_shift)}
                                      {b.intro_owner && <span> | Owner: {capitalizeName(b.intro_owner)}</span>}
                                      {b.intro_owner_locked && <span className="text-warning"> 🔒</span>}
                                    </div>
                                    <div className="text-muted-foreground">
                                      Lead: {b.lead_source}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Badge variant="outline" className="h-5">
                                      {b.booking_status || 'Active'}
                                    </Badge>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                          <MoreVertical className="w-3 h-3" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleEditBooking(b)}>
                                          <Edit className="w-3 h-3 mr-2" /> Edit Booking
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleOpenSetOwnerDialog(b)}>
                                          <UserCheck className="w-3 h-3 mr-2" /> Set Intro Owner
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleOpenPurchaseDialog(b)}>
                                          <DollarSign className="w-3 h-3 mr-2" /> Mark as Purchased
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleMarkNotInterested(b)}>
                                          <UserX className="w-3 h-3 mr-2" /> Not Interested
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleSoftDelete(b)}>
                                          <Archive className="w-3 h-3 mr-2" /> Archive
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                          onClick={() => handleOpenHardDeleteDialog(b)}
                                          className="text-destructive"
                                        >
                                          <Trash2 className="w-3 h-3 mr-2" /> Delete Permanently
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Runs */}
                      {journey.runs.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                            <Target className="w-3 h-3" /> Intro Runs
                          </div>
                          <div className="space-y-1">
                            {journey.runs.map(r => (
                              <div key={r.id} className="text-xs p-2 bg-background rounded border">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <span className="font-medium">{r.run_date || 'No date'}</span>
                                    <span className="text-muted-foreground"> @ {r.class_time}</span>
                                    <div className="text-muted-foreground">
                                      Ran by: {capitalizeName(r.ran_by)}
                                      {r.intro_owner && <span> | Owner: {capitalizeName(r.intro_owner)}</span>}
                                    </div>
                                    {!r.linked_intro_booked_id && (
                                      <div className="text-warning">⚠️ Not linked to booking</div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Badge 
                                      variant={isMembershipSale(r.result) ? 'default' : 'outline'}
                                      className={isMembershipSale(r.result) ? 'bg-success' : ''}
                                    >
                                      {r.result}
                                    </Badge>
                                    {(r.commission_amount || 0) > 0 && (
                                      <span className="text-success font-medium">${r.commission_amount}</span>
                                    )}
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                          <MoreVertical className="w-3 h-3" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleEditRun(r)}>
                                          <Edit className="w-3 h-3 mr-2" /> Edit Run
                                        </DropdownMenuItem>
                                        {!r.linked_intro_booked_id ? (
                                          <>
                                            <DropdownMenuItem onClick={() => handleOpenLinkDialog(r, journey.bookings)}>
                                              <Link className="w-3 h-3 mr-2" /> Link to Existing Booking
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleCreateMatchingBooking(r)}>
                                              <CalendarPlus className="w-3 h-3 mr-2" /> Create Matching Booking
                                            </DropdownMenuItem>
                                          </>
                                        ) : (
                                          <DropdownMenuItem onClick={() => handleUnlinkRun(r)}>
                                            <X className="w-3 h-3 mr-2" /> Unlink from Booking
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                        {r.linked_intro_booked_id && (
                                          <DropdownMenuItem 
                                            onClick={() => {
                                              const linkedBooking = journey.bookings.find(b => b.id === r.linked_intro_booked_id);
                                              if (linkedBooking) {
                                                handleMarkNotInterested(linkedBooking);
                                              }
                                            }}
                                            className="text-muted-foreground"
                                          >
                                            <UserX className="w-3 h-3 mr-2" /> Mark Not Interested
                                          </DropdownMenuItem>
                                        )}
                                        {!r.linked_intro_booked_id && (
                                          <DropdownMenuItem 
                                            onClick={async () => {
                                              // Create a temporary booking and mark as not interested
                                              setIsSaving(true);
                                              try {
                                                const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                                                const { error } = await supabase
                                                  .from('intros_booked')
                                                  .insert({
                                                    booking_id: bookingId,
                                                    member_name: r.member_name,
                                                    class_date: r.run_date || new Date().toISOString().split('T')[0],
                                                    intro_time: r.class_time || null,
                                                    coach_name: 'TBD',
                                                    sa_working_shift: r.ran_by || 'Unknown',
                                                    booked_by: r.ran_by || 'Unknown',
                                                    lead_source: r.lead_source || 'Source Not Found',
                                                    booking_status: 'Not interested',
                                                    intro_owner: r.intro_owner || r.ran_by,
                                                    closed_at: new Date().toISOString(),
                                                    closed_by: user?.name || 'Admin',
                                                  });

                                                if (error) throw error;
                                                
                                                toast.success('Client marked as Not Interested');
                                                await fetchData();
                                              } catch (error) {
                                                console.error('Error:', error);
                                                toast.error('Failed to mark as Not Interested');
                                              } finally {
                                                setIsSaving(false);
                                              }
                                            }}
                                            className="text-muted-foreground"
                                          >
                                            <UserX className="w-3 h-3 mr-2" /> Mark Not Interested
                                          </DropdownMenuItem>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Add Run Button - always show */}
                      <div className="pt-2 border-t border-dashed">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => handleOpenCreateRunDialog(journey)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Intro Run
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
              {filteredJourneys.length > 100 && (
                <div className="text-center text-xs text-muted-foreground py-2">
                  Showing first 100 of {filteredJourneys.length} clients
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Edit Booking Dialog */}
        <Dialog open={!!editingBooking} onOpenChange={(open) => !open && setEditingBooking(null)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Booking</DialogTitle>
              <DialogDescription>
                Update booking details for {editingBooking?.member_name}
              </DialogDescription>
            </DialogHeader>
            {editingBooking && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Member Name</Label>
                  <Input
                    value={editingBooking.member_name}
                    onChange={(e) => setEditingBooking({...editingBooking, member_name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Date</Label>
                    <Input
                      type="date"
                      value={editingBooking.class_date}
                      onChange={(e) => setEditingBooking({...editingBooking, class_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Time</Label>
                    <Input
                      type="time"
                      value={editingBooking.intro_time || ''}
                      onChange={(e) => setEditingBooking({...editingBooking, intro_time: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Booked By</Label>
                  <Select
                    value={editingBooking.booked_by || editingBooking.sa_working_shift || ''}
                    onValueChange={(v) => setEditingBooking({...editingBooking, booked_by: v, sa_working_shift: v})}
                  >
                    <SelectTrigger><SelectValue placeholder="Select SA..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Self-booked">Self-booked</SelectItem>
                      {SALES_ASSOCIATES.map(sa => (
                        <SelectItem key={sa} value={sa}>{sa}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Lead Source</Label>
                  <Select
                    value={editingBooking.lead_source || ''}
                    onValueChange={(v) => setEditingBooking({...editingBooking, lead_source: v})}
                  >
                    <SelectTrigger><SelectValue placeholder="Select source..." /></SelectTrigger>
                    <SelectContent>
                      {LEAD_SOURCES.map(src => (
                        <SelectItem key={src} value={src}>{src}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Coach</Label>
                  <Select
                    value={editingBooking.coach_name || ''}
                    onValueChange={(v) => setEditingBooking({...editingBooking, coach_name: v === '__TBD__' ? 'TBD' : v})}
                  >
                    <SelectTrigger><SelectValue placeholder="Select coach..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__TBD__">— TBD/Unknown —</SelectItem>
                      {ALL_STAFF.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={editingBooking.booking_status || 'Active'}
                    onValueChange={(v) => setEditingBooking({...editingBooking, booking_status: v})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BOOKING_STATUSES.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Fitness Goal</Label>
                  <Textarea
                    value={editingBooking.fitness_goal || ''}
                    onChange={(e) => setEditingBooking({...editingBooking, fitness_goal: e.target.value})}
                    className="min-h-[60px]"
                  />
                </div>
                <div>
                  <Label className="text-xs">Edit Reason</Label>
                  <Input
                    value={editBookingReason}
                    onChange={(e) => setEditBookingReason(e.target.value)}
                    placeholder="Why are you making this change?"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingBooking(null)}>Cancel</Button>
              <Button onClick={handleSaveBooking} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Run Dialog */}
        <Dialog open={!!editingRun} onOpenChange={(open) => !open && setEditingRun(null)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Intro Run</DialogTitle>
              <DialogDescription>
                Update run details for {editingRun?.member_name}
              </DialogDescription>
            </DialogHeader>
            {editingRun && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Member Name</Label>
                  <Input
                    value={editingRun.member_name}
                    onChange={(e) => setEditingRun({...editingRun, member_name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Run Date</Label>
                    <Input
                      type="date"
                      value={editingRun.run_date || ''}
                      onChange={(e) => setEditingRun({...editingRun, run_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Time</Label>
                    <Input
                      type="time"
                      value={editingRun.class_time || ''}
                      onChange={(e) => setEditingRun({...editingRun, class_time: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Ran By</Label>
                  <Select
                    value={editingRun.ran_by || ''}
                    onValueChange={(v) => setEditingRun({...editingRun, ran_by: v, intro_owner: v})}
                  >
                    <SelectTrigger><SelectValue placeholder="Select SA..." /></SelectTrigger>
                    <SelectContent>
                      {SALES_ASSOCIATES.map(sa => (
                        <SelectItem key={sa} value={sa}>{sa}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Lead Source</Label>
                  <Select
                    value={editingRun.lead_source || ''}
                    onValueChange={(v) => setEditingRun({...editingRun, lead_source: v})}
                  >
                    <SelectTrigger><SelectValue placeholder="Select source..." /></SelectTrigger>
                    <SelectContent>
                      {LEAD_SOURCES.map(src => (
                        <SelectItem key={src} value={src}>{src}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Result/Outcome</Label>
                  <Select
                    value={editingRun.result || ''}
                    onValueChange={(v) => setEditingRun({...editingRun, result: v})}
                  >
                    <SelectTrigger><SelectValue placeholder="Select outcome..." /></SelectTrigger>
                    <SelectContent>
                      {VALID_OUTCOMES.map(o => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Coach</Label>
                  <Select
                    value={editingRun.coach_name || ''}
                    onValueChange={(v) => setEditingRun({...editingRun, coach_name: v === '__TBD__' ? null : v})}
                  >
                    <SelectTrigger><SelectValue placeholder="Select coach..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__TBD__">— TBD/Unknown —</SelectItem>
                      {ALL_STAFF.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Lead Measures Section */}
                <div className="border-t pt-3">
                  <Label className="text-xs font-semibold mb-2 block">Lead Measures</Label>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Goal + Why Captured</Label>
                      <Select
                        value={editingRun.goal_why_captured || ''}
                        onValueChange={(v) => setEditingRun({...editingRun, goal_why_captured: v})}
                      >
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="Partial">Partial</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Peak Gym Experience</Label>
                      <Select
                        value={editingRun.relationship_experience || ''}
                        onValueChange={(v) => setEditingRun({...editingRun, relationship_experience: v})}
                      >
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="Partial">Partial</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Made a Friend (Start a great relationship & natural conversation)</Label>
                      <Select
                        value={editingRun.made_a_friend === true ? 'Yes' : editingRun.made_a_friend === false ? 'No' : ''}
                        onValueChange={(v) => setEditingRun({...editingRun, made_a_friend: v === 'Yes'})}
                      >
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Quality Metrics */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Goal Quality</Label>
                    <Select
                      value={editingRun.goal_quality || ''}
                      onValueChange={(v) => setEditingRun({...editingRun, goal_quality: v})}
                    >
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Strong">Strong</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Weak">Weak</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Pricing Engagement</Label>
                    <Select
                      value={editingRun.pricing_engagement || ''}
                      onValueChange={(v) => setEditingRun({...editingRun, pricing_engagement: v})}
                    >
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Commission/Sale Info */}
                <div className="border-t pt-3">
                  <Label className="text-xs font-semibold mb-2 block">Sale Info</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Buy Date</Label>
                      <Input
                        type="date"
                        value={editingRun.buy_date || ''}
                        onChange={(e) => setEditingRun({...editingRun, buy_date: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Commission $</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingRun.commission_amount || ''}
                        onChange={(e) => setEditingRun({...editingRun, commission_amount: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    value={editingRun.notes || ''}
                    onChange={(e) => setEditingRun({...editingRun, notes: e.target.value})}
                    className="min-h-[60px]"
                  />
                </div>
                <div>
                  <Label className="text-xs">Edit Reason</Label>
                  <Input
                    value={editRunReason}
                    onChange={(e) => setEditRunReason(e.target.value)}
                    placeholder="Why are you making this change?"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingRun(null)}>Cancel</Button>
              <Button onClick={handleSaveRun} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mark as Purchased Dialog */}
        <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark as Purchased</DialogTitle>
              <DialogDescription>
                Record a sale for {purchasingBooking?.member_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Date Closed</Label>
                <Input
                  type="date"
                  value={purchaseData.date_closed}
                  onChange={(e) => setPurchaseData({...purchaseData, date_closed: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-xs">Membership Type *</Label>
                <Select
                  value={purchaseData.membership_type}
                  onValueChange={(v) => setPurchaseData({...purchaseData, membership_type: v})}
                >
                  <SelectTrigger><SelectValue placeholder="Select membership..." /></SelectTrigger>
                  <SelectContent>
                    {MEMBERSHIP_TYPES.map(m => (
                      <SelectItem key={m.label} value={m.label}>
                        {m.label} (${m.commission} comm)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Sale Type</Label>
                <Select
                  value={purchaseData.sale_type}
                  onValueChange={(v) => setPurchaseData({...purchaseData, sale_type: v as 'Intro' | 'Outside Intro'})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Intro">Intro</SelectItem>
                    <SelectItem value="Outside Intro">Outside Intro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Intro Owner *</Label>
                <Select
                  value={purchaseData.intro_owner}
                  onValueChange={(v) => setPurchaseData({...purchaseData, intro_owner: v})}
                >
                  <SelectTrigger><SelectValue placeholder="Select owner..." /></SelectTrigger>
                  <SelectContent>
                    {SALES_ASSOCIATES.map(sa => (
                      <SelectItem key={sa} value={sa}>{sa}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPurchaseDialog(false)}>Cancel</Button>
              <Button onClick={handleConfirmPurchase} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <DollarSign className="w-4 h-4 mr-1" />}
                Record Sale
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Set Intro Owner Dialog */}
        <Dialog open={showSetOwnerDialog} onOpenChange={setShowSetOwnerDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Intro Owner</DialogTitle>
              <DialogDescription>
                {ownerBooking?.intro_owner_locked 
                  ? `Override intro owner (currently ${ownerBooking.intro_owner})`
                  : 'Assign an intro owner to this booking'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Intro Owner</Label>
                <Select
                  value={newIntroOwner}
                  onValueChange={setNewIntroOwner}
                >
                  <SelectTrigger><SelectValue placeholder="Select owner..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__CLEAR__">— Clear (unlock) —</SelectItem>
                    {SALES_ASSOCIATES.map(sa => (
                      <SelectItem key={sa} value={sa}>{sa}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(ownerBooking?.intro_owner_locked || newIntroOwner === '__CLEAR__') && (
                <div>
                  <Label className="text-xs">Reason for change</Label>
                  <Textarea
                    value={ownerOverrideReason}
                    onChange={(e) => setOwnerOverrideReason(e.target.value)}
                    placeholder="Why are you changing/clearing the intro owner?"
                    className="min-h-[60px]"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSetOwnerDialog(false)}>Cancel</Button>
              <Button onClick={handleConfirmSetOwner} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserCheck className="w-4 h-4 mr-1" />}
                {newIntroOwner === '__CLEAR__' ? 'Clear & Unlock' : 'Set Owner'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Hard Delete Confirm Dialog */}
        <Dialog open={showHardDeleteDialog} onOpenChange={setShowHardDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive">Permanently Delete Booking</DialogTitle>
              <DialogDescription>
                This will permanently delete the booking for {deletingBooking?.member_name}. 
                This action cannot be undone. Type DELETE to confirm.
              </DialogDescription>
            </DialogHeader>
            <div>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowHardDeleteDialog(false)}>Cancel</Button>
              <Button 
                variant="destructive" 
                onClick={handleConfirmHardDelete} 
                disabled={isSaving || deleteConfirmText !== 'DELETE'}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
                Delete Permanently
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Link Run to Booking Dialog */}
        <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Link Run to Booking</DialogTitle>
              <DialogDescription>
                Select a booking to link with this intro run for {linkingRun?.member_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {availableBookingsForLink.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No available bookings found for this member
                </p>
              ) : (
                availableBookingsForLink.map(b => (
                  <div 
                    key={b.id} 
                    className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                    onClick={() => handleLinkRunToBooking(b.id)}
                  >
                    <div className="font-medium">{b.class_date} {b.intro_time && `@ ${b.intro_time}`}</div>
                    <div className="text-xs text-muted-foreground">
                      Booked by: {capitalizeName(b.booked_by || b.sa_working_shift)} | {b.lead_source}
                    </div>
                  </div>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLinkDialog(false)}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Booking Dialog */}
        <Dialog open={showCreateBookingDialog} onOpenChange={(open) => {
          setShowCreateBookingDialog(open);
          if (!open) setCreatingBookingFromRun(null);
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {creatingBookingFromRun ? 'Create Matching Booking' : 'Create New Booking'}
              </DialogTitle>
              <DialogDescription>
                {creatingBookingFromRun 
                  ? `Create a booking record to match the intro run for ${creatingBookingFromRun.member_name}. The booking will be automatically linked to this run.`
                  : 'Add a new intro booking to the system'
                }
              </DialogDescription>
            </DialogHeader>
            
            {/* Show run info if creating from run */}
            {creatingBookingFromRun && (
              <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
                <div className="font-medium text-sm">Auto-populated from run:</div>
                <div>Run Date: {creatingBookingFromRun.run_date}</div>
                <div>Time: {creatingBookingFromRun.class_time}</div>
                <div>Lead Source: {creatingBookingFromRun.lead_source || 'Not set'}</div>
                <div>Ran By: {capitalizeName(creatingBookingFromRun.ran_by)}</div>
              </div>
            )}
            
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Member Name *</Label>
                <Input
                  value={newBooking.member_name}
                  onChange={(e) => setNewBooking({...newBooking, member_name: e.target.value})}
                  placeholder="Full name"
                  disabled={!!creatingBookingFromRun}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={isSelfBooked}
                  onCheckedChange={setIsSelfBooked}
                />
                <Label className="text-sm">Self-booked (online)</Label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Date *</Label>
                  <Input
                    type="date"
                    value={newBooking.class_date}
                    onChange={(e) => setNewBooking({...newBooking, class_date: e.target.value})}
                  />
                </div>
                <div>
                  <Label className="text-xs">Time</Label>
                  <Input
                    type="time"
                    value={newBooking.intro_time}
                    onChange={(e) => setNewBooking({...newBooking, intro_time: e.target.value})}
                  />
                </div>
              </div>
              {!isSelfBooked && (
                <>
                  <div>
                    <Label className="text-xs">Booked By *</Label>
                    <Select
                      value={newBooking.sa_working_shift}
                      onValueChange={(v) => setNewBooking({...newBooking, sa_working_shift: v})}
                    >
                      <SelectTrigger><SelectValue placeholder="Select SA..." /></SelectTrigger>
                      <SelectContent>
                        {SALES_ASSOCIATES.map(sa => (
                          <SelectItem key={sa} value={sa}>{sa}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Lead Source {creatingBookingFromRun ? '(from run)' : ''}</Label>
                    <Select
                      value={newBooking.lead_source}
                      onValueChange={(v) => setNewBooking({...newBooking, lead_source: v})}
                    >
                      <SelectTrigger><SelectValue placeholder="Select source..." /></SelectTrigger>
                      <SelectContent>
                        {LEAD_SOURCES.map(src => (
                          <SelectItem key={src} value={src}>{src}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div>
                <Label className="text-xs">Coach</Label>
                <Select
                  value={newBooking.coach_name}
                  onValueChange={(v) => setNewBooking({...newBooking, coach_name: v})}
                >
                  <SelectTrigger><SelectValue placeholder="Select coach..." /></SelectTrigger>
                  <SelectContent>
                    {ALL_STAFF.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowCreateBookingDialog(false);
                setCreatingBookingFromRun(null);
              }}>Cancel</Button>
              <Button onClick={handleCreateBooking} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                {creatingBookingFromRun ? 'Create & Link' : 'Create Booking'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Create Run Dialog */}
        <Dialog open={showCreateRunDialog} onOpenChange={setShowCreateRunDialog}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Intro Run</DialogTitle>
              <DialogDescription>
                Log that an intro was run for {creatingRunForJourney?.memberName || 'this client'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Member Name</Label>
                <Input
                  value={newRun.member_name}
                  onChange={(e) => setNewRun({...newRun, member_name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Run Date *</Label>
                  <Input
                    type="date"
                    value={newRun.run_date}
                    onChange={(e) => setNewRun({...newRun, run_date: e.target.value})}
                  />
                </div>
                <div>
                  <Label className="text-xs">Time *</Label>
                  <Input
                    type="time"
                    value={newRun.class_time}
                    onChange={(e) => setNewRun({...newRun, class_time: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Ran By *</Label>
                <Select
                  value={newRun.ran_by}
                  onValueChange={(v) => setNewRun({...newRun, ran_by: v})}
                >
                  <SelectTrigger><SelectValue placeholder="Select SA..." /></SelectTrigger>
                  <SelectContent>
                    {SALES_ASSOCIATES.map(sa => (
                      <SelectItem key={sa} value={sa}>{sa}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Lead Source</Label>
                <Select
                  value={newRun.lead_source}
                  onValueChange={(v) => setNewRun({...newRun, lead_source: v})}
                >
                  <SelectTrigger><SelectValue placeholder="Select source..." /></SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map(src => (
                      <SelectItem key={src} value={src}>{src}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Result/Outcome *</Label>
                <Select
                  value={newRun.result}
                  onValueChange={(v) => setNewRun({...newRun, result: v})}
                >
                  <SelectTrigger><SelectValue placeholder="Select outcome..." /></SelectTrigger>
                  <SelectContent>
                    {VALID_OUTCOMES.map(o => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {creatingRunForJourney && creatingRunForJourney.bookings.length > 0 && (
                <div>
                  <Label className="text-xs">Link to Booking</Label>
                  <Select
                    value={newRun.linked_intro_booked_id}
                    onValueChange={(v) => setNewRun({...newRun, linked_intro_booked_id: v})}
                  >
                    <SelectTrigger><SelectValue placeholder="Select booking to link..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__NONE__">— No link —</SelectItem>
                      {creatingRunForJourney.bookings
                        .filter(b => !b.booking_status || b.booking_status === 'Active')
                        .map(b => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.class_date} {b.intro_time ? `@ ${b.intro_time}` : ''} ({b.booking_status || 'Active'})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={newRun.notes}
                  onChange={(e) => setNewRun({...newRun, notes: e.target.value})}
                  placeholder="Any additional notes..."
                  className="min-h-[60px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateRunDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateRun} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                Add Run
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Auto-fix dialog */}
        <Dialog open={showFixDialog} onOpenChange={setShowFixDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Fix Attribution Inconsistencies</DialogTitle>
              <DialogDescription>
                Found {inconsistencyCount} client(s) with mismatched intro_owner between runs and bookings.
                This will sync the intro_owner from runs to their linked bookings.
              </DialogDescription>
            </DialogHeader>
            
            {fixResults && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <span>Fixed {fixResults.fixed} records</span>
                </div>
                {fixResults.errors > 0 && (
                  <div className="flex items-center gap-2 mt-2 text-destructive">
                    <AlertTriangle className="w-5 h-5" />
                    <span>{fixResults.errors} errors</span>
                  </div>
                )}
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowFixDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAutoFix} disabled={isFixing}>
                {isFixing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    Fixing...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-1" />
                    Fix All
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
