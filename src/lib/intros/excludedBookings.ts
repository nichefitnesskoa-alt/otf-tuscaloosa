/**
 * Single source of truth for "is this intros_booked row excluded from
 * performance metrics?" Used by WIG, Per-Coach, Per-SA, Booker tables.
 *
 * Excluded if any of:
 *  - ignore_from_metrics                     (manual admin override)
 *  - deleted_at IS NOT NULL                  (soft-deleted)
 *  - booking_status_canon = 'DELETED_SOFT'   (canonical soft-delete flag)
 *  - booking_status_canon contains DUPLICATE / DELETED / DEAD
 *
 * NOTE: VIP bookings (is_vip = true) are NO LONGER excluded. VIP-source
 * intros and their sales count toward Studio Scoreboard, Conversion Funnel,
 * Per-Coach, and Per-SA close rates. Operational queues (MyDay, Follow-Up,
 * Questionnaire Hub) still filter VIP via shouldExcludeVipFromFunnel.
 */
export function isBookingExcludedFromMetrics(b: any): boolean {
  if (!b) return true;
  if (b.ignore_from_metrics) return true;
  if (b.deleted_at) return true;
  const status = (b.booking_status_canon || '').toUpperCase();
  if (status === 'DELETED_SOFT') return true;
  if (status === 'RESCHEDULED') return true; // superseded by a later booking
  if (status.includes('DUPLICATE') || status.includes('DELETED') || status.includes('DEAD')) return true;
  return false;
}
