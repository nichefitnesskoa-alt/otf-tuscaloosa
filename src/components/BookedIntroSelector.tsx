import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ChevronDown, ChevronUp, X, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getSpreadsheetId } from '@/lib/sheets-sync';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SheetBooking {
  booking_id: string;
  member_name: string;
  member_key: string;
  intro_date: string;
  intro_time: string;
  lead_source: string;
  notes: string;
  booking_status: string;
  originating_booking_id: string;
  row_number: number;
}

interface BookedIntroSelectorProps {
  selectedBookingId: string | undefined;
  onSelect: (booking: SheetBooking) => void;
  currentUserName?: string;
}

const REMOVE_REASONS = [
  'Not interested',
  'Could not reach',
  'No-show multiple times',
  'Duplicate/bad info',
  'Other',
] as const;

export default function BookedIntroSelector({ 
  selectedBookingId, 
  onSelect,
  currentUserName = 'SA'
}: BookedIntroSelectorProps) {
  const [bookings, setBookings] = useState<SheetBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Remove dialog state
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [bookingToRemove, setBookingToRemove] = useState<SheetBooking | null>(null);
  const [removeReason, setRemoveReason] = useState<string>('');
  const [isRemoving, setIsRemoving] = useState(false);
  
  // Details dialog state
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedBookingDetails, setSelectedBookingDetails] = useState<SheetBooking | null>(null);

  const fetchBookings = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const spreadsheetId = getSpreadsheetId();
      if (!spreadsheetId) {
        throw new Error('No spreadsheet configured');
      }

      const { data, error: fnError } = await supabase.functions.invoke('sync-sheets', {
        body: {
          action: 'read_intro_bookings',
          spreadsheetId,
        },
      });

      if (fnError) throw fnError;
      if (!data.success) throw new Error(data.error || 'Failed to fetch bookings');

      setBookings(data.bookings || []);
    } catch (err) {
      console.error('Error fetching bookings from sheets:', err);
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const filteredBookings = useMemo(() => {
    if (!searchQuery.trim()) return bookings;
    
    const query = searchQuery.toLowerCase();
    return bookings.filter(b => 
      b.member_name.toLowerCase().includes(query)
    );
  }, [bookings, searchQuery]);

  const selectedBooking = bookings.find(b => b.booking_id === selectedBookingId);

  const handleRemoveClick = (e: React.MouseEvent, booking: SheetBooking) => {
    e.stopPropagation();
    setBookingToRemove(booking);
    setRemoveReason('');
    setRemoveDialogOpen(true);
  };

  const handleConfirmRemove = async () => {
    if (!bookingToRemove || !removeReason) return;
    
    setIsRemoving(true);
    try {
      const spreadsheetId = getSpreadsheetId();
      if (!spreadsheetId) throw new Error('No spreadsheet configured');

      const { data, error: fnError } = await supabase.functions.invoke('sync-sheets', {
        body: {
          action: 'update_booking_status',
          spreadsheetId,
          data: {
            bookingId: bookingToRemove.booking_id,
            memberKey: bookingToRemove.member_key,
            newStatus: 'DEAD',
            statusReason: removeReason,
            changedBy: currentUserName,
          },
        },
      });

      if (fnError) throw fnError;
      if (!data.success) throw new Error(data.error || 'Failed to update status');

      // Refresh the list
      await fetchBookings();
      setRemoveDialogOpen(false);
      setBookingToRemove(null);
    } catch (err) {
      console.error('Error removing booking:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove booking');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleShowDetails = (e: React.MouseEvent, booking: SheetBooking) => {
    e.stopPropagation();
    setSelectedBookingDetails(booking);
    setDetailsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label className="text-xs">Select from Booked Intros</Label>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <Label className="text-xs">Select from Booked Intros</Label>
        <div className="p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">Select from Booked Intros ({bookings.length} active)</Label>
      
      {/* Selected booking display or expand button */}
      <Button
        variant="outline"
        className="w-full justify-between text-left font-normal"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {selectedBooking ? (
          <div className="flex items-center gap-2 truncate">
            <span className="font-medium truncate">{selectedBooking.member_name}</span>
            <Badge variant="secondary" className="text-xs">
              {selectedBooking.lead_source}
            </Badge>
          </div>
        ) : (
          <span className="text-muted-foreground">Select an intro...</span>
        )}
        {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </Button>

      {isExpanded && (
        <div className="border rounded-lg bg-background shadow-lg">
          {/* Search */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by member name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {/* Bookings list */}
          <ScrollArea className="h-[300px]">
            {filteredBookings.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {searchQuery ? 'No matching bookings found' : 'No active bookings'}
              </div>
            ) : (
              <div className="divide-y">
                {filteredBookings.map((booking) => (
                  <div
                    key={booking.booking_id}
                    className={`w-full p-3 text-left hover:bg-muted/50 transition-colors ${
                      booking.booking_id === selectedBookingId ? 'bg-primary/10' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        className="flex-1 text-left"
                        onClick={() => {
                          onSelect(booking);
                          setIsExpanded(false);
                        }}
                      >
                        <div className="font-medium text-sm">{booking.member_name}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <Badge variant="secondary" className="text-xs">
                            {booking.lead_source}
                          </Badge>
                          {booking.notes && (
                            <span className="truncate max-w-[150px]">{booking.notes}</span>
                          )}
                        </div>
                      </button>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => handleShowDetails(e, booking)}
                        >
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => handleRemoveClick(e, booking)}
                        >
                          <X className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Show selected booking details below */}
      {selectedBooking && !isExpanded && (
        <div className="p-2 bg-primary/10 rounded text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Source:</span>
            <span>{selectedBooking.lead_source}</span>
          </div>
          {selectedBooking.notes && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Notes:</span>
              <span className="truncate max-w-[180px]">{selectedBooking.notes}</span>
            </div>
          )}
        </div>
      )}

      {/* Remove Confirmation Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from Queue</DialogTitle>
            <DialogDescription>
              Remove <strong>{bookingToRemove?.member_name}</strong> from the active bookings queue.
              This action will mark the booking as DEAD.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-sm">Reason for removal *</Label>
            <Select value={removeReason} onValueChange={setRemoveReason}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {REMOVE_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmRemove}
              disabled={!removeReason || isRemoving}
            >
              {isRemoving ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBookingDetails && (
            <div className="space-y-3 py-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Member Name:</span>
                <span className="font-medium">{selectedBookingDetails.member_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lead Source:</span>
                <span>{selectedBookingDetails.lead_source}</span>
              </div>
              {selectedBookingDetails.intro_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Intro Date:</span>
                  <span>{selectedBookingDetails.intro_date}</span>
                </div>
              )}
              {selectedBookingDetails.intro_time && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Intro Time:</span>
                  <span>{selectedBookingDetails.intro_time}</span>
                </div>
              )}
              {selectedBookingDetails.notes && (
                <div>
                  <span className="text-muted-foreground">Notes:</span>
                  <p className="mt-1 text-sm">{selectedBookingDetails.notes}</p>
                </div>
              )}
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Booking ID:</span>
                <span className="font-mono">{selectedBookingDetails.booking_id}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
