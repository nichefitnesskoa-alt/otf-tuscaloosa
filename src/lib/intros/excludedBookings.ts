/**
 * Single source of truth for "is this intros_booked row excluded from
 * performance metrics?" Used by WIG, Per-Coach, Per-SA, Booker tables.
 *
 * Excluded if any of:
 *  - is_vip                                  (VIP class intros never count toward standard metrics)
 *  - ignore_from_metrics                     (manual admin override)
 *  - deleted_at IS NOT NULL                  (soft-deleted)
 *  - booking_status_canon = 'DELETED_SOFT'   (canonical soft-delete flag)
 *  - booking_status_canon contains DUPLICATE / DELETED / DEAD
 */
export function isBookingExcludedFromMetrics(b: any): boolean {
  if (!b) return true;
  if (b.is_vip) return true;
  if (b.ignore_from_metrics) return true;
  if (b.deleted_at) return true;
  const status = (b.booking_status_canon || '').toUpperCase();
  if (status === 'DELETED_SOFT') return true;
  if (status === 'RESCHEDULED') return true; // superseded by a later booking
  if (status.includes('DUPLICATE') || status.includes('DELETED') || status.includes('DEAD')) return true;
  return false;
}
