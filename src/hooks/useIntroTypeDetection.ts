import { useMemo } from 'react';

/**
 * Determines if a booking is a 2nd intro by checking if the same person
 * (matched by member_key) has another booking in the system.
 * Uses originating_booking_id first, then falls back to name matching.
 */
export function useIntroTypeDetection(
  allBookings: Array<{
    id: string;
    member_name: string;
    originating_booking_id?: string | null;
    class_date: string;
    created_at?: string;
  }>
) {
  // Build a map: booking_id -> isSecondIntro
  const introTypeMap = useMemo(() => {
    const map = new Map<string, boolean>();
    
    // Group bookings by member_key
    const memberGroups = new Map<string, typeof allBookings>();
    allBookings.forEach(b => {
      const key = b.member_name.toLowerCase().replace(/\s+/g, '');
      if (!memberGroups.has(key)) memberGroups.set(key, []);
      memberGroups.get(key)!.push(b);
    });

    allBookings.forEach(b => {
      // If it has an originating_booking_id, it's definitively a 2nd intro
      if (b.originating_booking_id) {
        map.set(b.id, true);
        return;
      }

      // Check if this person has other bookings (by name match)
      const key = b.member_name.toLowerCase().replace(/\s+/g, '');
      const group = memberGroups.get(key) || [];
      
      if (group.length <= 1) {
        map.set(b.id, false);
        return;
      }

      // Sort by class_date, then created_at to find earliest
      const sorted = [...group].sort((a, c) => {
        const dateCompare = a.class_date.localeCompare(c.class_date);
        if (dateCompare !== 0) return dateCompare;
        return (a.created_at || '').localeCompare(c.created_at || '');
      });

      // First booking in the group is 1st intro, rest are 2nd
      map.set(b.id, sorted[0].id !== b.id);
    });

    return map;
  }, [allBookings]);

  const isSecondIntro = (bookingId: string) => introTypeMap.get(bookingId) ?? false;
  
  // For a member name, check if they have any previous booking
  const isSecondIntroByName = (memberName: string, currentBookingId?: string) => {
    const key = memberName.toLowerCase().replace(/\s+/g, '');
    const group = allBookings.filter(b => b.member_name.toLowerCase().replace(/\s+/g, '') === key);
    if (group.length <= 1) return false;
    if (!currentBookingId) return true;
    const sorted = [...group].sort((a, c) => a.class_date.localeCompare(c.class_date));
    return sorted[0].id !== currentBookingId;
  };

  // Get the first booking for a member (for pulling questionnaire data from 1st intro)
  const getFirstBookingId = (memberName: string): string | null => {
    const key = memberName.toLowerCase().replace(/\s+/g, '');
    const group = allBookings
      .filter(b => b.member_name.toLowerCase().replace(/\s+/g, '') === key)
      .sort((a, c) => a.class_date.localeCompare(c.class_date));
    return group.length > 0 ? group[0].id : null;
  };

  return { introTypeMap, isSecondIntro, isSecondIntroByName, getFirstBookingId };
}