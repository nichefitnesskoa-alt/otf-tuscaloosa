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
  Calendar,
  Search,
  Filter
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ALL_STAFF, LEAD_SOURCES } from '@/types';
import { useAuth } from '@/context/AuthContext';

interface IntroBooking {
  id: string;
  booking_id: string | null;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  coach_name: string;
  sa_working_shift: string;
  lead_source: string;
  fitness_goal: string | null;
  sheets_row_number: number | null;
  last_edited_at: string | null;
  last_edited_by: string | null;
  edit_reason: string | null;
}

interface EditingBooking extends IntroBooking {
  isNew?: boolean;
}

export default function IntroBookingsEditor() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<IntroBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMissingSA, setFilterMissingSA] = useState(false);
  
  const [editingBooking, setEditingBooking] = useState<EditingBooking | null>(null);
  const [editReason, setEditReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [bulkSA, setBulkSA] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('intros_booked')
        .select('*')
        .order('class_date', { ascending: false })
        .limit(500);

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const filteredBookings = useMemo(() => {
    let filtered = bookings;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(b => 
        b.member_name.toLowerCase().includes(term) ||
        b.booking_id?.toLowerCase().includes(term)
      );
    }
    
    if (filterMissingSA) {
      filtered = filtered.filter(b => 
        !b.sa_working_shift || 
        b.sa_working_shift === 'TBD' || 
        b.sa_working_shift === 'Unknown'
      );
    }
    
    return filtered;
  }, [bookings, searchTerm, filterMissingSA]);

  const handleEdit = (booking: IntroBooking) => {
    setEditingBooking({ ...booking });
    setEditReason('');
  };

  const handleSave = async () => {
    if (!editingBooking) return;
    
    // Validate booked_by is not blank
    if (!editingBooking.sa_working_shift || editingBooking.sa_working_shift === 'TBD') {
      toast.error('booked_by (SA) is required');
      return;
    }
    
    setIsSaving(true);
    try {
      const updateData = {
        member_name: editingBooking.member_name,
        class_date: editingBooking.class_date,
        intro_time: editingBooking.intro_time,
        coach_name: editingBooking.coach_name,
        sa_working_shift: editingBooking.sa_working_shift,
        lead_source: editingBooking.lead_source,
        fitness_goal: editingBooking.fitness_goal,
        last_edited_at: new Date().toISOString(),
        last_edited_by: user?.name || 'Admin',
        edit_reason: editReason || 'Admin edit',
      };

      const { error } = await supabase
        .from('intros_booked')
        .update(updateData)
        .eq('id', editingBooking.id);

      if (error) throw error;
      
      toast.success('Booking updated successfully');
      setEditingBooking(null);
      await fetchBookings();
    } catch (error) {
      console.error('Error saving booking:', error);
      toast.error('Failed to save booking');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkSA || selectedIds.size === 0) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('intros_booked')
        .update({ 
          sa_working_shift: bulkSA,
          last_edited_at: new Date().toISOString(),
          last_edited_by: user?.name || 'Admin',
          edit_reason: 'Bulk SA assignment',
        })
        .in('id', Array.from(selectedIds));

      if (error) throw error;
      
      toast.success(`Updated ${selectedIds.size} bookings to ${bulkSA}`);
      setSelectedIds(new Set());
      setShowBulkAssign(false);
      setBulkSA('');
      await fetchBookings();
    } catch (error) {
      console.error('Error bulk assigning:', error);
      toast.error('Failed to bulk assign');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredBookings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredBookings.map(b => b.id)));
    }
  };

  const missingSACount = bookings.filter(b => 
    !b.sa_working_shift || b.sa_working_shift === 'TBD' || b.sa_working_shift === 'Unknown'
  ).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Intro Bookings Editor
            <Badge variant="outline" className="ml-2">{bookings.length} total</Badge>
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchBookings}
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
              placeholder="Search by member name or booking ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button
            variant={filterMissingSA ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterMissingSA(!filterMissingSA)}
            className="gap-1"
          >
            <Filter className="w-4 h-4" />
            Missing SA ({missingSACount})
          </Button>
          {selectedIds.size > 0 && (
            <Button
              size="sm"
              onClick={() => setShowBulkAssign(true)}
            >
              Bulk Assign ({selectedIds.size})
            </Button>
          )}
        </div>

        {/* Table */}
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <input 
                    type="checkbox"
                    checked={selectedIds.size === filteredBookings.length && filteredBookings.length > 0}
                    onChange={selectAll}
                  />
                </TableHead>
                <TableHead className="text-xs">Member</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Time</TableHead>
                <TableHead className="text-xs">Booked By</TableHead>
                <TableHead className="text-xs">Lead Source</TableHead>
                <TableHead className="text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBookings.map((booking) => (
                <TableRow 
                  key={booking.id}
                  className={!booking.sa_working_shift || booking.sa_working_shift === 'TBD' || booking.sa_working_shift === 'Unknown' ? 'bg-destructive/5' : ''}
                >
                  <TableCell>
                    <input 
                      type="checkbox"
                      checked={selectedIds.has(booking.id)}
                      onChange={() => toggleSelection(booking.id)}
                    />
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {booking.member_name}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {booking.class_date}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {booking.intro_time || '-'}
                  </TableCell>
                  <TableCell>
                    {!booking.sa_working_shift || booking.sa_working_shift === 'TBD' || booking.sa_working_shift === 'Unknown' ? (
                      <Badge variant="destructive" className="text-xs">
                        {booking.sa_working_shift || 'Missing'}
                      </Badge>
                    ) : (
                      <span className="text-sm">{booking.sa_working_shift}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {booking.lead_source}
                  </TableCell>
                  <TableCell>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => handleEdit(booking)}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Edit Dialog */}
        <Dialog open={!!editingBooking} onOpenChange={() => setEditingBooking(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Booking</DialogTitle>
              <DialogDescription>
                Update booking details. Changes will be synced to Google Sheets.
              </DialogDescription>
            </DialogHeader>
            {editingBooking && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Member Name</Label>
                  <Input
                    value={editingBooking.member_name}
                    onChange={(e) => setEditingBooking({...editingBooking, member_name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Booking Date</Label>
                    <Input
                      type="date"
                      value={editingBooking.class_date}
                      onChange={(e) => setEditingBooking({...editingBooking, class_date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Intro Time</Label>
                    <Input
                      type="time"
                      value={editingBooking.intro_time || ''}
                      onChange={(e) => setEditingBooking({...editingBooking, intro_time: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Booked By (SA) *</Label>
                  <Select 
                    value={editingBooking.sa_working_shift || ''} 
                    onValueChange={(v) => setEditingBooking({...editingBooking, sa_working_shift: v})}
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
                <div className="space-y-2">
                  <Label>Lead Source</Label>
                  <Select 
                    value={editingBooking.lead_source || ''} 
                    onValueChange={(v) => setEditingBooking({...editingBooking, lead_source: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source..." />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_SOURCES.map(source => (
                        <SelectItem key={source} value={source}>{source}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              <Button variant="outline" onClick={() => setEditingBooking(null)}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Assign Dialog */}
        <Dialog open={showBulkAssign} onOpenChange={setShowBulkAssign}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Bulk Assign Booked By</DialogTitle>
              <DialogDescription>
                Assign {selectedIds.size} selected bookings to an SA.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select SA</Label>
                <Select value={bulkSA} onValueChange={setBulkSA}>
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkAssign(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkAssign} disabled={!bulkSA || isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                Apply to {selectedIds.size} bookings
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
