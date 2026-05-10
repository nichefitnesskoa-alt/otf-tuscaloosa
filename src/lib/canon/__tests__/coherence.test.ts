import { describe, it, expect } from 'vitest';
import { isVipBooking } from '@/lib/vip/vipRules';
import { isVipBooking as introRulesIsVipBooking } from '@/lib/canon/introRules';
import { isSaleCanon, SALE_CANONS, isMembershipSale } from '@/lib/sales-detection';
import { isSaleCanon as labelsIsSaleCanon, SALE_CANONS as labelsSaleCanons, isCloseResult } from '@/lib/intros/resultLabels';

describe('System-wide coherence — Build 1', () => {
  describe('H1: isVipBooking is single source of truth (includes COMP)', () => {
    it('treats booking_type_canon=COMP as VIP', () => {
      expect(isVipBooking({ booking_type_canon: 'COMP' })).toBe(true);
    });

    it('introRules re-export and vipRules export are the SAME function', () => {
      expect(introRulesIsVipBooking).toBe(isVipBooking);
    });

    it('treats VIP booking_type_canon as VIP', () => {
      expect(isVipBooking({ booking_type_canon: 'VIP' })).toBe(true);
    });

    it('treats STANDARD as not VIP', () => {
      expect(isVipBooking({ booking_type_canon: 'STANDARD' })).toBe(false);
    });
  });

  describe('P1: "is this a sale" agrees across modules', () => {
    it('SALE_CANONS in sales-detection and resultLabels are the SAME set', () => {
      expect(labelsSaleCanons).toBe(SALE_CANONS);
    });

    it('isSaleCanon in sales-detection and resultLabels are the SAME function', () => {
      expect(labelsIsSaleCanon).toBe(isSaleCanon);
    });

    const saleCanonValues = ['SALE', 'PREMIER', 'PREMIER_OTBEAT', 'ELITE', 'BASIC'];
    it.each(saleCanonValues)('canon %s counts as a sale', (rc) => {
      expect(isSaleCanon(rc)).toBe(true);
      expect(isCloseResult({ result_canon: rc })).toBe(true);
    });

    const nonSaleCanons = ['NO_SHOW', 'FOLLOW_UP_NEEDED', 'PLANNING_TO_BUY', 'NOT_INTERESTED', 'UNRESOLVED'];
    it.each(nonSaleCanons)('canon %s does NOT count as a sale', (rc) => {
      expect(isSaleCanon(rc)).toBe(false);
      expect(isCloseResult({ result_canon: rc })).toBe(false);
    });

    it('legacy result strings still map via isMembershipSale', () => {
      expect(isMembershipSale('Premier + OTBeat')).toBe(true);
      expect(isMembershipSale('Elite')).toBe(true);
      expect(isMembershipSale('Basic')).toBe(true);
      expect(isMembershipSale("Didn't Buy")).toBe(false);
    });
  });
});
