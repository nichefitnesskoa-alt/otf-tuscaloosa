import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Calendar, AlertTriangle, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getSpreadsheetId } from '@/lib/sheets-sync';
import { format, parseISO, isAfter, isBefore, startOfDay } from 'date-fns';

interface SheetBooking {
  booking_id: string;
  member_name: string;
  intro_date: string;
  intro_time: string;
  intro_date_normalized: string;
  intro_time_normalized: string;
  intro_datetime_key: string;
  intro_date_valid: boolean;
  lead_source: string;
  notes: string;
  row_number: number;
}

interface BookedIntroSelectorProps {
  selectedBookingId: string | undefined;
  onSelect: (booking: SheetBooking) => void;
}

type FilterType = 'all' | 'upcoming' | 'past' | 'needs_fix';

export default function BookedIntroSelector({ selectedBookingId, onSelect }: BookedIntroSelectorProps) {
  const [bookings, setBookings] = useState<SheetBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
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

    fetchBookings();
  }, []);

  const today = startOfDay(new Date());

  const filteredBookings = useMemo(() => {
    let filtered = bookings;

    // Apply filter
    switch (filter) {
      case 'upcoming':
        filtered = filtered.filter(b => {
          if (!b.intro_date_valid) return false;
          try {
            const bookingDate = parseISO(b.intro_date_normalized);
            return isAfter(bookingDate, today) || format(bookingDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
          } catch {
            return false;
          }
        });
        break;
      case 'past':
        filtered = filtered.filter(b => {
          if (!b.intro_date_valid) return false;
          try {
            const bookingDate = parseISO(b.intro_date_normalized);
            return isBefore(bookingDate, today);
          } catch {
            return false;
          }
        });
        break;
      case 'needs_fix':
        filtered = filtered.filter(b => !b.intro_date_valid || !b.intro_datetime_key);
        break;
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b => 
        b.member_name.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [bookings, filter, searchQuery, today]);

  const selectedBooking = bookings.find(b => b.booking_id === selectedBookingId);

  const formatDisplayDate = (booking: SheetBooking): string => {
    if (!booking.intro_date_valid) {
      return booking.intro_date || 'No date';
    }
    try {
      return format(parseISO(booking.intro_date_normalized), 'MMM d, yyyy');
    } catch {
      return booking.intro_date || 'Invalid date';
    }
  };

  const formatDisplayTime = (booking: SheetBooking): string => {
    if (!booking.intro_time_normalized) return '';
    try {
      const [hours, minutes] = booking.intro_time_normalized.split(':');
      const h = parseInt(hours);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return booking.intro_time || '';
    }
  };

  const getCounts = useMemo(() => {
    const upcomingCount = bookings.filter(b => {
      if (!b.intro_date_valid) return false;
      try {
        const bookingDate = parseISO(b.intro_date_normalized);
        return isAfter(bookingDate, today) || format(bookingDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
      } catch {
        return false;
      }
    }).length;

    const pastCount = bookings.filter(b => {
      if (!b.intro_date_valid) return false;
      try {
        const bookingDate = parseISO(b.intro_date_normalized);
        return isBefore(bookingDate, today);
      } catch {
        return false;
      }
    }).length;

    const needsFixCount = bookings.filter(b => !b.intro_date_valid || !b.intro_datetime_key).length;

    return { all: bookings.length, upcoming: upcomingCount, past: pastCount, needs_fix: needsFixCount };
  }, [bookings, today]);

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
      <Label className="text-xs">Select from Booked Intros</Label>
      
      {/* Selected booking display or expand button */}
      <Button
        variant="outline"
        className="w-full justify-between text-left font-normal"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {selectedBooking ? (
          <div className="flex items-center gap-2 truncate">
            <span className="font-medium truncate">{selectedBooking.member_name}</span>
            <span className="text-xs text-muted-foreground">
              ({formatDisplayDate(selectedBooking)})
            </span>
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

          {/* Filter tabs */}
          <div className="flex gap-1 p-2 border-b overflow-x-auto">
            <Button
              variant={filter === 'all' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs whitespace-nowrap"
              onClick={() => setFilter('all')}
            >
              All ({getCounts.all})
            </Button>
            <Button
              variant={filter === 'upcoming' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs whitespace-nowrap"
              onClick={() => setFilter('upcoming')}
            >
              <Calendar className="h-3 w-3 mr-1" />
              Upcoming ({getCounts.upcoming})
            </Button>
            <Button
              variant={filter === 'past' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs whitespace-nowrap"
              onClick={() => setFilter('past')}
            >
              Past ({getCounts.past})
            </Button>
            {getCounts.needs_fix > 0 && (
              <Button
                variant={filter === 'needs_fix' ? 'destructive' : 'ghost'}
                size="sm"
                className="h-7 text-xs whitespace-nowrap"
                onClick={() => setFilter('needs_fix')}
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                Needs Fix ({getCounts.needs_fix})
              </Button>
            )}
          </div>

          {/* Bookings list */}
          <ScrollArea className="h-[300px]">
            {filteredBookings.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {searchQuery ? 'No matching bookings found' : 'No bookings in this category'}
              </div>
            ) : (
              <div className="divide-y">
                {filteredBookings.map((booking) => (
                  <button
                    key={booking.booking_id}
                    className={`w-full p-3 text-left hover:bg-muted/50 transition-colors ${
                      booking.booking_id === selectedBookingId ? 'bg-primary/10' : ''
                    }`}
                    onClick={() => {
                      onSelect(booking);
                      setIsExpanded(false);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{booking.member_name}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {!booking.intro_date_valid ? (
                            <span className="text-destructive flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {booking.intro_date || 'No date'}
                            </span>
                          ) : (
                            <>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDisplayDate(booking)}
                              </span>
                              {booking.intro_time_normalized && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDisplayTime(booking)}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {booking.lead_source}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Show selected booking details */}
      {selectedBooking && !isExpanded && (
        <div className="p-2 bg-primary/10 rounded text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date:</span>
            <span>{formatDisplayDate(selectedBooking)}</span>
          </div>
          {selectedBooking.intro_time_normalized && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time:</span>
              <span>{formatDisplayTime(selectedBooking)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Source:</span>
            <span>{selectedBooking.lead_source}</span>
          </div>
        </div>
      )}
    </div>
  );
}
