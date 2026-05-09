import { describe, it, expect } from 'vitest';
import { isCloseRun } from '../close-detection';

describe('isCloseRun', () => {
  it('treats result_canon=SALE as close', () => {
    expect(isCloseRun({ result_canon: 'SALE', result: 'whatever' })).toBe(true);
  });
  it('treats PREMIER membership in result string as close', () => {
    expect(isCloseRun({ result_canon: 'PREMIER', result: 'Premier + OTbeat' })).toBe(true);
  });
  it('treats BASIC membership as close', () => {
    expect(isCloseRun({ result_canon: 'BASIC', result: 'Basic + OTbeat' })).toBe(true);
  });
  it('treats ELITE membership as close', () => {
    expect(isCloseRun({ result_canon: 'ELITE', result: 'Elite' })).toBe(true);
  });
  it('does not treat ON_5_CLASS_PACK as close', () => {
    expect(isCloseRun({ result_canon: 'ON_5_CLASS_PACK', result: 'On 5 Class Pack' })).toBe(false);
  });
  it('does not treat PLANNING_TO_BUY as close', () => {
    expect(isCloseRun({ result_canon: 'PLANNING_TO_BUY', result: 'Planning to buy' })).toBe(false);
  });
  it('does not treat NO_SHOW as close', () => {
    expect(isCloseRun({ result_canon: 'NO_SHOW', result: 'No-show' })).toBe(false);
  });
  it('handles null/undefined safely', () => {
    expect(isCloseRun({ result_canon: null, result: null })).toBe(false);
    expect(isCloseRun({} as any)).toBe(false);
  });
});
