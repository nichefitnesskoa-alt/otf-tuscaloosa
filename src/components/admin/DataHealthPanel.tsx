import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  AlertCircle, 
  CheckCircle, 
  RefreshCw, 
  Loader2,
  HeartPulse,
  Link,
  User,
  FileWarning,
  MoreVertical,
  Archive,
  EyeOff,
  Trash2,
  Wand2,
  CalendarPlus,
  Plus,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ALL_STAFF, SALES_ASSOCIATES, LEAD_SOURCES } from '@/types';
import { DateRange } from '@/lib/pay-period';
import { useAuth } from '@/context/AuthContext';
import { capitalizeName, getLocalDateString } from '@/lib/utils';
import { ClassTimeSelect } from '@/components/shared/FormHelpers';

interface DataHealthIssue {
  id: string;
  type: 'missing_booking_id' | 'missing_booked_by' | 'invalid_outcome' | 'unlinked_run';
  table: string;
  member_name: string;
  date: string;
  description: string;
  current_value?: string;
  ignore_from_metrics?: boolean;
}

interface DataHealthStats {
  firstIntroBookings: number;
  secondIntroBookings: number;
  runsInRange: number;
  runsMissingBookingId: number;
  bookingsMissingBookedBy: number;
  runsWithInvalidOutcome: number;
  closedBookings: number;
  archivedBookings: number;
  corruptedIntroOwner: number;
  missingIntroOwner: number;
}

interface DataHealthPanelProps {
  dateRange: DateRange | null;
  onFixComplete: () => void;
}

// Valid outcome values
const VALID_OUTCOMES = [
  'Closed',
  'Follow-up needed',
  'Booked 2nd intro',
  'No-show'
];

// Outcome normalization map
const OUTCOME_NORMALIZATION: Record<string, string> = {
  'no show': 'No-show',
  'noshow': 'No-show',
  'no-show': 'No-show',
  'closed': 'Closed',
  'follow-up needed': 'Follow-up needed',
  'follow up needed': 'Follow-up needed',
  'followup needed': 'Follow-up needed',
  'booked 2nd intro': 'Booked 2nd intro',
  'booked second intro': 'Booked 2nd intro',
};

export default function DataHealthPanel({ dateRange, onFixComplete }: DataHealthPanelProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<DataHealthStats | null>(null);
  const [issues, setIssues] = useState<DataHealthIssue[]>([]);
  const [selectedSaForBulk, setSelectedSaForBulk] = useState<string>('');
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set());
  const [isFixing, setIsFixing] = useState(false);
  
  // Hard delete dialog
  const [showHardDeleteDialog, setShowHardDeleteDialog] = useState(false);
  const [deletingIssue, setDeletingIssue] = useState<DataHealthIssue | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // Create matching booking dialog
  const [showCreateBookingDialog, setShowCreateBookingDialog] = useState(false);
  const [creatingBookingForIssue, setCreatingBookingForIssue] = useState<DataHealthIssue | null>(null);
  const [creatingBookingRunData, setCreatingBookingRunData] = useState<{
    member_name: string;
    run_date: string;
    class_time: string;
    lead_source: string;
    ran_by: string;
    intro_owner: string;
    run_id: string;
  } | null>(null);
  const [isSelfBooked, setIsSelfBooked] = useState(false);
  const [newBooking, setNewBooking] = useState({
    class_date: '',
    intro_time: '',
    coach_name: '',
    sa_working_shift: '',
    lead_source: '',
  });

  const fetchHealthData = async () => {
    setIsLoading(true);
    try {
      // Fetch all data
      const [bookingsRes, runsRes] = await Promise.all([
        supabase.from('intros_booked').select('*'),
        supabase.from('intros_run').select('*'),
      ]);

      const bookings = bookingsRes.data || [];
      const runs = runsRes.data || [];

      // Filter by date range if provided
      const filterByDate = (dateStr: string | null) => {
        if (!dateRange) return true;
        if (!dateStr) return false;
        const date = new Date(dateStr);
        return date >= dateRange.start && date <= dateRange.end;
      };

      // First intro bookings (no originating_booking_id)
      const firstIntroBookings = bookings.filter(b => {
        const originatingId = (b as any).originating_booking_id;
        const status = (b as any).booking_status;
        const isFirst = !originatingId || originatingId === null;
        const isActive = !status || status === 'Active' || status === 'No-show';
        return isFirst && isActive && filterByDate(b.class_date);
      });

      // Second intro bookings (has originating_booking_id)
      const secondIntroBookings = bookings.filter(b => {
        const originatingId = (b as any).originating_booking_id;
        const status = (b as any).booking_status;
        const isActive = !status || status === 'Active' || status === 'No-show';
        return originatingId && isActive && filterByDate(b.class_date);
      });

      // Closed bookings
      const closedBookings = bookings.filter(b => 
        (b as any).booking_status === 'Closed (Purchased)' ||
        (b as any).booking_status === 'Not interested'
      ).length;

      // Archived bookings
      const archivedBookings = bookings.filter(b => 
        (b as any).booking_status === 'Deleted (soft)'
      ).length;

      // Corrupted intro_owner (timestamp instead of staff name)
      const corruptedIntroOwner = bookings.filter(b => {
        const owner = b.intro_owner || '';
        return owner.includes('T') && owner.includes(':') && owner.includes('-');
      }).length;

      // Missing intro_owner on completed runs
      const completedRuns = runs.filter(r => 
        r.result && 
        r.result.toLowerCase() !== 'no-show' &&
        (r.ran_by || r.sa_name) &&
        !r.intro_owner
      );
      const missingIntroOwner = completedRuns.length;

      // Runs in range
      const runsInRange = runs.filter(r => filterByDate(r.run_date || r.created_at.split('T')[0]));

      // Issues detection
      const detectedIssues: DataHealthIssue[] = [];

      // Runs missing booking_id link (excluding ignored ones)
      const runsMissingLink = runsInRange.filter(r => 
        !r.linked_intro_booked_id && !(r as any).ignore_from_metrics
      );
      runsMissingLink.forEach(r => {
        detectedIssues.push({
          id: r.id,
          type: 'unlinked_run',
          table: 'intros_run',
          member_name: r.member_name,
          date: r.run_date || r.created_at.split('T')[0],
          description: 'Run not linked to booking',
          current_value: r.linked_intro_booked_id || 'none',
          ignore_from_metrics: (r as any).ignore_from_metrics,
        });
      });

      // Bookings missing booked_by (sa_working_shift = TBD or Unknown or blank)
      const bookingsMissingBookedBy = firstIntroBookings.filter(b => {
        const bookedBy = b.sa_working_shift || '';
        return !bookedBy || bookedBy === 'TBD' || bookedBy === 'Unknown';
      });
      bookingsMissingBookedBy.forEach(b => {
        detectedIssues.push({
          id: b.id,
          type: 'missing_booked_by',
          table: 'intros_booked',
          member_name: b.member_name,
          date: b.class_date,
          description: 'Missing booked_by SA',
          current_value: b.sa_working_shift || 'blank',
        });
      });

      // Runs with invalid outcome
      const runsWithInvalidOutcome = runsInRange.filter(r => {
        if (!r.result) return true; // Blank is invalid
        const normalized = r.result.toLowerCase().trim();
        // Check if it's a known valid outcome
        const isValid = VALID_OUTCOMES.some(vo => vo.toLowerCase() === normalized) ||
                       Object.keys(OUTCOME_NORMALIZATION).includes(normalized) ||
                       r.result.toLowerCase().includes('premier') ||
                       r.result.toLowerCase().includes('elite') ||
                       r.result.toLowerCase().includes('basic');
        return !isValid;
      });
      runsWithInvalidOutcome.forEach(r => {
        detectedIssues.push({
          id: r.id,
          type: 'invalid_outcome',
          table: 'intros_run',
          member_name: r.member_name,
          date: r.run_date || r.created_at.split('T')[0],
          description: 'Invalid outcome value',
          current_value: r.result || 'blank',
        });
      });

      setStats({
        firstIntroBookings: firstIntroBookings.length,
        secondIntroBookings: secondIntroBookings.length,
        runsInRange: runsInRange.length,
        runsMissingBookingId: runsMissingLink.length,
        bookingsMissingBookedBy: bookingsMissingBookedBy.length,
        runsWithInvalidOutcome: runsWithInvalidOutcome.length,
        closedBookings,
        archivedBookings,
        corruptedIntroOwner,
        missingIntroOwner,
      });

      setIssues(detectedIssues.slice(0, 25));
    } catch (error) {
      console.error('Error fetching health data:', error);
      toast.error('Failed to fetch data health');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, [dateRange]);

  const handleFixBookedBy = async (issueId: string, saName: string) => {
    setIsFixing(true);
    try {
      const { error } = await supabase
        .from('intros_booked')
        .update({ 
          sa_working_shift: saName,
          last_edited_at: new Date().toISOString(),
          last_edited_by: user?.name || 'Admin',
          edit_reason: 'Fixed missing booked_by',
        })
        .eq('id', issueId);

      if (error) throw error;
      
      toast.success(`Updated booked_by to ${saName}`);
      await fetchHealthData();
      onFixComplete();
    } catch (error) {
      console.error('Error fixing booked_by:', error);
      toast.error('Failed to fix booked_by');
    } finally {
      setIsFixing(false);
    }
  };

  const handleBulkFixBookedBy = async () => {
    if (!selectedSaForBulk || selectedIssues.size === 0) return;
    
    setIsFixing(true);
    try {
      const issueIds = Array.from(selectedIssues).filter(id => {
        const issue = issues.find(i => i.id === id);
        return issue?.type === 'missing_booked_by';
      });

      if (issueIds.length === 0) {
        toast.error('No booked_by issues selected');
        return;
      }

      const { error } = await supabase
        .from('intros_booked')
        .update({ 
          sa_working_shift: selectedSaForBulk,
          last_edited_at: new Date().toISOString(),
          last_edited_by: user?.name || 'Admin',
          edit_reason: 'Bulk fixed missing booked_by',
        })
        .in('id', issueIds);

      if (error) throw error;
      
      toast.success(`Updated ${issueIds.length} bookings to ${selectedSaForBulk}`);
      setSelectedIssues(new Set());
      await fetchHealthData();
      onFixComplete();
    } catch (error) {
      console.error('Error bulk fixing booked_by:', error);
      toast.error('Failed to bulk fix');
    } finally {
      setIsFixing(false);
    }
  };

  const handleNormalizeOutcome = async (issueId: string, outcome: string) => {
    setIsFixing(true);
    try {
      const normalized = OUTCOME_NORMALIZATION[outcome.toLowerCase()] || 'Follow-up needed';
      
      const { error } = await supabase
        .from('intros_run')
        .update({ 
          result: normalized,
          last_edited_at: new Date().toISOString(),
          last_edited_by: user?.name || 'Admin',
          edit_reason: 'Normalized invalid outcome',
        })
        .eq('id', issueId);

      if (error) throw error;
      
      toast.success(`Normalized outcome to "${normalized}"`);
      await fetchHealthData();
      onFixComplete();
    } catch (error) {
      console.error('Error normalizing outcome:', error);
      toast.error('Failed to normalize outcome');
    } finally {
      setIsFixing(false);
    }
  };

  const handleAutoLinkRun = async (issueId: string) => {
    setIsFixing(true);
    try {
      // Get the run details
      const { data: run } = await supabase
        .from('intros_run')
        .select('*')
        .eq('id', issueId)
        .single();

      if (!run) throw new Error('Run not found');

      // Find matching booking by member name and date (only Active bookings)
      const { data: bookings } = await supabase
        .from('intros_booked')
        .select('*')
        .eq('member_name', run.member_name);

      // Filter to active bookings only
      const activeBookings = (bookings || []).filter(b => {
        const status = (b as any).booking_status;
        return !status || status === 'Active' || status === 'No-show';
      });

      if (activeBookings.length === 0) {
        toast.error('No matching active booking found for this member');
        return;
      }

      // Try to find exact date match
      let bestMatch = activeBookings.find(b => b.class_date === run.run_date);
      
      // If no exact match, find closest date
      if (!bestMatch && run.run_date) {
        const runDate = new Date(run.run_date).getTime();
        bestMatch = activeBookings.reduce((closest, b) => {
          const bDate = new Date(b.class_date).getTime();
          const closestDate = closest ? new Date(closest.class_date).getTime() : Infinity;
          return Math.abs(bDate - runDate) < Math.abs(closestDate - runDate) ? b : closest;
        }, null as typeof activeBookings[0] | null);
      }

      if (!bestMatch) {
        bestMatch = activeBookings[0]; // Just use first booking if nothing else matches
      }

      const { error } = await supabase
        .from('intros_run')
        .update({ 
          linked_intro_booked_id: bestMatch.id,
          last_edited_at: new Date().toISOString(),
          last_edited_by: user?.name || 'Admin',
          edit_reason: 'Auto-linked to booking',
        })
        .eq('id', issueId);

      if (error) throw error;
      
      toast.success(`Linked run to booking for ${run.member_name}`);
      await fetchHealthData();
      onFixComplete();
    } catch (error) {
      console.error('Error auto-linking run:', error);
      toast.error('Failed to auto-link run');
    } finally {
      setIsFixing(false);
    }
  };

  // Ignore from metrics toggle
  const handleIgnoreFromMetrics = async (issue: DataHealthIssue) => {
    setIsFixing(true);
    try {
      const table = issue.table === 'intros_run' ? 'intros_run' : 'intros_booked';
      const { error } = await supabase
        .from(table)
        .update({ 
          ignore_from_metrics: true,
          last_edited_at: new Date().toISOString(),
          last_edited_by: user?.name || 'Admin',
          edit_reason: 'Ignored from metrics by admin',
        })
        .eq('id', issue.id);

      if (error) throw error;
      
      toast.success('Ignored from metrics');
      await fetchHealthData();
    } catch (error) {
      console.error('Error ignoring from metrics:', error);
      toast.error('Failed to ignore');
    } finally {
      setIsFixing(false);
    }
  };

  // Soft delete
  const handleSoftDelete = async (issue: DataHealthIssue) => {
    setIsFixing(true);
    try {
      if (issue.table === 'intros_booked') {
        const { error } = await supabase
          .from('intros_booked')
          .update({ 
            booking_status: 'Deleted (soft)',
            last_edited_at: new Date().toISOString(),
            last_edited_by: user?.name || 'Admin',
            edit_reason: 'Soft deleted by admin',
          })
          .eq('id', issue.id);
        if (error) throw error;
      } else {
        // For runs, we'll just ignore from metrics (no soft delete status)
        const { error } = await supabase
          .from('intros_run')
          .update({ 
            ignore_from_metrics: true,
            last_edited_at: new Date().toISOString(),
            last_edited_by: user?.name || 'Admin',
            edit_reason: 'Soft deleted (ignored) by admin',
          })
          .eq('id', issue.id);
        if (error) throw error;
      }
      
      toast.success('Archived successfully');
      await fetchHealthData();
    } catch (error) {
      console.error('Error soft deleting:', error);
      toast.error('Failed to archive');
    } finally {
      setIsFixing(false);
    }
  };

  // Hard delete
  const handleOpenHardDelete = (issue: DataHealthIssue) => {
    setDeletingIssue(issue);
    setDeleteConfirmText('');
    setShowHardDeleteDialog(true);
  };

  const handleConfirmHardDelete = async () => {
    if (!deletingIssue || deleteConfirmText !== 'DELETE') return;
    
    setIsFixing(true);
    try {
      const table = deletingIssue.table === 'intros_run' ? 'intros_run' : 'intros_booked';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', deletingIssue.id);

      if (error) throw error;
      
      toast.success('Permanently deleted');
      setShowHardDeleteDialog(false);
      setDeletingIssue(null);
      await fetchHealthData();
    } catch (error) {
      console.error('Error hard deleting:', error);
      toast.error('Failed to delete');
    } finally {
      setIsFixing(false);
    }
  };

  // Handle opening create matching booking dialog for unlinked runs
  const handleOpenCreateMatchingBooking = async (issue: DataHealthIssue) => {
    if (issue.type !== 'unlinked_run') return;
    
    // Fetch the full run data
    const { data: run } = await supabase
      .from('intros_run')
      .select('*')
      .eq('id', issue.id)
      .single();
    
    if (!run) {
      toast.error('Could not load run data');
      return;
    }
    
    setCreatingBookingForIssue(issue);
    setCreatingBookingRunData({
      member_name: run.member_name,
      run_date: run.run_date || run.created_at?.split('T')[0] || '',
      class_time: run.class_time || '',
      lead_source: run.lead_source || '',
      ran_by: run.ran_by || run.sa_name || '',
      intro_owner: run.intro_owner || run.ran_by || run.sa_name || '',
      run_id: run.id,
    });
    
    // Check if lead source indicates self-booked
    const isSelfBookedSource = run.lead_source === 'Online Intro Offer (self-booked)';
    setIsSelfBooked(isSelfBookedSource);
    
    setNewBooking({
      class_date: run.run_date || run.created_at?.split('T')[0] || getLocalDateString(),
      intro_time: run.class_time || '',
      coach_name: '',
      sa_working_shift: '',
      lead_source: run.lead_source || '',
    });
    
    setShowCreateBookingDialog(true);
  };

  const handleCreateMatchingBooking = async () => {
    if (!creatingBookingRunData || !creatingBookingForIssue) return;
    
    if (!isSelfBooked && !newBooking.sa_working_shift) {
      toast.error('Booked By is required when not self-booked');
      return;
    }
    
    setIsFixing(true);
    try {
      const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const bookedBy = isSelfBooked ? 'Self-booked' : newBooking.sa_working_shift;
      const leadSource = isSelfBooked ? 'Online Intro Offer (self-booked)' : (newBooking.lead_source || creatingBookingRunData.lead_source || 'Source Not Found');
      const introOwner = creatingBookingRunData.intro_owner || creatingBookingRunData.ran_by || null;
      
      const { data: insertedBooking, error } = await supabase
        .from('intros_booked')
        .insert({
          booking_id: bookingId,
          member_name: creatingBookingRunData.member_name,
          class_date: newBooking.class_date,
          intro_time: newBooking.intro_time || null,
          coach_name: newBooking.coach_name || 'TBD',
          sa_working_shift: bookedBy,
          booked_by: bookedBy,
          lead_source: leadSource,
          booking_status: 'Active',
          intro_owner: introOwner,
          intro_owner_locked: !!introOwner,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Link the run to this new booking
      if (insertedBooking) {
        const { error: linkError } = await supabase
          .from('intros_run')
          .update({
            linked_intro_booked_id: insertedBooking.id,
            last_edited_at: new Date().toISOString(),
            last_edited_by: user?.name || 'Admin',
            edit_reason: 'Linked to newly created matching booking',
          })
          .eq('id', creatingBookingRunData.run_id);
          
        if (linkError) {
          console.error('Error linking run to booking:', linkError);
          toast.error('Booking created but failed to link run');
        } else {
          toast.success('Booking created and linked to run');
        }
      }
      
      setShowCreateBookingDialog(false);
      setCreatingBookingForIssue(null);
      setCreatingBookingRunData(null);
      await fetchHealthData();
      onFixComplete();
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error('Failed to create booking');
    } finally {
      setIsFixing(false);
    }
  };

  const toggleIssueSelection = (id: string) => {
    const newSelection = new Set(selectedIssues);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIssues(newSelection);
  };

  // Auto-fix attribution for runs and bookings
  const handleAutoFixAttribution = async () => {
    setIsFixing(true);
    let fixedCount = 0;
    
    try {
      // 1. Clear corrupted intro_owner on bookings (timestamps instead of names)
      const { data: corruptedBookings } = await supabase
        .from('intros_booked')
        .select('id, intro_owner')
        .not('intro_owner', 'is', null);
      
      const bookingsToFix = (corruptedBookings || []).filter(b => {
        const owner = b.intro_owner || '';
        return owner.includes('T') && owner.includes(':') && owner.includes('-');
      });

      for (const booking of bookingsToFix) {
        await supabase
          .from('intros_booked')
          .update({ 
            intro_owner: null, 
            intro_owner_locked: false,
            last_edited_at: new Date().toISOString(),
            last_edited_by: user?.name || 'Admin',
            edit_reason: 'Auto-fix: cleared corrupted intro_owner',
          })
          .eq('id', booking.id);
        fixedCount++;
      }

      // 2. Set intro_owner on runs that have ran_by/sa_name but no intro_owner
      const { data: runsWithoutOwner } = await supabase
        .from('intros_run')
        .select('id, ran_by, sa_name, intro_owner, linked_intro_booked_id, result');
      
      const runsToFix = (runsWithoutOwner || []).filter(r => 
        !r.intro_owner && 
        (r.ran_by || r.sa_name) &&
        r.result && r.result.toLowerCase() !== 'no-show'
      );

      for (const run of runsToFix) {
        const newOwner = run.ran_by || run.sa_name;
        
        // Update the run
        await supabase
          .from('intros_run')
          .update({ 
            intro_owner: newOwner,
            intro_owner_locked: true,
            last_edited_at: new Date().toISOString(),
            last_edited_by: user?.name || 'Admin',
            edit_reason: 'Auto-fix: set intro_owner from ran_by/sa_name',
          })
          .eq('id', run.id);
        
        // If linked to a booking, update the booking too
        if (run.linked_intro_booked_id) {
          const { data: booking } = await supabase
            .from('intros_booked')
            .select('id, intro_owner, intro_owner_locked')
            .eq('id', run.linked_intro_booked_id)
            .single();
          
          if (booking && (!booking.intro_owner || !booking.intro_owner_locked)) {
            await supabase
              .from('intros_booked')
              .update({ 
                intro_owner: newOwner,
                intro_owner_locked: true,
                last_edited_at: new Date().toISOString(),
                last_edited_by: user?.name || 'Admin',
                edit_reason: 'Auto-fix: set intro_owner from linked run',
              })
              .eq('id', run.linked_intro_booked_id);
          }
        }
        
        fixedCount++;
      }

      // 3. Set intro_owner on bookings from their first non-no-show run
      const { data: bookingsWithoutOwner } = await supabase
        .from('intros_booked')
        .select('id, intro_owner, intro_owner_locked');
      
      const bookingsNeedingOwner = (bookingsWithoutOwner || []).filter(b => 
        !b.intro_owner && !b.intro_owner_locked
      );

      for (const booking of bookingsNeedingOwner) {
        // Find linked runs
        const { data: linkedRuns } = await supabase
          .from('intros_run')
          .select('id, ran_by, sa_name, result, created_at')
          .eq('linked_intro_booked_id', booking.id)
          .order('created_at', { ascending: true });
        
        // Find first non-no-show run with a ran_by
        const firstValidRun = (linkedRuns || []).find(r => 
          r.result && r.result.toLowerCase() !== 'no-show' && (r.ran_by || r.sa_name)
        );
        
        if (firstValidRun) {
          const newOwner = firstValidRun.ran_by || firstValidRun.sa_name;
          await supabase
            .from('intros_booked')
            .update({ 
              intro_owner: newOwner,
              intro_owner_locked: true,
              last_edited_at: new Date().toISOString(),
              last_edited_by: user?.name || 'Admin',
              edit_reason: 'Auto-fix: set intro_owner from first valid run',
            })
            .eq('id', booking.id);
          fixedCount++;
        }
      }

      toast.success(`Fixed ${fixedCount} attribution issues`);
      await fetchHealthData();
      onFixComplete();
    } catch (error) {
      console.error('Error auto-fixing attribution:', error);
      toast.error('Failed to auto-fix attribution');
    } finally {
      setIsFixing(false);
    }
  };

  const bookedByIssues = issues.filter(i => i.type === 'missing_booked_by');
  const hasHealthIssues = stats && (
    stats.runsMissingBookingId > 0 || 
    stats.bookingsMissingBookedBy > 0 || 
    stats.runsWithInvalidOutcome > 0
  );
  const hasAttributionIssues = stats && (
    stats.corruptedIntroOwner > 0 || 
    stats.missingIntroOwner > 0
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-primary" />
            Data Health Check
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchHealthData}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">{stats.firstIntroBookings}</p>
              <p className="text-xs text-muted-foreground">Active 1st Intros</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">{stats.secondIntroBookings}</p>
              <p className="text-xs text-muted-foreground">2nd Intros</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">{stats.runsInRange}</p>
              <p className="text-xs text-muted-foreground">Runs</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-muted-foreground">{stats.closedBookings}</p>
              <p className="text-xs text-muted-foreground">Closed</p>
            </div>
          </div>
        )}

        {/* Health Status */}
        {stats && (
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
              <div className="flex items-center gap-2">
                <Link className="w-4 h-4" />
                <span className="text-sm">Runs missing booking link</span>
              </div>
              <Badge variant={stats.runsMissingBookingId > 0 ? 'destructive' : 'default'}>
                {stats.runsMissingBookingId}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span className="text-sm">Bookings missing booked_by</span>
              </div>
              <Badge variant={stats.bookingsMissingBookedBy > 0 ? 'destructive' : 'default'}>
                {stats.bookingsMissingBookedBy}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
              <div className="flex items-center gap-2">
                <FileWarning className="w-4 h-4" />
                <span className="text-sm">Runs with invalid outcome</span>
              </div>
              <Badge variant={stats.runsWithInvalidOutcome > 0 ? 'destructive' : 'default'}>
                {stats.runsWithInvalidOutcome}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4" />
                <span className="text-sm">Corrupted intro_owner (timestamps)</span>
              </div>
              <Badge variant={stats.corruptedIntroOwner > 0 ? 'destructive' : 'default'}>
                {stats.corruptedIntroOwner}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span className="text-sm">Runs missing intro_owner</span>
              </div>
              <Badge variant={stats.missingIntroOwner > 0 ? 'destructive' : 'default'}>
                {stats.missingIntroOwner}
              </Badge>
            </div>
          </div>
        )}

        {/* Auto-Fix Attribution Button */}
        {hasAttributionIssues && (
          <div className="p-3 border border-primary/20 rounded-lg bg-primary/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-Fix Attribution</p>
                <p className="text-xs text-muted-foreground">
                  Automatically fixes {(stats?.corruptedIntroOwner || 0) + (stats?.missingIntroOwner || 0)} issues
                </p>
              </div>
              <Button 
                onClick={handleAutoFixAttribution}
                disabled={isFixing}
                size="sm"
                className="gap-1"
              >
                {isFixing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Fix All
              </Button>
            </div>
          </div>
        )}

        {/* Overall Status */}
        {stats && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${hasHealthIssues ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
            {hasHealthIssues ? (
              <>
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Issues found - review below</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">All data looks healthy!</span>
              </>
            )}
          </div>
        )}

        {/* Bulk Fix Tool for booked_by */}
        {bookedByIssues.length > 0 && (
          <div className="p-3 border rounded-lg space-y-3">
            <p className="text-sm font-medium">Bulk Assign booked_by</p>
            <div className="flex gap-2">
              <Select value={selectedSaForBulk} onValueChange={setSelectedSaForBulk}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select SA..." />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STAFF.map(sa => (
                    <SelectItem key={sa} value={sa}>{sa}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleBulkFixBookedBy}
                disabled={!selectedSaForBulk || selectedIssues.size === 0 || isFixing}
                size="sm"
              >
                {isFixing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Select issues below, then apply to update all selected
            </p>
          </div>
        )}

        {/* Issues List */}
        {issues.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Problem Rows (first 25)</p>
            <ScrollArea className="h-64">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <input 
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIssues(new Set(issues.map(i => i.id)));
                          } else {
                            setSelectedIssues(new Set());
                          }
                        }}
                        checked={selectedIssues.size === issues.length}
                      />
                    </TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Member</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Fix</TableHead>
                    <TableHead className="text-xs w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.map((issue) => (
                    <TableRow key={issue.id}>
                      <TableCell>
                        <input 
                          type="checkbox"
                          checked={selectedIssues.has(issue.id)}
                          onChange={() => toggleIssueSelection(issue.id)}
                        />
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-xs">
                          {issue.type === 'missing_booked_by' && 'No SA'}
                          {issue.type === 'unlinked_run' && 'Unlinked'}
                          {issue.type === 'invalid_outcome' && 'Bad Result'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {issue.member_name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {issue.date}
                      </TableCell>
                      <TableCell>
                        {issue.type === 'missing_booked_by' && (
                          <Select onValueChange={(sa) => handleFixBookedBy(issue.id, sa)}>
                            <SelectTrigger className="h-7 text-xs w-24">
                              <SelectValue placeholder="Fix..." />
                            </SelectTrigger>
                            <SelectContent>
                              {ALL_STAFF.map(sa => (
                                <SelectItem key={sa} value={sa}>{sa}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {issue.type === 'unlinked_run' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleAutoLinkRun(issue.id)}
                            disabled={isFixing}
                          >
                            Auto-link
                          </Button>
                        )}
                        {issue.type === 'invalid_outcome' && (
                          <Select onValueChange={(val) => handleNormalizeOutcome(issue.id, val)}>
                            <SelectTrigger className="h-7 text-xs w-28">
                              <SelectValue placeholder="Set..." />
                            </SelectTrigger>
                            <SelectContent>
                              {VALID_OUTCOMES.map(o => (
                                <SelectItem key={o} value={o}>{o}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {issue.type === 'unlinked_run' && (
                              <>
                                <DropdownMenuItem onClick={() => handleOpenCreateMatchingBooking(issue)}>
                                  <CalendarPlus className="w-4 h-4 mr-2" />
                                  Create Matching Booking
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem onClick={() => handleIgnoreFromMetrics(issue)}>
                              <EyeOff className="w-4 h-4 mr-2" />
                              Ignore from metrics
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSoftDelete(issue)}>
                              <Archive className="w-4 h-4 mr-2" />
                              Archive (soft delete)
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleOpenHardDelete(issue)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete permanently
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {/* Hard Delete Confirm Dialog */}
        <Dialog open={showHardDeleteDialog} onOpenChange={setShowHardDeleteDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-destructive">Permanently Delete</DialogTitle>
              <DialogDescription>
                This will permanently delete {deletingIssue?.member_name}'s record. 
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Type DELETE to confirm</Label>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowHardDeleteDialog(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleConfirmHardDelete} 
                disabled={deleteConfirmText !== 'DELETE' || isFixing}
              >
                {isFixing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                Delete Forever
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Matching Booking Dialog */}
        <Dialog open={showCreateBookingDialog} onOpenChange={(open) => {
          setShowCreateBookingDialog(open);
          if (!open) {
            setCreatingBookingForIssue(null);
            setCreatingBookingRunData(null);
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Matching Booking</DialogTitle>
              <DialogDescription>
                Create a booking record to match the unlinked intro run for {creatingBookingRunData?.member_name}. 
                The booking will be automatically linked to this run.
              </DialogDescription>
            </DialogHeader>
            
            {/* Show run info */}
            {creatingBookingRunData && (
              <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
                <div className="font-medium text-sm">Auto-populated from run:</div>
                <div>Member: {creatingBookingRunData.member_name}</div>
                <div>Run Date: {creatingBookingRunData.run_date}</div>
                <div>Time: {creatingBookingRunData.class_time}</div>
                <div>Lead Source: {creatingBookingRunData.lead_source || 'Not set'}</div>
                <div>Ran By: {capitalizeName(creatingBookingRunData.ran_by)}</div>
              </div>
            )}
            
            <div className="space-y-3">
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
                  <ClassTimeSelect
                    value={newBooking.intro_time}
                    onValueChange={(v) => setNewBooking({...newBooking, intro_time: v})}
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
                    <Label className="text-xs">Lead Source (from run)</Label>
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
                setCreatingBookingForIssue(null);
                setCreatingBookingRunData(null);
              }}>Cancel</Button>
              <Button onClick={handleCreateMatchingBooking} disabled={isFixing}>
                {isFixing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                Create & Link
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
