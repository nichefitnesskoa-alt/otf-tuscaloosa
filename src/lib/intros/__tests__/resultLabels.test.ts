import { describe, it, expect } from 'vitest';
import { labelForRun, isCloseResult, isSaleCanon, isFollowUpCanon, isPlanning2ndCanon } from '../resultLabels';

// Each row: [result_canon, result, expectedLabel, expectedClose]
const cases: Array<[string | null, string, string, boolean]> = [
  ['SALE', 'Premier', 'SALE', true],
  ['PREMIER', 'Premier', 'SALE', true],
  ['PREMIER_OTBEAT', 'Premier + OTbeat', 'SALE', true],
  ['ELITE', 'Elite', 'SALE', true],
  ['BASIC', 'Basic', 'SALE', true],
  ['SECOND_INTRO_SCHEDULED', '', 'Booked 2nd', false],
  ['PLANNING_2ND_INTRO', '', 'Booked 2nd', false],
  ['PLANNING_2ND', '', 'Booked 2nd', false],
  ['FOLLOW_UP_NEEDED', '', 'Follow-Up', false],
  ['FOLLOW_UP', '', 'Follow-Up', false],
  ['PLANNING_TO_BUY', '', 'Planning to Buy', false],
  ['ON_5_CLASS_PACK', '5 class pack', '5 Class Pack', false],
  ['NOT_INTERESTED', '', 'Showed Up - Not Interested', false],
  ['NO_SHOW', '', 'No Show', false],
  ['VIP_CLASS_INTRO', '', 'VIP Intro', false],
  ['UNRESOLVED', '', 'Unresolved', false],
  // Fallback paths
  [null, 'Premier + OTbeat', 'SALE', true],
  [null, '', '—', false],
];

describe('labelForRun + isCloseResult — canon coverage', () => {
  for (const [rc, result, label, close] of cases) {
    it(`canon=${rc ?? 'null'} result="${result}" → label "${label}", close=${close}`, () => {
      const r = { result_canon: rc, result };
      expect(labelForRun(r)).toBe(label);
      expect(isCloseResult(r)).toBe(close);
    });
  }
});

describe('canon predicates', () => {
  it('isSaleCanon covers all sale variants', () => {
    ['SALE', 'PREMIER', 'PREMIER_OTBEAT', 'ELITE', 'BASIC'].forEach(c => {
      expect(isSaleCanon(c)).toBe(true);
      expect(isSaleCanon(c.toLowerCase())).toBe(true);
    });
    expect(isSaleCanon('PLANNING_TO_BUY')).toBe(false);
    expect(isSaleCanon(null)).toBe(false);
    expect(isSaleCanon(undefined)).toBe(false);
  });
  it('isFollowUpCanon covers both variants', () => {
    expect(isFollowUpCanon('FOLLOW_UP')).toBe(true);
    expect(isFollowUpCanon('FOLLOW_UP_NEEDED')).toBe(true);
    expect(isFollowUpCanon('NOT_INTERESTED')).toBe(false);
  });
  it('isPlanning2ndCanon covers all 2nd-intro variants', () => {
    expect(isPlanning2ndCanon('PLANNING_2ND')).toBe(true);
    expect(isPlanning2ndCanon('PLANNING_2ND_INTRO')).toBe(true);
    expect(isPlanning2ndCanon('SECOND_INTRO_SCHEDULED')).toBe(true);
    expect(isPlanning2ndCanon('SALE')).toBe(false);
  });
});
