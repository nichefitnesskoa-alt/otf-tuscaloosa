import { useMemo } from 'react';

/**
 * Determines if a booking is a 2nd intro by checking:
 * 1. originating_booking_id (definitive)
 * 2. Name or phone matching against other bookings
 * 3. booking_status containing "2nd" (fallback)
 */
export function useIntroTypeDetection(
  allBookings: Array<{
    id: string;
    member_name: string;
    originating_booking_id?: string | null;
    class_date: string;
    created_at?: string;
    is_vip?: boolean | null;
    booking_status?: string | null;
    phone?: string | null;
  }>
) {
  const introTypeMap = useMemo(() => {
    const map = new Map<string, boolean>();
    
    // Group bookings by member_key, excluding VIP bookings from intro type logic
    const nonVipBookings = allBookings.filter(b => !b.is_vip);
    
    // Group by name key
    const memberGroups = new Map<string, typeof nonVipBookings>();
    nonVipBookings.forEach(b => {
      const key = b.member_name.toLowerCase().replace(/\s+/g, '');
      if (!memberGroups.has(key)) memberGroups.set(key, []);
      memberGroups.get(key)!.push(b);
    });

    // Group by phone (secondary matching)
    const phoneGroups = new Map<string, typeof nonVipBookings>();
    nonVipBookings.forEach(b => {
      const phone = b.phone?.replace(/\D/g, '');
      if (phone && phone.length >= 7) {
        if (!phoneGroups.has(phone)) phoneGroups.set(phone, []);
        phoneGroups.get(phone)!.push(b);
      }
    });

    allBookings.forEach(b => {
      // VIP bookings are never 1st/2nd intros
      if (b.is_vip) {
        map.set(b.id, false);
        return;
      }
      // 1) originating_booking_id is definitive
      if (b.originating_booking_id) {
        map.set(b.id, true);
        return;
      }

      // 2) Check name-based grouping
      const key = b.member_name.toLowerCase().replace(/\s+/g, '');
      const nameGroup = memberGroups.get(key) || [];
      
      // 3) Check phone-based grouping
      const phone = b.phone?.replace(/\D/g, '');
      const phoneGroup = (phone && phone.length >= 7) ? (phoneGroups.get(phone) || []) : [];
      
      // Merge unique bookings from both groups
      const seenIds = new Set<string>();
      const combined: typeof nonVipBookings = [];
      for (const booking of [...nameGroup, ...phoneGroup]) {
        if (!seenIds.has(booking.id)) {
          seenIds.add(booking.id);
          combined.push(booking);
        }
      }

      if (combined.length <= 1) {
        // 4) Fallback: booking_status contains "2nd"
        const status = (b.booking_status || '').toUpperCase();
        if (status.includes('2ND')) {
          map.set(b.id, true);
        } else {
          map.set(b.id, false);
        }
        return;
      }

      // Sort by class_date, then created_at to find earliest
      const sorted = [...combined].sort((a, c) => {
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
  
  const isSecondIntroByName = (memberName: string, currentBookingId?: string) => {
    const key = memberName.toLowerCase().replace(/\s+/g, '');
    const group = allBookings.filter(b => b.member_name.toLowerCase().replace(/\s+/g, '') === key);
    if (group.length <= 1) return false;
    if (!currentBookingId) return true;
    const sorted = [...group].sort((a, c) => a.class_date.localeCompare(c.class_date));
    return sorted[0].id !== currentBookingId;
  };

  const getFirstBookingId = (memberName: string): string | null => {
    const key = memberName.toLowerCase().replace(/\s+/g, '');
    const group = allBookings
      .filter(b => b.member_name.toLowerCase().replace(/\s+/g, '') === key)
      .sort((a, c) => a.class_date.localeCompare(c.class_date));
    return group.length > 0 ? group[0].id : null;
  };

  return { introTypeMap, isSecondIntro, isSecondIntroByName, getFirstBookingId };
}