/**
 * Canonical VIP predicate utilities.
 * Single source of truth for whether a booking/run is VIP
 * and whether it should be excluded from the intro funnel.
 */

interface VipBookingLike {
  is_vip?: boolean | null;
  lead_source?: string | null;
  vip_session_id?: string | null;
  vip_class_name?: string | null;
  converted_to_booking_id?: string | null;
  booking_type_canon?: string | null;
}

interface VipRunLike {
  is_vip?: boolean | null;
  vip_session_id?: string | null;
  lead_source?: string | null;
}

/**
 * Returns true if the booking is a VIP or COMP event booking (not a normal intro).
 */
export function isVipBooking(b: VipBookingLike): boolean {
  if (b.is_vip === true) return true;
  if (b.booking_type_canon === 'VIP') return true;
  if (b.booking_type_canon === 'COMP') return true;
  if (b.vip_session_id) return true;
  if (b.lead_source && b.lead_source.toLowerCase().includes('vip')) return true;
  return false;
}

/**
 * Returns true if the run is linked to a VIP event.
 */
export function isVipRun(r: VipRunLike): boolean {
  if (r.is_vip === true) return true;
  if (r.vip_session_id) return true;
  if (r.lead_source && r.lead_source.toLowerCase().includes('vip')) return true;
  return false;
}

/**
 * Returns true if the VIP booking should be hidden from MyDay,
 * follow-up queues, questionnaire hub, etc.
 * Always true for VIP unless explicitly converted to a real intro.
 */
export function shouldExcludeVipFromFunnel(b: VipBookingLike): boolean {
  if (!isVipBooking(b)) return false;
  return true;
}
