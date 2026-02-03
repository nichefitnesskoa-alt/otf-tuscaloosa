import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Edit, 
  Save, 
  X, 
  RefreshCw, 
  Loader2,
  PlayCircle,
  Search,
  Filter,
  Link,
  LinkIcon
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ALL_STAFF } from '@/types';
import { useAuth } from '@/context/AuthContext';

interface IntroRun {
  id: string;
  run_id: string | null;
  member_name: string;
  run_date: string | null;
  class_time: string;
  lead_source: string | null;
  intro_owner: string | null;
  result: string;
  goal_quality: string | null;
  pricing_engagement: string | null;
  linked_intro_booked_id: string | null;
  sheets_row_number: number | null;
  last_edited_at: string | null;
  last_edited_by: string | null;
  edit_reason: string | null;
}

interface IntroBooking {
  id: string;
  booking_id: string | null;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  sa_working_shift: string;
}

// Valid outcomes
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

export default function IntroRunsEditor() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<IntroRun[]>([]);
  const [bookings, setBookings] = useState<IntroBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUnlinked, setFilterUnlinked] = useState(false);
  const [filterInvalidOutcome, setFilterInvalidOutcome] = useState(false);
  
  const [editingRun, setEditingRun] = useState<IntroRun | null>(null);
  const [editReason, setEditReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkingRun, setLinkingRun] = useState<IntroRun | null>(null);
  const [matchingBookings, setMatchingBookings] = useState<IntroBooking[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [runsRes, bookingsRes] = await Promise.all([
        supabase.from('intros_run').select('*').order('run_date', { ascending: false }).limit(500),
        supabase.from('intros_booked').select('id, booking_id, member_name, class_date, intro_time, sa_working_shift'),
      ]);

      if (runsRes.error) throw runsRes.error;
      if (bookingsRes.error) throw bookingsRes.error;
      
      setRuns(runsRes.data || []);
      setBookings(bookingsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const isValidOutcome = (result: string) => {
    if (!result) return false;
    const lower = result.toLowerCase().trim();
    return VALID_OUTCOMES.some(o => o.toLowerCase() === lower) ||
           Object.keys(OUTCOME_NORMALIZATION).includes(lower) ||
           lower.includes('premier') ||
           lower.includes('elite') ||
           lower.includes('basic');
  };

  const normalizeOutcome = (result: string): string => {
    if (!result) return 'Follow-up needed';
    const lower = result.toLowerCase().trim();
    if (OUTCOME_NORMALIZATION[lower]) return OUTCOME_NORMALIZATION[lower];
    return result;
  };

  const filteredRuns = useMemo(() => {
    let filtered = runs;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r => 
        r.member_name.toLowerCase().includes(term) ||
        r.run_id?.toLowerCase().includes(term)
      );
    }
    
    if (filterUnlinked) {
      filtered = filtered.filter(r => !r.linked_intro_booked_id);
    }
    
    if (filterInvalidOutcome) {
      filtered = filtered.filter(r => !isValidOutcome(r.result));
    }
    
    return filtered;
  }, [runs, searchTerm, filterUnlinked, filterInvalidOutcome]);

  const handleEdit = (run: IntroRun) => {
    setEditingRun({ ...run });
    setEditReason('');
  };

  const handleSave = async () => {
    if (!editingRun) return;
    
    setIsSaving(true);
    try {
      // Normalize outcome on save
      const normalizedResult = normalizeOutcome(editingRun.result);
      
      const updateData = {
        member_name: editingRun.member_name,
        run_date: editingRun.run_date,
        class_time: editingRun.class_time,
        lead_source: editingRun.lead_source,
        intro_owner: editingRun.intro_owner,
        result: normalizedResult,
        goal_quality: editingRun.goal_quality,
        pricing_engagement: editingRun.pricing_engagement,
        linked_intro_booked_id: editingRun.linked_intro_booked_id,
        last_edited_at: new Date().toISOString(),
        last_edited_by: user?.name || 'Admin',
        edit_reason: editReason || 'Admin edit',
      };

      const { error } = await supabase
        .from('intros_run')
        .update(updateData)
        .eq('id', editingRun.id);

      if (error) throw error;
      
      toast.success('Run updated successfully');
      setEditingRun(null);
      await fetchData();
    } catch (error) {
      console.error('Error saving run:', error);
      toast.error('Failed to save run');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenLinkDialog = (run: IntroRun) => {
    setLinkingRun(run);
    
    // Find matching bookings by member name
    const matches = bookings.filter(b => {
      const nameMatch = b.member_name.toLowerCase() === run.member_name.toLowerCase();
      if (!nameMatch) return false;
      
      // Also check for date proximity (+/- 1 day)
      if (run.run_date && b.class_date) {
        const runDate = new Date(run.run_date);
        const bookingDate = new Date(b.class_date);
        const dayDiff = Math.abs((runDate.getTime() - bookingDate.getTime()) / (1000 * 60 * 60 * 24));
        return dayDiff <= 1;
      }
      return true;
    });
    
    // If no close matches, show all for this member
    if (matches.length === 0) {
      setMatchingBookings(bookings.filter(b => 
        b.member_name.toLowerCase() === run.member_name.toLowerCase()
      ));
    } else {
      setMatchingBookings(matches);
    }
    
    setShowLinkDialog(true);
  };

  const handleLinkToBooking = async (bookingId: string) => {
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

  const handleAutoLink = async (run: IntroRun) => {
    setIsSaving(true);
    try {
      // Find best matching booking
      const exactMatch = bookings.find(b => 
        b.member_name.toLowerCase() === run.member_name.toLowerCase() &&
        b.class_date === run.run_date
      );
      
      if (exactMatch) {
        const { error } = await supabase
          .from('intros_run')
          .update({
            linked_intro_booked_id: exactMatch.id,
            last_edited_at: new Date().toISOString(),
            last_edited_by: user?.name || 'Admin',
            edit_reason: 'Auto-linked by name+date match',
          })
          .eq('id', run.id);

        if (error) throw error;
        toast.success(`Linked to booking for ${run.member_name}`);
        await fetchData();
      } else {
        // Show link dialog for manual selection
        handleOpenLinkDialog(run);
      }
    } catch (error) {
      console.error('Error auto-linking:', error);
      toast.error('Failed to auto-link');
    } finally {
      setIsSaving(false);
    }
  };

  const unlinkedCount = runs.filter(r => !r.linked_intro_booked_id).length;
  const invalidOutcomeCount = runs.filter(r => !isValidOutcome(r.result)).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <PlayCircle className="w-4 h-4" />
            Intro Runs Editor
            <Badge variant="outline" className="ml-2">{runs.length} total</Badge>
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchData}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by member name or run ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button
            variant={filterUnlinked ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterUnlinked(!filterUnlinked)}
            className="gap-1"
          >
            <Link className="w-4 h-4" />
            Unlinked ({unlinkedCount})
          </Button>
          <Button
            variant={filterInvalidOutcome ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterInvalidOutcome(!filterInvalidOutcome)}
            className="gap-1"
          >
            <Filter className="w-4 h-4" />
            Invalid Outcome ({invalidOutcomeCount})
          </Button>
        </div>

        {/* Table */}
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Member</TableHead>
                <TableHead className="text-xs">Run Date</TableHead>
                <TableHead className="text-xs">Outcome</TableHead>
                <TableHead className="text-xs">Linked</TableHead>
                <TableHead className="text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRuns.map((run) => (
                <TableRow 
                  key={run.id}
                  className={!run.linked_intro_booked_id ? 'bg-destructive/5' : ''}
                >
                  <TableCell className="text-sm font-medium">
                    {run.member_name}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {run.run_date || '-'}
                  </TableCell>
                  <TableCell>
                    {!isValidOutcome(run.result) ? (
                      <Badge variant="destructive" className="text-xs">
                        {run.result || 'Missing'}
                      </Badge>
                    ) : (
                      <span className="text-xs">{run.result}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {run.linked_intro_booked_id ? (
                      <Badge variant="default" className="text-xs">
                        <LinkIcon className="w-3 h-3 mr-1" />
                        Linked
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-destructive">
                        Not linked
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleEdit(run)}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      {!run.linked_intro_booked_id && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => handleAutoLink(run)}
                          disabled={isSaving}
                        >
                          <Link className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Edit Dialog */}
        <Dialog open={!!editingRun} onOpenChange={() => setEditingRun(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Intro Run</DialogTitle>
              <DialogDescription>
                Update run details. Changes will be synced to Google Sheets.
              </DialogDescription>
            </DialogHeader>
            {editingRun && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Member Name</Label>
                  <Input
                    value={editingRun.member_name}
                    onChange={(e) => setEditingRun({...editingRun, member_name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Run Date</Label>
                    <Input
                      type="date"
                      value={editingRun.run_date || ''}
                      onChange={(e) => setEditingRun({...editingRun, run_date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={editingRun.class_time || ''}
                      onChange={(e) => setEditingRun({...editingRun, class_time: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Outcome</Label>
                  <Select 
                    value={editingRun.result || ''} 
                    onValueChange={(v) => setEditingRun({...editingRun, result: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select outcome..." />
                    </SelectTrigger>
                    <SelectContent>
                      {VALID_OUTCOMES.map(o => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Intro Owner (SA)</Label>
                  <Select 
                    value={editingRun.intro_owner || ''} 
                    onValueChange={(v) => setEditingRun({...editingRun, intro_owner: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select SA..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_STAFF.map(sa => (
                        <SelectItem key={sa} value={sa}>{sa}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Goal Quality</Label>
                    <Select 
                      value={editingRun.goal_quality || ''} 
                      onValueChange={(v) => setEditingRun({...editingRun, goal_quality: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Excellent">Excellent</SelectItem>
                        <SelectItem value="Good">Good</SelectItem>
                        <SelectItem value="Needs Improvement">Needs Improvement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Pricing Engagement</Label>
                    <Select 
                      value={editingRun.pricing_engagement || ''} 
                      onValueChange={(v) => setEditingRun({...editingRun, pricing_engagement: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Excellent">Excellent</SelectItem>
                        <SelectItem value="Good">Good</SelectItem>
                        <SelectItem value="Needs Improvement">Needs Improvement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Edit Reason (optional)</Label>
                  <Textarea
                    placeholder="Why are you making this change?"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingRun(null)}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Link Dialog */}
        <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Link Run to Booking</DialogTitle>
              <DialogDescription>
                Select a booking to link this run to: {linkingRun?.member_name}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[300px]">
              {matchingBookings.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No matching bookings found for this member
                </div>
              ) : (
                <div className="space-y-2">
                  {matchingBookings.map((booking) => (
                    <Button
                      key={booking.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleLinkToBooking(booking.id)}
                      disabled={isSaving}
                    >
                      <div className="text-left">
                        <div className="font-medium">{booking.member_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {booking.class_date} {booking.intro_time} • Booked by: {booking.sa_working_shift}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
