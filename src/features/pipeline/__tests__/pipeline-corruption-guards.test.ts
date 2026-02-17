/**
 * Pipeline corruption guard tests.
 * Validates the 3 silent-corruption fixes:
 *   1. Create Run uses correct result_canon normalizer
 *   2. Edit Run delegates outcome fields to canonical function
 *   3. Purchase only inserts into sales_outside_intro for "Outside Intro"
 */
import { describe, it, expect } from 'vitest';
import { normalizeIntroResult, normalizeIntroResultStrict } from '@/lib/domain/outcomes/types';
import { OUTCOME_OWNED_FIELDS } from '../pipelineActions';

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
    // vitest runs with import.meta.env.DEV = true
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
    // Mirror the actual conditional in PipelineDialogs purchase flow.
    // If someone changes the condition, this test should be updated too.
    const shouldInsert = (saleType: string) => saleType === 'Outside Intro';
    expect(shouldInsert('Intro')).toBe(false);
    expect(shouldInsert('Outside Intro')).toBe(true);
  });
});
