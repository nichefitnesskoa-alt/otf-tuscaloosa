import { describe, it, expect } from 'vitest';
import { computeFunnelBothRows } from '../ConversionFunnel';

/**
 * Alexa Brodsky regression: deleted original + deleted phantom child + deleted
 * phantom run + active May 4 sale child + a real May 1 "Booked 2nd intro" run
 * still linked to the deleted original. The funnel must collapse the chain
 * into 1 ran / 1 sold (matching Studio Scoreboard / Per-SA), not 2 ran.
 */
describe('computeFunnelBothRows — Alexa orphan-chain regression', () => {
  it('counts a deleted-origin chain with promoted sale child as 1 ran / 1 sold', () => {
    const introsBooked: any[] = [
      {
        id: 'orig-may1',
        member_name: 'Alexa Brodsky',
        class_date: '2026-05-01',
        intro_time: '07:30:00',
        booking_status: 'Deleted (soft)',
        booking_status_canon: 'DELETED_SOFT',
        deleted_at: '2026-05-09T00:00:00Z',
        originating_booking_id: null,
      },
      {
        id: 'phantom-may1',
        member_name: 'Alexa Brodsky',
        class_date: '2026-05-01',
        intro_time: '07:30:00',
        booking_status: 'Deleted (soft)',
        booking_status_canon: 'DELETED_SOFT',
        deleted_at: '2026-05-09T00:00:00Z',
        originating_booking_id: 'orig-may1',
      },
      {
        id: 'sale-may4',
        member_name: 'Alexa Brodsky',
        class_date: '2026-05-04',
        intro_time: '06:15:00',
        booking_status: 'Closed – Bought',
        booking_status_canon: 'CLOSED_PURCHASED',
        originating_booking_id: 'orig-may1',
      },
    ];

    const introsRun: any[] = [
      {
        id: 'run-may1-real',
        member_name: 'Alexa Brodsky',
        run_date: '2026-05-01',
        result: 'Booked 2nd intro',
        result_canon: 'SECOND_INTRO_SCHEDULED',
        linked_intro_booked_id: 'orig-may1',
        created_at: '2026-05-01T13:41:20Z',
      },
      {
        id: 'run-may1-phantom',
        member_name: 'Alexa Brodsky',
        run_date: '2026-05-01',
        result: 'Deleted',
        result_canon: 'DELETED',
        linked_intro_booked_id: 'phantom-may1',
        commission_amount: 0,
        created_at: '2026-05-01T22:51:15Z',
      },
      {
        id: 'run-may4-sale',
        member_name: 'Alexa Brodsky',
        run_date: '2026-05-04',
        buy_date: '2026-05-04',
        result: 'Premier',
        result_canon: 'PREMIER',
        linked_intro_booked_id: 'sale-may4',
        commission_amount: 7.5,
        created_at: '2026-05-04T11:21:40Z',
      },
    ];

    const dateRange = {
      start: new Date(2026, 3, 27, 0, 0, 0), // Apr 27 2026
      end: new Date(2026, 4, 10, 23, 59, 59), // May 10 2026
    } as any;

    const { first, second } = computeFunnelBothRows(introsBooked, introsRun, dateRange);

    // Chain collapses to a single first-intro journey.
    expect(first.booked).toBe(1);
    expect(first.showed).toBe(1);
    expect(first.sold).toBe(1);
    expect(second.booked).toBe(0);
    expect(second.showed).toBe(0);
    expect(second.sold).toBe(0);
  });
});

/**
 * Same-period 1st + 2nd intro for one person must both count.
 * Studio Scoreboard counts every 1st intro that ran; the Funnel 1st row
 * must agree. (Previously the funnel suppressed the 1st row entry to
 * avoid double-counting the person across rows — that hid real ran
 * intros and made the Scoreboard and Funnel disagree by 1.)
 */
describe('computeFunnelBothRows — 1st intro counts even when 2nd has happened in range', () => {
  it('keeps the 1st-intro entry in the 1st row and counts the 2nd in the 2nd row', () => {
    const introsBooked: any[] = [
      {
        id: 'first-may1',
        member_name: 'Test Person',
        class_date: '2026-05-01',
        intro_time: '07:30:00',
        booking_status: 'Showed',
        booking_status_canon: 'SHOWED',
        originating_booking_id: null,
      },
      {
        id: 'second-may5',
        member_name: 'Test Person',
        class_date: '2026-05-05',
        intro_time: '06:15:00',
        booking_status: 'Showed',
        booking_status_canon: 'SHOWED',
        originating_booking_id: 'first-may1',
      },
    ];

    const introsRun: any[] = [
      {
        id: 'run-first',
        member_name: 'Test Person',
        run_date: '2026-05-01',
        result: 'Booked 2nd intro',
        result_canon: 'SECOND_INTRO_SCHEDULED',
        linked_intro_booked_id: 'first-may1',
        created_at: '2026-05-01T13:41:20Z',
      },
      {
        id: 'run-second',
        member_name: 'Test Person',
        run_date: '2026-05-05',
        result: 'Follow-up needed',
        result_canon: 'FOLLOW_UP',
        linked_intro_booked_id: 'second-may5',
        created_at: '2026-05-05T13:41:20Z',
      },
    ];

    const dateRange = {
      start: new Date(2026, 3, 27, 0, 0, 0),
      end: new Date(2026, 4, 10, 23, 59, 59),
    } as any;

    const { first, second } = computeFunnelBothRows(introsBooked, introsRun, dateRange);

    expect(first.booked).toBe(1);
    expect(first.showed).toBe(1);
    expect(first.sold).toBe(0);
    expect(second.booked).toBe(1);
    expect(second.showed).toBe(1);
    expect(second.sold).toBe(0);
  });
});
