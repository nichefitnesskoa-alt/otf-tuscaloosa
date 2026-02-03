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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Filter,
  MoreVertical,
  DollarSign,
  UserX,
  UserCheck,
  Archive,
  Trash2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ALL_STAFF, LEAD_SOURCES, MEMBERSHIP_TYPES } from '@/types';
import { useAuth } from '@/context/AuthContext';

// Booking status types
const BOOKING_STATUSES = [
  'Active',
  'No-show',
  'Not interested',
  'Closed (Purchased)',
  'Duplicate',
  'Deleted (soft)',
] as const;

type BookingStatus = typeof BOOKING_STATUSES[number];

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
  booking_status: BookingStatus | null;
  closed_at: string | null;
  closed_by: string | null;
  intro_owner: string | null;
  intro_owner_locked: boolean | null;
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
  const [showClosed, setShowClosed] = useState(false);
  
  const [editingBooking, setEditingBooking] = useState<EditingBooking | null>(null);
  const [editReason, setEditReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [bulkSA, setBulkSA] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Mark as Purchased dialog
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [purchasingBooking, setPurchasingBooking] = useState<IntroBooking | null>(null);
  const [purchaseData, setPurchaseData] = useState({
    date_closed: new Date().toISOString().split('T')[0],
    membership_type: '',
    sale_type: 'Intro' as 'Intro' | 'Outside Intro',
    intro_owner: '',
    notes: '',
  });
  
  // Set Intro Owner dialog
  const [showSetOwnerDialog, setShowSetOwnerDialog] = useState(false);
  const [ownerBooking, setOwnerBooking] = useState<IntroBooking | null>(null);
  const [newIntroOwner, setNewIntroOwner] = useState('');
  const [ownerOverrideReason, setOwnerOverrideReason] = useState('');
  
  // Hard Delete confirm dialog
  const [showHardDeleteDialog, setShowHardDeleteDialog] = useState(false);
  const [deletingBooking, setDeletingBooking] = useState<IntroBooking | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('intros_booked')
        .select('*')
        .order('class_date', { ascending: false })
        .limit(500);

      if (error) throw error;
      setBookings((data || []) as IntroBooking[]);
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
    
    // Filter out closed/deleted bookings unless showClosed is true
    if (!showClosed) {
      filtered = filtered.filter(b => 
        !b.booking_status || 
        b.booking_status === 'Active' ||
        b.booking_status === 'No-show'
      );
    }
    
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
  }, [bookings, searchTerm, filterMissingSA, showClosed]);

  const handleEdit = (booking: IntroBooking) => {
    setEditingBooking({ ...booking });
    setEditReason('');
  };

  const handleSave = async () => {
    if (!editingBooking) return;
    
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

  // Mark as Purchased
  const handleOpenPurchaseDialog = (booking: IntroBooking) => {
    setPurchasingBooking(booking);
    setPurchaseData({
      date_closed: new Date().toISOString().split('T')[0],
      membership_type: '',
      sale_type: 'Intro',
      intro_owner: booking.intro_owner || '',
      notes: '',
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
      // Calculate commission from membership type
      const membershipConfig = MEMBERSHIP_TYPES.find(m => m.label === purchaseData.membership_type);
      const commissionAmount = membershipConfig?.commission || 0;
      
      // Create sale record
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
      
      // Update booking status
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
      await fetchBookings();
    } catch (error) {
      console.error('Error recording purchase:', error);
      toast.error('Failed to record purchase');
    } finally {
      setIsSaving(false);
    }
  };

  // Mark as Not Interested
  const handleMarkNotInterested = async (booking: IntroBooking) => {
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
      await fetchBookings();
    } catch (error) {
      console.error('Error updating booking:', error);
      toast.error('Failed to update booking');
    } finally {
      setIsSaving(false);
    }
  };

  // Set Intro Owner
  const handleOpenSetOwnerDialog = (booking: IntroBooking) => {
    setOwnerBooking(booking);
    setNewIntroOwner(booking.intro_owner || '');
    setOwnerOverrideReason('');
    setShowSetOwnerDialog(true);
  };

  const handleConfirmSetOwner = async () => {
    if (!ownerBooking || !newIntroOwner) return;
    
    if (ownerBooking.intro_owner_locked && !ownerOverrideReason) {
      toast.error('Override reason is required to change a locked intro owner');
      return;
    }
    
    setIsSaving(true);
    try {
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
      setShowSetOwnerDialog(false);
      setOwnerBooking(null);
      await fetchBookings();
    } catch (error) {
      console.error('Error setting intro owner:', error);
      toast.error('Failed to set intro owner');
    } finally {
      setIsSaving(false);
    }
  };

  // Soft Delete (Archive)
  const handleSoftDelete = async (booking: IntroBooking) => {
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
      await fetchBookings();
    } catch (error) {
      console.error('Error archiving booking:', error);
      toast.error('Failed to archive booking');
    } finally {
      setIsSaving(false);
    }
  };

  // Hard Delete
  const handleOpenHardDeleteDialog = (booking: IntroBooking) => {
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
      await fetchBookings();
    } catch (error) {
      console.error('Error deleting booking:', error);
      toast.error('Failed to delete booking');
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

  const getStatusBadge = (status: BookingStatus | null) => {
    switch (status) {
      case 'Closed (Purchased)':
        return <Badge className="bg-green-500/20 text-green-700 text-xs">Purchased</Badge>;
      case 'Not interested':
        return <Badge variant="secondary" className="text-xs">Not interested</Badge>;
      case 'No-show':
        return <Badge variant="destructive" className="text-xs">No-show</Badge>;
      case 'Duplicate':
        return <Badge variant="outline" className="text-xs">Duplicate</Badge>;
      case 'Deleted (soft)':
        return <Badge variant="outline" className="text-xs text-muted-foreground">Archived</Badge>;
      default:
        return <Badge variant="default" className="bg-primary/20 text-primary text-xs">Active</Badge>;
    }
  };

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
          <Button
            variant={showClosed ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowClosed(!showClosed)}
          >
            Show Closed
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
                <TableHead className="text-xs">Booked By</TableHead>
                <TableHead className="text-xs">Intro Owner</TableHead>
                <TableHead className="text-xs">Status</TableHead>
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
                  <TableCell>
                    {!booking.sa_working_shift || booking.sa_working_shift === 'TBD' || booking.sa_working_shift === 'Unknown' ? (
                      <Badge variant="destructive" className="text-xs">
                        {booking.sa_working_shift || 'Missing'}
                      </Badge>
                    ) : (
                      <span className="text-sm">{booking.sa_working_shift}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {booking.intro_owner ? (
                      <span className="flex items-center gap-1">
                        {booking.intro_owner}
                        {booking.intro_owner_locked && <span className="text-xs text-muted-foreground">🔒</span>}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(booking.booking_status)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(booking)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleOpenPurchaseDialog(booking)}
                          disabled={booking.booking_status === 'Closed (Purchased)'}
                        >
                          <DollarSign className="w-4 h-4 mr-2" />
                          Mark as Purchased
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleMarkNotInterested(booking)}
                          disabled={booking.booking_status === 'Not interested'}
                        >
                          <UserX className="w-4 h-4 mr-2" />
                          Mark Not Interested
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenSetOwnerDialog(booking)}>
                          <UserCheck className="w-4 h-4 mr-2" />
                          Set Intro Owner
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleSoftDelete(booking)}
                          disabled={booking.booking_status === 'Deleted (soft)'}
                        >
                          <Archive className="w-4 h-4 mr-2" />
                          Archive (Soft Delete)
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleOpenHardDeleteDialog(booking)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Permanently
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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

        {/* Mark as Purchased Dialog */}
        <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Mark as Purchased</DialogTitle>
              <DialogDescription>
                Record a sale for {purchasingBooking?.member_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Date Closed *</Label>
                <Input
                  type="date"
                  value={purchaseData.date_closed}
                  onChange={(e) => setPurchaseData({...purchaseData, date_closed: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Membership Type *</Label>
                <Select 
                  value={purchaseData.membership_type} 
                  onValueChange={(v) => setPurchaseData({...purchaseData, membership_type: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select membership..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMBERSHIP_TYPES.filter(m => m.commission > 0).map(m => (
                      <SelectItem key={m.label} value={m.label}>
                        {m.label} (${m.commission.toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sale Type</Label>
                <Select 
                  value={purchaseData.sale_type} 
                  onValueChange={(v) => setPurchaseData({...purchaseData, sale_type: v as 'Intro' | 'Outside Intro'})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Intro">Intro</SelectItem>
                    <SelectItem value="Outside Intro">Outside Intro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Intro Owner (Commission) {purchaseData.sale_type === 'Intro' && '*'}</Label>
                <Select 
                  value={purchaseData.intro_owner} 
                  onValueChange={(v) => setPurchaseData({...purchaseData, intro_owner: v})}
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
                <Label>Notes (optional)</Label>
                <Textarea
                  placeholder="Additional notes..."
                  value={purchaseData.notes}
                  onChange={(e) => setPurchaseData({...purchaseData, notes: e.target.value})}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPurchaseDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmPurchase} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <DollarSign className="w-4 h-4 mr-1" />}
                Record Sale
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Set Intro Owner Dialog */}
        <Dialog open={showSetOwnerDialog} onOpenChange={setShowSetOwnerDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Set Intro Owner</DialogTitle>
              <DialogDescription>
                Set who ran the first intro for {ownerBooking?.member_name}
                {ownerBooking?.intro_owner_locked && (
                  <span className="block text-destructive mt-1">
                    ⚠️ This intro owner is locked. Override reason required.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Intro Owner (SA)</Label>
                <Select value={newIntroOwner} onValueChange={setNewIntroOwner}>
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
              {ownerBooking?.intro_owner_locked && (
                <div className="space-y-2">
                  <Label>Override Reason *</Label>
                  <Textarea
                    placeholder="Why are you changing the locked intro owner?"
                    value={ownerOverrideReason}
                    onChange={(e) => setOwnerOverrideReason(e.target.value)}
                    rows={2}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSetOwnerDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmSetOwner} 
                disabled={!newIntroOwner || isSaving || (ownerBooking?.intro_owner_locked && !ownerOverrideReason)}
              >
                {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <UserCheck className="w-4 h-4 mr-1" />}
                Set Owner
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Hard Delete Confirm Dialog */}
        <Dialog open={showHardDeleteDialog} onOpenChange={setShowHardDeleteDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-destructive">Permanently Delete Booking</DialogTitle>
              <DialogDescription>
                This will permanently delete {deletingBooking?.member_name}'s booking. 
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
                disabled={deleteConfirmText !== 'DELETE' || isSaving}
              >
                {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                Delete Forever
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
