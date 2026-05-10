import { describe, it, expect } from 'vitest';
import { walkJourneyChain } from '../journey';

describe('walkJourneyChain', () => {
  it('captures direct sale on root', () => {
    const bookings = [{ id: 'r1' }];
    const runs = [{ linked_intro_booked_id: 'r1', result_canon: 'PREMIER', result: 'Premier' }];
    const c = walkJourneyChain('r1', bookings, runs);
    expect(c.isClosed).toBe(true);
    expect(c.isDirectClose).toBe(true);
    expect(c.isJourneyClose).toBe(false);
    expect(c.soldBookings).toHaveLength(1);
    expect(c.secondIntros).toHaveLength(0);
  });

  it('captures journey sale via 2nd intro child', () => {
    const bookings = [
      { id: 'r1' },
      { id: 'c1', originating_booking_id: 'r1' },
    ];
    const runs = [
      { linked_intro_booked_id: 'r1', result_canon: 'SECOND_INTRO_SCHEDULED', result: 'Booked 2nd intro' },
      { linked_intro_booked_id: 'c1', result_canon: 'PREMIER', result: 'Premier' },
    ];
    const c = walkJourneyChain('r1', bookings, runs);
    expect(c.isClosed).toBe(true);
    expect(c.isDirectClose).toBe(false);
    expect(c.isJourneyClose).toBe(true);
    expect(c.secondIntros.map(b => b.id)).toEqual(['c1']);
    expect(c.ranBookings.map(b => b.id).sort()).toEqual(['c1', 'r1']);
  });

  it('excludes soft-deleted children from chain', () => {
    const bookings = [
      { id: 'r1' },
      { id: 'c1', originating_booking_id: 'r1', deleted_at: '2026-01-01' },
    ];
    const runs = [
      { linked_intro_booked_id: 'c1', result_canon: 'PREMIER', result: 'Premier' },
    ];
    const c = walkJourneyChain('r1', bookings, runs);
    expect(c.secondIntros).toHaveLength(0);
    expect(c.isClosed).toBe(false);
  });

  it('treats no-show runs as not ran', () => {
    const bookings = [{ id: 'r1' }];
    const runs = [{ linked_intro_booked_id: 'r1', result_canon: 'NO_SHOW', result: 'No-show' }];
    const c = walkJourneyChain('r1', bookings, runs);
    expect(c.ranBookings).toHaveLength(0);
    expect(c.isClosed).toBe(false);
  });

  it('handles missing root gracefully', () => {
    const c = walkJourneyChain('missing', [], []);
    expect(c.rootBooking).toBeNull();
    expect(c.allBookings).toHaveLength(0);
    expect(c.isClosed).toBe(false);
  });
});
