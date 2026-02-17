import { describe, it, expect } from 'vitest';
import {
  normalizeDbTime,
  formatDisplayTime,
  buildClassStartDateTime,
  formatClassEndedBadge,
  isBookingUnresolved,
} from '@/lib/time/timeUtils';

describe('normalizeDbTime', () => {
  it('passes through canonical HH:mm', () => {
    expect(normalizeDbTime('16:15')).toBe('16:15');
    expect(normalizeDbTime('00:00')).toBe('00:00');
    expect(normalizeDbTime('09:05')).toBe('09:05');
  });

  it('strips seconds from HH:mm:ss', () => {
    expect(normalizeDbTime('16:15:00')).toBe('16:15');
  });

  it('converts AM/PM to 24h', () => {
    expect(normalizeDbTime('4:15 PM')).toBe('16:15');
    expect(normalizeDbTime('04:15 pm')).toBe('16:15');
    expect(normalizeDbTime('12:00 AM')).toBe('00:00');
    expect(normalizeDbTime('12:00 PM')).toBe('12:00');
    expect(normalizeDbTime('4:15PM')).toBe('16:15');
    expect(normalizeDbTime('11:30 AM')).toBe('11:30');
  });

  it('returns null for TBD / empty / null', () => {
    expect(normalizeDbTime(null)).toBeNull();
    expect(normalizeDbTime(undefined)).toBeNull();
    expect(normalizeDbTime('')).toBeNull();
    expect(normalizeDbTime('TBD')).toBeNull();
    expect(normalizeDbTime('Time TBD')).toBeNull();
  });
});

describe('formatDisplayTime', () => {
  it('formats 24h to 12h display', () => {
    expect(formatDisplayTime('16:15')).toBe('4:15 PM');
    expect(formatDisplayTime('09:05')).toBe('9:05 AM');
    expect(formatDisplayTime('00:00')).toBe('12:00 AM');
    expect(formatDisplayTime('12:00')).toBe('12:00 PM');
  });

  it('handles legacy AM/PM input gracefully', () => {
    expect(formatDisplayTime('4:15 PM')).toBe('4:15 PM');
  });

  it('returns Time TBD for null', () => {
    expect(formatDisplayTime(null)).toBe('Time TBD');
    expect(formatDisplayTime('TBD')).toBe('Time TBD');
  });
});

describe('buildClassStartDateTime', () => {
  it('builds correct local date', () => {
    const d = buildClassStartDateTime('2025-06-15', '14:30');
    expect(d).not.toBeNull();
    expect(d!.getHours()).toBe(14);
    expect(d!.getMinutes()).toBe(30);
  });

  it('handles legacy AM/PM', () => {
    const d = buildClassStartDateTime('2025-06-15', '2:30 PM');
    expect(d).not.toBeNull();
    expect(d!.getHours()).toBe(14);
  });

  it('returns null for invalid', () => {
    expect(buildClassStartDateTime('2025-06-15', null)).toBeNull();
    expect(buildClassStartDateTime('', '14:30')).toBeNull();
  });
});

describe('isBookingUnresolved', () => {
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  it('is unresolved when no run exists and class is past', () => {
    expect(isBookingUnresolved({ class_date: yesterday }, null)).toBe(true);
  });

  it('is not unresolved when class is in future', () => {
    expect(isBookingUnresolved({ class_date: tomorrow }, null)).toBe(false);
  });

  it('is not unresolved when run has resolved result_canon', () => {
    expect(isBookingUnresolved(
      { class_date: yesterday },
      { result_canon: 'PREMIER', result: 'Premier' },
    )).toBe(false);
  });

  it('is not unresolved when booking_status_canon is PURCHASED', () => {
    expect(isBookingUnresolved(
      { class_date: yesterday, booking_status_canon: 'PURCHASED' },
      null,
    )).toBe(false);
  });

  it('is unresolved when run result_canon is UNRESOLVED', () => {
    expect(isBookingUnresolved(
      { class_date: yesterday },
      { result_canon: 'UNRESOLVED', result: 'Unresolved' },
    )).toBe(true);
  });
});
