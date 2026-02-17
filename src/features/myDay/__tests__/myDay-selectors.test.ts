/**
 * Tests for My Day selectors: risk scoring, sorting, bulk filtering.
 */
import { describe, it, expect } from 'vitest';
import {
  computeRiskFlags,
  computeRiskScore,
  sortRiskFirst,
  filterNoQ,
  filterUnconfirmed24h,
  filterMissingOwner,
  getSuggestedFocus,
  enrichWithRisk,
} from '../myDaySelectors';
import type { UpcomingIntroItem } from '../myDayTypes';

function makeItem(overrides: Partial<UpcomingIntroItem> = {}): UpcomingIntroItem {
  return {
    bookingId: 'b1',
    memberName: 'Test User',
    classDate: '2026-02-18',
    introTime: '10:00',
    coachName: 'Coach A',
    introOwner: 'SA1',
    introOwnerLocked: false,
    phone: '555-1234',
    email: null,
    leadSource: 'Manual',
    isVip: false,
    vipClassName: null,
    questionnaireStatus: 'Q_COMPLETED',
    qSentAt: null,
    qCompletedAt: null,
    confirmedAt: '2026-02-17T12:00:00Z',
    hasLinkedRun: false,
    latestRunResult: null,
    latestRunAt: null,
    originatingBookingId: null,
    isSecondIntro: false,
    timeStartISO: '2026-02-18T10:00',
    riskFlags: { noQ: false, qIncomplete: false, unconfirmed: false, coachTbd: false, missingOwner: false },
    riskScore: 0,
    ...overrides,
  };
}

describe('computeRiskScore', () => {
  it('returns 0 for fully prepped item', () => {
    const flags = computeRiskFlags(makeItem(), '2026-02-17T12:00:00Z');
    expect(computeRiskScore(flags)).toBe(0);
  });

  it('noQ adds 100', () => {
    const flags = computeRiskFlags(makeItem({ questionnaireStatus: 'NO_Q' }), '2026-02-17T12:00:00Z');
    expect(flags.noQ).toBe(true);
    expect(computeRiskScore(flags)).toBeGreaterThanOrEqual(100);
  });

  it('qIncomplete adds 70', () => {
    const flags = computeRiskFlags(makeItem({ questionnaireStatus: 'Q_SENT' }), '2026-02-17T12:00:00Z');
    expect(flags.qIncomplete).toBe(true);
    expect(computeRiskScore(flags)).toBeGreaterThanOrEqual(70);
  });

  it('coachTbd adds 20', () => {
    const flags = computeRiskFlags(makeItem({ coachName: 'TBD' }), '2026-02-17T12:00:00Z');
    expect(flags.coachTbd).toBe(true);
    expect(computeRiskScore(flags)).toBeGreaterThanOrEqual(20);
  });

  it('missingOwner adds 15', () => {
    const flags = computeRiskFlags(makeItem({ introOwner: '' }), '2026-02-17T12:00:00Z');
    expect(flags.missingOwner).toBe(true);
    expect(computeRiskScore(flags)).toBeGreaterThanOrEqual(15);
  });
});

describe('sortRiskFirst', () => {
  it('sorts NO_Q items before Q_COMPLETED', () => {
    const now = '2026-02-17T12:00:00Z';
    const items = [
      makeItem({ bookingId: 'ok', questionnaireStatus: 'Q_COMPLETED' }),
      makeItem({ bookingId: 'noq', questionnaireStatus: 'NO_Q' }),
    ];
    const enriched = enrichWithRisk(items, now);
    const sorted = sortRiskFirst(enriched);
    expect(sorted[0].bookingId).toBe('noq');
  });

  it('sorts Q_SENT before Q_COMPLETED but after NO_Q', () => {
    const now = '2026-02-17T12:00:00Z';
    const items = [
      makeItem({ bookingId: 'done', questionnaireStatus: 'Q_COMPLETED' }),
      makeItem({ bookingId: 'sent', questionnaireStatus: 'Q_SENT' }),
      makeItem({ bookingId: 'noq', questionnaireStatus: 'NO_Q' }),
    ];
    const enriched = enrichWithRisk(items, now);
    const sorted = sortRiskFirst(enriched);
    expect(sorted[0].bookingId).toBe('noq');
    expect(sorted[1].bookingId).toBe('sent');
    expect(sorted[2].bookingId).toBe('done');
  });

  it('within same risk, sorts by date then time', () => {
    const now = '2026-02-17T12:00:00Z';
    const items = [
      makeItem({ bookingId: 'b', classDate: '2026-02-19', introTime: '09:00' }),
      makeItem({ bookingId: 'a', classDate: '2026-02-18', introTime: '14:00' }),
    ];
    const enriched = enrichWithRisk(items, now);
    const sorted = sortRiskFirst(enriched);
    expect(sorted[0].bookingId).toBe('a');
  });
});

describe('bulk filtering', () => {
  it('filterNoQ only returns NO_Q items', () => {
    const items = [
      makeItem({ bookingId: 'noq', questionnaireStatus: 'NO_Q' }),
      makeItem({ bookingId: 'sent', questionnaireStatus: 'Q_SENT' }),
      makeItem({ bookingId: 'done', questionnaireStatus: 'Q_COMPLETED' }),
    ];
    const result = filterNoQ(items);
    expect(result).toHaveLength(1);
    expect(result[0].bookingId).toBe('noq');
  });

  it('filterMissingOwner only returns items without owner', () => {
    const items = [
      makeItem({ bookingId: 'has', introOwner: 'SA1' }),
      makeItem({ bookingId: 'missing', introOwner: null }),
      makeItem({ bookingId: 'empty', introOwner: '' }),
    ];
    const result = filterMissingOwner(items);
    expect(result).toHaveLength(2);
  });

  it('filterUnconfirmed24h only returns unconfirmed within 24h', () => {
    const now = '2026-02-17T12:00:00Z';
    const items = [
      makeItem({ bookingId: 'confirmed', confirmedAt: '2026-02-17T10:00:00Z', timeStartISO: '2026-02-18T09:00' }),
      makeItem({ bookingId: 'unconfirmed_near', confirmedAt: null, timeStartISO: '2026-02-18T08:00' }),
      makeItem({ bookingId: 'unconfirmed_far', confirmedAt: null, timeStartISO: '2026-02-25T08:00' }),
    ];
    const result = filterUnconfirmed24h(items, now);
    expect(result).toHaveLength(1);
    expect(result[0].bookingId).toBe('unconfirmed_near');
  });
});

describe('getSuggestedFocus', () => {
  it('returns celebration when no risks', () => {
    const items = [makeItem()];
    const enriched = enrichWithRisk(items, '2026-02-17T12:00:00Z');
    expect(getSuggestedFocus(enriched)).toContain('All prepped');
  });

  it('suggests sending Qs when that is the biggest bucket', () => {
    const items = [
      makeItem({ bookingId: '1', questionnaireStatus: 'NO_Q' }),
      makeItem({ bookingId: '2', questionnaireStatus: 'NO_Q' }),
    ];
    const enriched = enrichWithRisk(items, '2026-02-17T12:00:00Z');
    expect(getSuggestedFocus(enriched)).toContain('questionnaire');
  });
});
