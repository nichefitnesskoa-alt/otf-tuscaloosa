import { describe, it, expect } from 'vitest';
import {
  isEligibleThreshold,
  countShifts,
  computeMilestoneStreak,
  buildSaLeaderboard,
} from '../saStreaks';

describe('isEligibleThreshold', () => {
  it('accepts 25/50/75/100 and every +50 after', () => {
    expect(isEligibleThreshold('25')).toBe(true);
    expect(isEligibleThreshold('50')).toBe(true);
    expect(isEligibleThreshold('75')).toBe(true);
    expect(isEligibleThreshold('100')).toBe(true);
    expect(isEligibleThreshold('150')).toBe(true);
    expect(isEligibleThreshold('500')).toBe(true);
    expect(isEligibleThreshold(1150)).toBe(false); // not a +50 step
    expect(isEligibleThreshold('1150')).toBe(false);
  });
  it('rejects below 25 and non-numeric', () => {
    expect(isEligibleThreshold('10')).toBe(false);
    expect(isEligibleThreshold(null)).toBe(false);
    expect(isEligibleThreshold('foo')).toBe(false);
  });
});

describe('countShifts', () => {
  it('dedupes by (sa, date, type)', () => {
    const shifts = [
      { sa_name: 'A', shift_date: '2026-05-01', shift_type: 'AM' },
      { sa_name: 'A', shift_date: '2026-05-01', shift_type: 'AM' },
      { sa_name: 'A', shift_date: '2026-05-01', shift_type: 'PM' },
      { sa_name: 'B', shift_date: '2026-05-01', shift_type: 'AM' },
    ];
    expect(countShifts(shifts, 'A')).toBe(2);
    expect(countShifts(shifts, 'B')).toBe(1);
  });
});

describe('computeMilestoneStreak', () => {
  const shifts = [
    { sa_name: 'Sophie', shift_date: '2026-05-08', shift_type: 'AM' },
    { sa_name: 'Sophie', shift_date: '2026-05-07', shift_type: 'AM' },
    { sa_name: 'Sophie', shift_date: '2026-05-06', shift_type: 'AM' },
    { sa_name: 'Sophie', shift_date: '2026-05-05', shift_type: 'AM' },
  ];
  it('counts consecutive shift-days with eligible milestones', () => {
    const milestones = [
      { id: '1', member_name: 'X', milestone_type: '25', created_by: 'Sophie', created_at: '2026-05-08T16:00:00Z' },
      { id: '2', member_name: 'Y', milestone_type: '50', created_by: 'Sophie', created_at: '2026-05-07T16:00:00Z' },
    ];
    expect(computeMilestoneStreak(shifts, milestones, 'Sophie')).toBe(2);
  });
  it('breaks on first shift with zero milestones', () => {
    const milestones = [
      { id: '1', member_name: 'X', milestone_type: '25', created_by: 'Sophie', created_at: '2026-05-08T16:00:00Z' },
      // gap on 5-07
      { id: '2', member_name: 'Y', milestone_type: '50', created_by: 'Sophie', created_at: '2026-05-06T16:00:00Z' },
    ];
    expect(computeMilestoneStreak(shifts, milestones, 'Sophie')).toBe(1);
  });
  it('ignores non-eligible thresholds', () => {
    const milestones = [
      { id: '1', member_name: 'X', milestone_type: '1150', created_by: 'Sophie', created_at: '2026-05-08T16:00:00Z' },
    ];
    expect(computeMilestoneStreak(shifts, milestones, 'Sophie')).toBe(0);
  });
});

describe('buildSaLeaderboard', () => {
  it('sorts by referral-ask rate, then raw, then milestones', () => {
    const shifts = [
      { sa_name: 'A', shift_date: '2026-05-01', shift_type: 'AM' },
      { sa_name: 'A', shift_date: '2026-05-02', shift_type: 'AM' },
      { sa_name: 'B', shift_date: '2026-05-01', shift_type: 'AM' },
    ];
    const milestones = [
      { id: '1', member_name: 'X', milestone_type: '25', created_by: 'A', created_at: '2026-05-01T16:00:00Z' },
    ];
    const referrals = [
      { id: 'r1', member_name: 'Y', class_date: '2026-05-01', booked_by: 'A' },
      { id: 'r2', member_name: 'Z', class_date: '2026-05-01', booked_by: 'B' },
      { id: 'r3', member_name: 'W', class_date: '2026-05-01', booked_by: 'B' },
    ];
    const rows = buildSaLeaderboard(shifts, milestones, referrals);
    // B has 2/1 = 2.0 rate, A has 1/2 = 0.5 — B should be first
    expect(rows[0].name).toBe('B');
    expect(rows[0].referralAskRate).toBe(2);
    expect(rows[1].name).toBe('A');
    expect(rows[1].milestones).toBe(1);
  });
});
