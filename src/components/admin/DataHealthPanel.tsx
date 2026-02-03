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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  AlertCircle, 
  CheckCircle, 
  RefreshCw, 
  Loader2,
  HeartPulse,
  Link,
  User,
  FileWarning
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ALL_STAFF } from '@/types';
import { DateRange } from '@/lib/pay-period';

interface DataHealthIssue {
  id: string;
  type: 'missing_booking_id' | 'missing_booked_by' | 'invalid_outcome' | 'unlinked_run';
  table: string;
  member_name: string;
  date: string;
  description: string;
  current_value?: string;
}

interface DataHealthStats {
  firstIntroBookings: number;
  secondIntroBookings: number;
  runsInRange: number;
  runsMissingBookingId: number;
  bookingsMissingBookedBy: number;
  runsWithInvalidOutcome: number;
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
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<DataHealthStats | null>(null);
  const [issues, setIssues] = useState<DataHealthIssue[]>([]);
  const [selectedSaForBulk, setSelectedSaForBulk] = useState<string>('');
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set());
  const [isFixing, setIsFixing] = useState(false);

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
        const isFirst = !originatingId || originatingId === null;
        return isFirst && filterByDate(b.class_date);
      });

      // Second intro bookings (has originating_booking_id)
      const secondIntroBookings = bookings.filter(b => {
        const originatingId = (b as any).originating_booking_id;
        return originatingId && filterByDate(b.class_date);
      });

      // Runs in range
      const runsInRange = runs.filter(r => filterByDate(r.run_date || r.created_at.split('T')[0]));

      // Issues detection
      const detectedIssues: DataHealthIssue[] = [];

      // Runs missing booking_id link
      const runsMissingLink = runsInRange.filter(r => !r.linked_intro_booked_id);
      runsMissingLink.forEach(r => {
        detectedIssues.push({
          id: r.id,
          type: 'unlinked_run',
          table: 'intros_run',
          member_name: r.member_name,
          date: r.run_date || r.created_at.split('T')[0],
          description: 'Run not linked to booking',
          current_value: r.linked_intro_booked_id || 'none',
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
        .update({ sa_working_shift: saName })
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
        .update({ sa_working_shift: selectedSaForBulk })
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
        .update({ result: normalized })
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

      // Find matching booking by member name and date
      const { data: bookings } = await supabase
        .from('intros_booked')
        .select('*')
        .eq('member_name', run.member_name);

      if (!bookings || bookings.length === 0) {
        toast.error('No matching booking found for this member');
        return;
      }

      // Try to find exact date match
      let bestMatch = bookings.find(b => b.class_date === run.run_date);
      
      // If no exact match, find closest date
      if (!bestMatch && run.run_date) {
        const runDate = new Date(run.run_date).getTime();
        bestMatch = bookings.reduce((closest, b) => {
          const bDate = new Date(b.class_date).getTime();
          const closestDate = closest ? new Date(closest.class_date).getTime() : Infinity;
          return Math.abs(bDate - runDate) < Math.abs(closestDate - runDate) ? b : closest;
        }, null as typeof bookings[0] | null);
      }

      if (!bestMatch) {
        bestMatch = bookings[0]; // Just use first booking if nothing else matches
      }

      const { error } = await supabase
        .from('intros_run')
        .update({ linked_intro_booked_id: bestMatch.id })
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

  const toggleIssueSelection = (id: string) => {
    const newSelection = new Set(selectedIssues);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIssues(newSelection);
  };

  const bookedByIssues = issues.filter(i => i.type === 'missing_booked_by');
  const hasHealthIssues = stats && (
    stats.runsMissingBookingId > 0 || 
    stats.bookingsMissingBookedBy > 0 || 
    stats.runsWithInvalidOutcome > 0
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
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">{stats.firstIntroBookings}</p>
              <p className="text-xs text-muted-foreground">First Intro Bookings</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">{stats.secondIntroBookings}</p>
              <p className="text-xs text-muted-foreground">Second Intros</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">{stats.runsInRange}</p>
              <p className="text-xs text-muted-foreground">Runs in Range</p>
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
          </div>
        )}

        {/* Overall Status */}
        {stats && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${hasHealthIssues ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
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
                    <TableHead className="text-xs">Action</TableHead>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
