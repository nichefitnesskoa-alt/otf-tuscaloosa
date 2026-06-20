import { useMemo } from 'react';
import { isSecondIntroBooking } from '@/lib/intros/secondIntroDetection';

/**
 * @deprecated Use `loadIntroClassification` (async) or `isSecondIntroBooking`
 * (pure) directly. This hook is retained as a thin shim that routes through
 * the canonical helper so no surface ever ships with bespoke 2nd-intro logic.
 *
 * The name/phone fallback and "status contains 2nd" heuristic have been
 * removed — every surface in the app now uses the same originating_booking_id
 * + parent-run rule.
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
    booking_status_canon?: string | null;
    phone?: string | null;
  }>
) {
  const introTypeMap = useMemo(() => {
    const map = new Map<string, boolean>();
    // Pass the whole list as both "child candidates" and "lookup pool".
    // Runs are unavailable here, so the canonical helper will only return
    // true when the parent is in the list AND the parent has at least one
    // run that satisfies didIntroActuallyRun — which means a parent with no
    // run yet correctly resolves to "not a 2nd intro".
    for (const b of allBookings) {
      map.set(b.id, isSecondIntroBooking(b as any, allBookings as any, []));
    }
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