import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ChevronDown, ChevronUp, X, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
import { toast } from 'sonner';

interface BookedIntro {
  id: string;
  booking_id: string | null;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  lead_source: string;
  sa_working_shift: string;
  coach_name: string;
  fitness_goal: string | null;
  booking_status: string | null;
  intro_owner: string | null;
}

// Status values that should be excluded from the booking pool
const EXCLUDED_STATUSES = [
  'Closed (Purchased)',
  'Not interested', 
  'Duplicate',
  'Deleted (soft)',
];

interface BookedIntroSelectorProps {
  selectedBookingId: string | undefined;
  onSelect: (booking: BookedIntro) => void;
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
  const [bookings, setBookings] = useState<BookedIntro[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Remove dialog state
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [bookingToRemove, setBookingToRemove] = useState<BookedIntro | null>(null);
  const [removeReason, setRemoveReason] = useState<string>('');
  const [isRemoving, setIsRemoving] = useState(false);
  
  // Details dialog state
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedBookingDetails, setSelectedBookingDetails] = useState<BookedIntro | null>(null);

  const fetchBookings = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch directly from Supabase database instead of Google Sheets
      const { data, error: dbError } = await supabase
        .from('intros_booked')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;

      // Map to BookedIntro interface
      const mappedBookings: BookedIntro[] = (data || []).map((row) => ({
        id: row.id,
        booking_id: row.booking_id,
        member_name: row.member_name,
        class_date: row.class_date,
        intro_time: row.intro_time,
        lead_source: row.lead_source,
        sa_working_shift: row.sa_working_shift,
        coach_name: row.coach_name,
        fitness_goal: row.fitness_goal,
        booking_status: row.booking_status,
        intro_owner: row.intro_owner,
      }));

      setBookings(mappedBookings);
    } catch (err) {
      console.error('Error fetching bookings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const filteredBookings = useMemo(() => {
    // First filter out closed/deleted bookings
    const activeBookings = bookings.filter(b => {
      const status = (b.booking_status || '').toUpperCase();
      return !EXCLUDED_STATUSES.some(s => status.includes(s.toUpperCase()));
    });
    
    // Apply search filter
    const searched = searchQuery.trim()
      ? activeBookings.filter(b => b.member_name.toLowerCase().includes(searchQuery.toLowerCase()))
      : activeBookings;
    
    // Sort alphabetically by member name
    return searched.sort((a, b) => 
      a.member_name.toLowerCase().localeCompare(b.member_name.toLowerCase())
    );
  }, [bookings, searchQuery]);

  const selectedBooking = bookings.find(b => b.id === selectedBookingId || b.booking_id === selectedBookingId);

  const handleRemoveClick = (e: React.MouseEvent, booking: BookedIntro) => {
    e.stopPropagation();
    setBookingToRemove(booking);
    setRemoveReason('');
    setRemoveDialogOpen(true);
  };

  const handleConfirmRemove = async () => {
    if (!bookingToRemove || !removeReason) return;
    
    setIsRemoving(true);
    try {
      // Update in database directly
      const { error: updateError } = await supabase
        .from('intros_booked')
        .update({
          booking_status: 'Not interested',
          last_edited_at: new Date().toISOString(),
          last_edited_by: currentUserName,
          edit_reason: removeReason,
        })
        .eq('id', bookingToRemove.id);

      if (updateError) throw updateError;

      toast.success('Booking removed from queue');
      // Refresh the list
      await fetchBookings();
      setRemoveDialogOpen(false);
      setBookingToRemove(null);
    } catch (err) {
      console.error('Error removing booking:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to remove booking');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleShowDetails = (e: React.MouseEvent, booking: BookedIntro) => {
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
        <Button variant="outline" size="sm" onClick={fetchBookings}>
          Retry
        </Button>
      </div>
    );
  }

  const activeCount = filteredBookings.length;

  return (
    <div className="space-y-2">
      <Label className="text-xs">Select from Booked Intros ({activeCount} active)</Label>
      
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
                {filteredBookings.map((booking) => {
                  const daysSinceBooked = booking.class_date 
                    ? Math.floor((Date.now() - new Date(booking.class_date).getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                  const bookedBy = booking.sa_working_shift;
                  
                  return (
                    <div
                      key={booking.id}
                      className={`w-full p-3 text-left hover:bg-muted/50 transition-colors ${
                        (booking.id === selectedBookingId || booking.booking_id === selectedBookingId) ? 'bg-primary/10' : ''
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
                          
                          {/* PROMINENT: Booked By display */}
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${bookedBy === currentUserName ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted'}`}
                            >
                              📅 Booked by: {bookedBy}
                            </Badge>
                            {booking.intro_owner && (
                              <Badge variant="secondary" className="text-xs">
                                🎯 Owner: {booking.intro_owner}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {booking.lead_source}
                            </Badge>
                            {booking.class_date && (
                              <span>{booking.class_date}</span>
                            )}
                            {daysSinceBooked !== null && daysSinceBooked > 0 && (
                              <span className={daysSinceBooked > 7 ? 'text-warning' : ''}>
                                ({daysSinceBooked}d ago)
                              </span>
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
                  );
                })}
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
          {selectedBooking.class_date && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date:</span>
              <span>{selectedBooking.class_date}</span>
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
              This will mark the booking as not interested.
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
              {selectedBookingDetails.class_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Class Date:</span>
                  <span>{selectedBookingDetails.class_date}</span>
                </div>
              )}
              {selectedBookingDetails.intro_time && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Intro Time:</span>
                  <span>{selectedBookingDetails.intro_time}</span>
                </div>
              )}
              {selectedBookingDetails.sa_working_shift && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Booked By:</span>
                  <span>{selectedBookingDetails.sa_working_shift}</span>
                </div>
              )}
              {selectedBookingDetails.fitness_goal && (
                <div>
                  <span className="text-muted-foreground">Fitness Goal:</span>
                  <p className="mt-1 text-sm">{selectedBookingDetails.fitness_goal}</p>
                </div>
              )}
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>ID:</span>
                <span className="font-mono truncate max-w-[200px]">{selectedBookingDetails.booking_id || selectedBookingDetails.id}</span>
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
