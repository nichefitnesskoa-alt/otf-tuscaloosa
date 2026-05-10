import { describe, it, expect } from 'vitest';
import { isMissingCoach, resolveCloseCoach, resolveCoachForBooking } from '@/lib/intros/coachAttribution';

describe('coachAttribution', () => {
  it('isMissingCoach: null/empty/TBD all true', () => {
    expect(isMissingCoach(null)).toBe(true);
    expect(isMissingCoach(undefined)).toBe(true);
    expect(isMissingCoach('')).toBe(true);
    expect(isMissingCoach('   ')).toBe(true);
    expect(isMissingCoach('TBD')).toBe(true);
    expect(isMissingCoach('tbd')).toBe(true);
    expect(isMissingCoach('Tbd')).toBe(true);
  });

  it('isMissingCoach: real names are false', () => {
    expect(isMissingCoach('Koa')).toBe(false);
    expect(isMissingCoach('Bri')).toBe(false);
  });

  it('resolveCloseCoach: VIP class booking uses vip_sessions coach', () => {
    const map = new Map([['vip-1', 'Alex']]);
    const b = { lead_source: 'VIP Class — Friends', vip_session_id: 'vip-1' };
    expect(resolveCloseCoach(b, 'Bri', map)).toBe('Alex');
  });

  it('resolveCloseCoach: non-VIP returns fallback', () => {
    const b = { lead_source: 'Web', vip_session_id: null };
    expect(resolveCloseCoach(b, 'Bri', new Map())).toBe('Bri');
  });

  it('resolveCoachForBooking: prefers booking.coach_name', () => {
    expect(resolveCoachForBooking({ coach_name: 'Koa' }, { coach_name: 'Bri' }, new Map())).toBe('Koa');
  });

  it('resolveCoachForBooking: falls back to run.coach_name when booking is TBD', () => {
    expect(resolveCoachForBooking({ coach_name: 'TBD' }, { coach_name: 'Bri' }, new Map())).toBe('Bri');
  });

  it('resolveCoachForBooking: VIP override beats booking name', () => {
    const map = new Map([['vip-1', 'Alex']]);
    const b = { coach_name: 'Koa', lead_source: 'VIP Class', vip_session_id: 'vip-1' };
    expect(resolveCoachForBooking(b, null, map)).toBe('Alex');
  });

  it('resolveCoachForBooking: returns null when nothing resolves', () => {
    expect(resolveCoachForBooking({ coach_name: 'TBD' }, { coach_name: '' }, new Map())).toBe(null);
  });
});
