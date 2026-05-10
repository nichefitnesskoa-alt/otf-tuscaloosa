import { describe, it, expect } from 'vitest';
import { computeCoverage, formatCoveragePct, type ShiftCoverageReport } from '../coverage';

const r = (celebrated: number, missed: number, id = '1'): ShiftCoverageReport => ({
  id, sa_name: 'A', shift_date: '2026-05-10', shift_type: 'AM',
  milestones_celebrated: celebrated, milestones_missed: missed, notes: null,
});

describe('computeCoverage', () => {
  it('returns null pct with no reports', () => {
    expect(computeCoverage([])).toEqual({ celebrated: 0, missed: 0, pct: null, reportedShifts: 0 });
  });
  it('80% for 8 celebrated 2 missed', () => {
    expect(computeCoverage([r(8, 2)]).pct).toBe(80);
  });
  it('aggregates across shifts: (8/2)+(10/0)=18/20=90%', () => {
    const t = computeCoverage([r(8, 2, 'a'), r(10, 0, 'b')]);
    expect(t.celebrated).toBe(18);
    expect(t.missed).toBe(2);
    expect(t.pct).toBe(90);
    expect(t.reportedShifts).toBe(2);
  });
  it('null pct when both 0 to avoid div-by-zero', () => {
    expect(computeCoverage([r(0, 0)]).pct).toBeNull();
  });
});

describe('formatCoveragePct', () => {
  it('em dash for null', () => expect(formatCoveragePct(null)).toBe('—'));
  it('rounds to whole percent', () => expect(formatCoveragePct(83.4)).toBe('83%'));
});
