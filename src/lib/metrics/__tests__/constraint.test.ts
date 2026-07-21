import { describe, it, expect } from 'vitest';
import {
  isContactActivity,
  computeSpeedToLeadMedianMin,
  computeBookingRate,
  computeShowRate,
  weekStartCentral,
  weekEndCentral,
} from '../constraint';

describe('constraint metrics', () => {
  it('isContactActivity: recognizes explicit types + stage_change contacted', () => {
    expect(isContactActivity({ activity_type: 'call' })).toBe(true);
    expect(isContactActivity({ activity_type: 'text' })).toBe(true);
    expect(isContactActivity({ activity_type: 'stage_change', new_stage: 'contacted' })).toBe(true);
    expect(isContactActivity({ activity_type: 'stage_change', notes: 'Marked contacted via MyDay' })).toBe(true);
    expect(isContactActivity({ activity_type: 'note' })).toBe(false);
    expect(isContactActivity({ activity_type: 'stage_change', new_stage: 'booked' })).toBe(false);
  });

  it('computeSpeedToLeadMedianMin: median of first-contact deltas', () => {
    const leads = [
      { id: 'a', created_at: '2026-06-01T10:00:00Z' },
      { id: 'b', created_at: '2026-06-01T10:00:00Z' },
      { id: 'c', created_at: '2026-06-01T10:00:00Z' },
    ];
    const activities = [
      { lead_id: 'a', activity_type: 'call', created_at: '2026-06-01T10:05:00Z' }, // 5m
      { lead_id: 'a', activity_type: 'text', created_at: '2026-06-01T10:20:00Z' }, // dupe, ignored
      { lead_id: 'b', activity_type: 'text', created_at: '2026-06-01T10:15:00Z' }, // 15m
      { lead_id: 'c', activity_type: 'email', created_at: '2026-06-01T10:30:00Z' }, // 30m
    ];
    expect(computeSpeedToLeadMedianMin(leads as any, activities as any)).toBe(15);
  });

  it('computeBookingRate: counts booked_intro_id + stage booked/won', () => {
    const r = computeBookingRate([
      { id: '1', created_at: '', booked_intro_id: 'x' },
      { id: '2', created_at: '', stage: 'booked' },
      { id: '3', created_at: '', stage: 'new' },
      { id: '4', created_at: '', stage: 'won' },
    ] as any);
    expect(r.booked).toBe(3);
    expect(r.total).toBe(4);
    expect(r.pct).toBe(75);
  });

  it('computeShowRate: uses didIntroActuallyRun', () => {
    const range = { start: new Date(2026, 5, 1), end: new Date(2026, 5, 30, 23, 59, 59) };
    const bookings = [
      { id: 'b1', class_date: '2026-06-10', booking_status_canon: 'ACTIVE', booking_type_canon: 'STANDARD' },
      { id: 'b2', class_date: '2026-06-11', booking_status_canon: 'CANCELLED', booking_type_canon: 'STANDARD' },
      { id: 'b3', class_date: '2026-06-12', booking_status_canon: 'ACTIVE', booking_type_canon: 'STANDARD' },
    ];
    const runs = [
      { linked_intro_booked_id: 'b1', result_canon: 'SALE' },
      { linked_intro_booked_id: 'b3', result_canon: 'NO_SHOW' },
    ];
    const r = computeShowRate(bookings as any, runs as any, range);
    expect(r.total).toBe(2);   // b2 excluded (cancelled)
    expect(r.shown).toBe(1);   // b1 shown, b3 no-show
    expect(r.pct).toBe(50);
  });

  it('weekStartCentral: Monday anchor across Sun/Mon boundary', () => {
    // Sunday 11pm CST → still previous Mon
    const sunLate = new Date(2026, 6, 19, 23, 0, 0); // Sun Jul 19, 2026
    const ws1 = weekStartCentral(sunLate);
    expect(ws1.getDay()).toBe(1); // Monday
    expect(ws1.getDate()).toBe(13); // Mon Jul 13
    // Monday 1am → same Mon
    const monEarly = new Date(2026, 6, 20, 1, 0, 0);
    const ws2 = weekStartCentral(monEarly);
    expect(ws2.getDay()).toBe(1);
    expect(ws2.getDate()).toBe(20);
    // Week end = Sunday 23:59
    const we = weekEndCentral(ws2);
    expect(we.getDay()).toBe(0);
    expect(we.getDate()).toBe(26);
  });
});
