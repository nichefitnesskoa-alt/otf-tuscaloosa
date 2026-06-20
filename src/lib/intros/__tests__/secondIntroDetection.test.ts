import { describe, it, expect } from 'vitest';
import {
  isSecondIntroBooking,
  type SecondIntroBookingLike,
  type SecondIntroRunLike,
} from '../secondIntroDetection';

const mkBooking = (overrides: Partial<SecondIntroBookingLike>): SecondIntroBookingLike => ({
  id: 'child',
  member_name: 'Maliyah Grant',
  originating_booking_id: null,
  referred_by_member_name: null,
  booking_status_canon: 'ACTIVE',
  is_vip: false,
  ignore_from_metrics: false,
  deleted_at: null,
  ...overrides,
});

describe('isSecondIntroBooking — canonical', () => {
  it('returns false when no originating_booking_id', () => {
    const child = mkBooking({ id: 'c1' });
    expect(isSecondIntroBooking(child, [child], [])).toBe(false);
  });

  it('returns false for friend bookings (referred_by_member_name set)', () => {
    const parent = mkBooking({ id: 'p1', member_name: 'Friend' });
    const child = mkBooking({ id: 'c1', originating_booking_id: 'p1', referred_by_member_name: 'Friend' });
    expect(isSecondIntroBooking(child, [child, parent], [])).toBe(false);
  });

  it('returns false when parent missing from list (orphan)', () => {
    const child = mkBooking({ id: 'c1', originating_booking_id: 'missing' });
    expect(isSecondIntroBooking(child, [child], [])).toBe(false);
  });

  it('returns false when parent has no run yet (parent intro not yet happened)', () => {
    const parent = mkBooking({ id: 'p1' });
    const child = mkBooking({ id: 'c1', originating_booking_id: 'p1' });
    expect(isSecondIntroBooking(child, [child, parent], [])).toBe(false);
  });

  it('returns false when parent status is ACTIVE but run was NO_SHOW (Maliyah case)', () => {
    const parent = mkBooking({ id: 'p1', booking_status_canon: 'ACTIVE' });
    const child = mkBooking({ id: 'c1', originating_booking_id: 'p1' });
    const runs: SecondIntroRunLike[] = [
      { linked_intro_booked_id: 'p1', result: 'No-show', result_canon: 'NO_SHOW' },
    ];
    expect(isSecondIntroBooking(child, [child, parent], runs)).toBe(false);
  });

  it('returns true when parent SHOWED with a real run', () => {
    const parent = mkBooking({ id: 'p1', booking_status_canon: 'SHOWED' });
    const child = mkBooking({ id: 'c1', originating_booking_id: 'p1' });
    const runs: SecondIntroRunLike[] = [
      { linked_intro_booked_id: 'p1', result: "Didn't Buy", result_canon: 'DIDNT_BUY' },
    ];
    expect(isSecondIntroBooking(child, [child, parent], runs)).toBe(true);
  });

  it('returns false when parent is soft-deleted', () => {
    const parent = mkBooking({ id: 'p1', deleted_at: '2026-06-19T00:00:00Z' });
    const child = mkBooking({ id: 'c1', originating_booking_id: 'p1' });
    expect(isSecondIntroBooking(child, [child, parent], [])).toBe(false);
  });

  it('returns false when parent is CANCELLED (non-ran status)', () => {
    const parent = mkBooking({ id: 'p1', booking_status_canon: 'CANCELLED' });
    const child = mkBooking({ id: 'c1', originating_booking_id: 'p1' });
    expect(isSecondIntroBooking(child, [child, parent], [])).toBe(false);
  });

  it('returns false when parent belongs to a different member (chain misuse)', () => {
    const parent = mkBooking({ id: 'p1', member_name: 'Someone Else' });
    const child = mkBooking({ id: 'c1', originating_booking_id: 'p1', member_name: 'Maliyah Grant' });
    const runs: SecondIntroRunLike[] = [
      { linked_intro_booked_id: 'p1', result: "Didn't Buy", result_canon: 'DIDNT_BUY' },
    ];
    expect(isSecondIntroBooking(child, [child, parent], runs)).toBe(false);
  });
});
