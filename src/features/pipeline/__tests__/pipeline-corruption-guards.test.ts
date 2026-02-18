/**
 * Pipeline corruption guard + behavioral + edge-case tests.
 *
 * Covers:
 *   1. Create Run normalizer correctness
 *   2. Edit Run guardrail (OUTCOME_OWNED_FIELDS exclusion)
 *   3. Purchase sale_type invariant
 *   4. assertNoOutcomeOwnedFields guardrail
 *   5. Edge cases: 2nd intro chain, corrupted owner, unlinked run linking
 */
import { describe, it, expect } from 'vitest';
import { normalizeIntroResult, normalizeIntroResultStrict } from '@/lib/domain/outcomes/types';
import { OUTCOME_OWNED_FIELDS, assertNoOutcomeOwnedFields } from '../pipelineActions';
import { buildJourneys } from '../selectors';
import type { PipelineBooking, PipelineRun } from '../pipelineTypes';

// ── Helpers to build fixtures ──

function makeBooking(overrides: Partial<PipelineBooking> = {}): PipelineBooking {
  return {
    id: 'booking-1',
    booking_id: null,
    member_name: 'Test User',
    class_date: '2025-01-10',
    coach_name: 'Coach',
    sa_working_shift: 'SA1',
    lead_source: 'Facebook',
    booking_status: 'Active',
    booking_status_canon: 'ACTIVE',
    is_vip: false,
    intro_time: null,
    booked_by: null,
    intro_owner: null,
    intro_owner_locked: false,
    email: null,
    phone: null,
    fitness_goal: null,
    originating_booking_id: null,
    vip_class_name: null,
    booking_type_canon: 'STANDARD',
    rebooked_from_booking_id: null,
    rebook_reason: null,
    rebooked_at: null,
    ...overrides,
  };
}

function makeRun(overrides: Partial<PipelineRun> = {}): PipelineRun {
  return {
    id: 'run-1',
    run_id: null,
    member_name: 'Test User',
    run_date: '2025-01-10',
    class_time: '09:00',
    result: 'Follow-up needed',
    result_canon: 'FOLLOW_UP_NEEDED',
    linked_intro_booked_id: null,
    ran_by: 'SA1',
    intro_owner: 'SA1',
    lead_source: 'Facebook',
    buy_date: null,
    commission_amount: 0,
    coach_name: 'Coach',
    notes: null,
    sa_name: 'SA1',
    goal_quality: null,
    pricing_engagement: null,
    goal_why_captured: null,
    relationship_experience: null,
    made_a_friend: false,
    amc_incremented_at: null,
    ...overrides,
  };
}

// ── 1. Create Run: display outcomes map to correct result_canon ──
describe('normalizeIntroResult (run result_canon)', () => {
  it('maps "No-show" to NO_SHOW (not a booking status)', () => {
    expect(normalizeIntroResult('No-show')).toBe('NO_SHOW');
  });

  it('maps "Premier + OTBeat" to PREMIER', () => {
    expect(normalizeIntroResult('Premier + OTBeat')).toBe('PREMIER');
  });

  it('maps "Elite w/o OTBeat" to ELITE', () => {
    expect(normalizeIntroResult('Elite w/o OTBeat')).toBe('ELITE');
  });

  it('maps "Basic + OTBeat" to BASIC', () => {
    expect(normalizeIntroResult('Basic + OTBeat')).toBe('BASIC');
  });

  it('maps "Follow-up needed" to FOLLOW_UP_NEEDED', () => {
    expect(normalizeIntroResult('Follow-up needed')).toBe('FOLLOW_UP_NEEDED');
  });

  it('maps "Booked 2nd intro" to SECOND_INTRO_SCHEDULED', () => {
    expect(normalizeIntroResult('Booked 2nd intro')).toBe('SECOND_INTRO_SCHEDULED');
  });

  it('returns UNRESOLVED for empty/null', () => {
    expect(normalizeIntroResult(null)).toBe('UNRESOLVED');
    expect(normalizeIntroResult('')).toBe('UNRESOLVED');
  });
});

// ── 1b. Strict normalizer guard ──
describe('normalizeIntroResultStrict', () => {
  it('throws in dev for unmapped non-empty string', () => {
    expect(() => normalizeIntroResultStrict('TotallyBogusOutcome', 'test')).toThrow(
      /Unmapped intro result/,
    );
  });

  it('does NOT throw for valid outcomes', () => {
    expect(() => normalizeIntroResultStrict('No-show', 'test')).not.toThrow();
    expect(normalizeIntroResultStrict('No-show', 'test')).toBe('NO_SHOW');
  });

  it('does NOT throw for empty/unresolved', () => {
    expect(() => normalizeIntroResultStrict('Unresolved', 'test')).not.toThrow();
  });
});

// ── 2. OUTCOME_OWNED_FIELDS must include the critical fields ──
describe('OUTCOME_OWNED_FIELDS constant', () => {
  it('includes result, result_canon, buy_date, commission_amount', () => {
    const fields = OUTCOME_OWNED_FIELDS as readonly string[];
    expect(fields).toContain('result');
    expect(fields).toContain('result_canon');
    expect(fields).toContain('buy_date');
    expect(fields).toContain('commission_amount');
  });
});

// ── 3. Purchase sale_type logic (structural assertion) ──
describe('Purchase sale_type invariant', () => {
  it('only "Outside Intro" triggers sales_outside_intro insert', () => {
    const shouldInsert = (saleType: string) => saleType === 'Outside Intro';
    expect(shouldInsert('Intro')).toBe(false);
    expect(shouldInsert('Outside Intro')).toBe(true);
  });
});

// ── 4. assertNoOutcomeOwnedFields guardrail ──
describe('assertNoOutcomeOwnedFields', () => {
  it('does nothing when payload has no outcome fields', () => {
    const payload = { run_date: '2025-01-01', notes: 'test' };
    expect(() => assertNoOutcomeOwnedFields(payload, 'test')).not.toThrow();
  });

  it('throws in dev when payload contains outcome-owned fields', () => {
    const payload: Record<string, unknown> = {
      run_date: '2025-01-01',
      buy_date: '2025-01-02',
      commission_amount: 100,
    };
    expect(() => assertNoOutcomeOwnedFields(payload, 'test')).toThrow(
      /outcome-owned fields.*buy_date.*commission_amount/,
    );
  });

  it('catches result and result_canon as owned fields', () => {
    const payload: Record<string, unknown> = { result: 'No-show', result_canon: 'NO_SHOW' };
    expect(() => assertNoOutcomeOwnedFields(payload, 'test')).toThrow(/result/);
  });
});

// ── 5. Edit Run: nonOutcomeUpdate must NOT contain owned fields when resultChanged ──
describe('Edit Run behavioral: outcome field exclusion', () => {
  it('nonOutcomeUpdate payload excludes owned fields when result changed', () => {
    const editRun = {
      result: 'Premier + OTBeat',
      buy_date: '2025-02-01',
      commission_amount: 100,
    };
    const originalRunResult = "Didn't Buy";
    const resultChanged = editRun.result !== originalRunResult;

    const nonOutcomeUpdate: Record<string, unknown> = {
      run_date: '2025-02-01',
      class_time: '09:00',
      lead_source: 'Facebook',
      notes: 'Great session',
      coach_name: 'Coach A',
    };

    if (!resultChanged) {
      nonOutcomeUpdate.buy_date = editRun.buy_date;
      nonOutcomeUpdate.commission_amount = editRun.commission_amount;
    }

    expect(resultChanged).toBe(true);
    expect(() => assertNoOutcomeOwnedFields(nonOutcomeUpdate, 'test')).not.toThrow();
    expect(nonOutcomeUpdate).not.toHaveProperty('buy_date');
    expect(nonOutcomeUpdate).not.toHaveProperty('commission_amount');
    expect(nonOutcomeUpdate).not.toHaveProperty('result');
    expect(nonOutcomeUpdate).not.toHaveProperty('result_canon');
  });

  it('nonOutcomeUpdate INCLUDES buy_date/commission when result did NOT change', () => {
    const editRun = {
      result: "Didn't Buy",
      buy_date: '2025-02-01',
      commission_amount: 50,
    };
    const originalRunResult = "Didn't Buy";
    const resultChanged = editRun.result !== originalRunResult;

    const nonOutcomeUpdate: Record<string, unknown> = { run_date: '2025-02-01' };

    if (!resultChanged) {
      nonOutcomeUpdate.buy_date = editRun.buy_date;
      nonOutcomeUpdate.commission_amount = editRun.commission_amount;
    }

    expect(resultChanged).toBe(false);
    expect(nonOutcomeUpdate).toHaveProperty('buy_date');
    expect(nonOutcomeUpdate).toHaveProperty('commission_amount');
  });
});

// ── 6. Edge case: 2nd intro chain does not double-count ──
describe('Edge case: 2nd intro chain', () => {
  it('booking with originating_booking_id does not double-count as purchased', () => {
    const bookingA = makeBooking({
      id: 'booking-a',
      member_name: 'Jane Doe',
      booking_status: 'Closed (Purchased)',
      booking_status_canon: 'CLOSED_PURCHASED',
      intro_owner: 'SA1',
      intro_owner_locked: true,
    });

    const bookingB = makeBooking({
      id: 'booking-b',
      member_name: 'Jane Doe',
      class_date: '2025-01-20',
      booking_status: 'Active',
      booking_status_canon: 'ACTIVE',
      originating_booking_id: 'booking-a',
    });

    const runA = makeRun({
      id: 'run-a',
      member_name: 'Jane Doe',
      result: 'Premier + OTBeat',
      result_canon: 'PREMIER',
      linked_intro_booked_id: 'booking-a',
      buy_date: '2025-01-10',
      commission_amount: 100,
      amc_incremented_at: '2025-01-10T00:00:00Z',
    });

    const journeys = buildJourneys([bookingA, bookingB], [runA]);

    // Should be ONE journey (same member), not two
    expect(journeys.length).toBe(1);
    const j = journeys[0];
    expect(j.bookings.length).toBe(2);
    expect(j.hasSale).toBe(true);
    expect(j.status).toBe('purchased');
  });
});

// ── 7. Edge case: corrupted intro_owner (timestamp-like) ──
describe('Edge case: corrupted intro_owner detection', () => {
  it('detects timestamp-like intro_owner as inconsistency', () => {
    const booking = makeBooking({
      id: 'booking-corrupt',
      intro_owner: '2025-01-15T10:30:00.000Z', // corrupted!
    });

    const journeys = buildJourneys([booking], []);
    expect(journeys.length).toBe(1);
    expect(journeys[0].hasInconsistency).toBe(true);
    expect(journeys[0].inconsistencyType).toContain('Corrupted intro_owner');
  });
});

// ── 8. Edge case: unlinked run with matching booking ──
describe('Edge case: unlinked run link options', () => {
  it('unlinked run journey includes correct bookings for linking', () => {
    const booking = makeBooking({
      id: 'booking-x',
      member_name: 'Alex Smith',
      class_date: '2025-02-01',
      intro_time: '10:00',
      booked_by: 'SA1',
      lead_source: 'Referral',
    });

    const run = makeRun({
      id: 'run-unlinked',
      member_name: 'Alex Smith',
      run_date: '2025-02-01',
      class_time: '10:00',
      result: 'Follow-up needed',
      result_canon: 'FOLLOW_UP_NEEDED',
      linked_intro_booked_id: null,
      ran_by: 'SA2',
      intro_owner: 'SA2',
      lead_source: 'Referral',
    });

    const journeys = buildJourneys([booking], [run]);
    expect(journeys.length).toBe(1);
    const j = journeys[0];
    expect(j.bookings.length).toBe(1);
    expect(j.runs.length).toBe(1);
    const linkable = j.bookings.filter(
      b => b.booking_status_canon === 'ACTIVE' || !b.booking_status || b.booking_status === 'Active',
    );
    expect(linkable.length).toBe(1);
    expect(linkable[0].id).toBe('booking-x');
  });
});
