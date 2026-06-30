import { describe, it, expect } from 'vitest';
import { isBookingExcludedFromMetrics } from '../excludedBookings';

describe('isBookingExcludedFromMetrics', () => {
  it('null/undefined are excluded', () => {
    expect(isBookingExcludedFromMetrics(null)).toBe(true);
    expect(isBookingExcludedFromMetrics(undefined)).toBe(true);
  });
  it('clean booking included', () => {
    expect(isBookingExcludedFromMetrics({ id: '1', booking_status_canon: 'SHOWED' })).toBe(false);
    expect(isBookingExcludedFromMetrics({ id: '1', booking_status_canon: 'ACTIVE' })).toBe(false);
    expect(isBookingExcludedFromMetrics({ id: '1', booking_status_canon: 'NO_SHOW' })).toBe(false);
  });
  it('is_vip is INCLUDED (VIP-sourced intros count toward Studio metrics)', () => {
    expect(isBookingExcludedFromMetrics({ id: '1', is_vip: true })).toBe(false);
  });
  it('ignore_from_metrics excluded', () => {
    expect(isBookingExcludedFromMetrics({ id: '1', ignore_from_metrics: true })).toBe(true);
  });
  it('deleted_at excluded', () => {
    expect(isBookingExcludedFromMetrics({ id: '1', deleted_at: '2026-05-09T03:00:00Z' })).toBe(true);
  });
  it('DELETED_SOFT canon excluded', () => {
    expect(isBookingExcludedFromMetrics({ id: '1', booking_status_canon: 'DELETED_SOFT' })).toBe(true);
  });
  it('canon containing DUPLICATE/DELETED/DEAD excluded', () => {
    expect(isBookingExcludedFromMetrics({ id: '1', booking_status_canon: 'DUPLICATE' })).toBe(true);
    expect(isBookingExcludedFromMetrics({ id: '1', booking_status_canon: 'MARKED_DELETED' })).toBe(true);
    expect(isBookingExcludedFromMetrics({ id: '1', booking_status_canon: 'DEAD_LEAD' })).toBe(true);
  });
  it('case-insensitive canon match', () => {
    expect(isBookingExcludedFromMetrics({ id: '1', booking_status_canon: 'deleted_soft' })).toBe(true);
  });
});
