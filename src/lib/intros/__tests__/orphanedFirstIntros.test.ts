import { describe, it, expect } from 'vitest';
import { resolvePromotedOrphanBookingIds } from '../orphanedFirstIntros';

describe('resolvePromotedOrphanBookingIds', () => {
  it('Alexa case: deleted original + follow-up child + sale child → promotes only the sale child', () => {
    const orig = { id: 'orig', booking_status_canon: 'DELETED_SOFT', deleted_at: '2026-05-09T00:00:00Z' };
    const followChild = { id: 'follow', originating_booking_id: 'orig', class_date: '2026-05-01', booking_status_canon: 'ACTIVE' };
    const saleChild = { id: 'sale', originating_booking_id: 'orig', class_date: '2026-05-04', booking_status_canon: 'CLOSED_PURCHASED' };
    const runs = [
      { linked_intro_booked_id: 'follow', result: 'Follow-up needed', result_canon: 'FOLLOW_UP_NEEDED' },
      { linked_intro_booked_id: 'sale',   result: 'Premier',           result_canon: 'PREMIER' },
    ];
    const promoted = resolvePromotedOrphanBookingIds([orig, followChild, saleChild] as any, runs as any);
    expect(promoted.has('sale')).toBe(true);
    expect(promoted.has('follow')).toBe(false);
    expect(promoted.size).toBe(1);
  });

  it('original is healthy → nothing promoted', () => {
    const orig = { id: 'orig', booking_status_canon: 'ACTIVE' };
    const child = { id: 'c', originating_booking_id: 'orig', class_date: '2026-05-04' };
    const promoted = resolvePromotedOrphanBookingIds([orig, child] as any, []);
    expect(promoted.size).toBe(0);
  });

  it('original missing entirely → child is promoted', () => {
    const child = { id: 'c', originating_booking_id: 'gone', class_date: '2026-05-04' };
    const promoted = resolvePromotedOrphanBookingIds([child] as any, []);
    expect(promoted.has('c')).toBe(true);
  });

  it('two ran children, no sale → latest class_date wins', () => {
    const orig = { id: 'orig', booking_status_canon: 'DELETED_SOFT' };
    const a = { id: 'a', originating_booking_id: 'orig', class_date: '2026-05-01' };
    const b = { id: 'b', originating_booking_id: 'orig', class_date: '2026-05-08' };
    const runs = [
      { linked_intro_booked_id: 'a', result: 'Follow-up needed', result_canon: 'FOLLOW_UP_NEEDED' },
      { linked_intro_booked_id: 'b', result: 'Follow-up needed', result_canon: 'FOLLOW_UP_NEEDED' },
    ];
    const promoted = resolvePromotedOrphanBookingIds([orig, a, b] as any, runs as any);
    expect(promoted.has('b')).toBe(true);
    expect(promoted.has('a')).toBe(false);
  });

  it('child that is itself excluded is never promoted', () => {
    const orig = { id: 'orig', booking_status_canon: 'DELETED_SOFT' };
    const child = { id: 'c', originating_booking_id: 'orig', booking_status_canon: 'DELETED_SOFT', deleted_at: '2026-05-09' };
    const promoted = resolvePromotedOrphanBookingIds([orig, child] as any, []);
    expect(promoted.size).toBe(0);
  });

  it('referred-friend bookings are not promoted (they already count via referred_by check)', () => {
    // The resolver itself doesn't know about referred_by — that's handled
    // by callers via isFirstIntroForMetrics. But friend-referrals usually
    // point to a non-excluded original member booking, so the resolver
    // simply skips them. Sanity check: healthy original, no promotion.
    const orig = { id: 'orig', booking_status_canon: 'SHOWED' };
    const friend = { id: 'f', originating_booking_id: 'orig', referred_by_member_name: 'Jane', class_date: '2026-05-04' };
    const promoted = resolvePromotedOrphanBookingIds([orig, friend] as any, []);
    expect(promoted.size).toBe(0);
  });
});
