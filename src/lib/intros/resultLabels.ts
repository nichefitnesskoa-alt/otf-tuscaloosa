/**
 * Canonical result_canon helpers + display labels.
 * Single source of truth — DO NOT inline string-compare result_canon elsewhere.
 *
 * Real DB canon values (verified):
 *   SECOND_INTRO_SCHEDULED, FOLLOW_UP_NEEDED, PLANNING_TO_BUY, PLANNING_2ND_INTRO,
 *   NOT_INTERESTED, ON_5_CLASS_PACK, PREMIER, PREMIER_OTBEAT, ELITE, BASIC,
 *   NO_SHOW, VIP_CLASS_INTRO, UNRESOLVED
 */
import { isMembershipSale, SALE_CANONS, isSaleCanon, isPostDatedSale } from '@/lib/sales-detection';

// Re-export so existing imports from this module keep working.
export { SALE_CANONS, isSaleCanon };

export const FOLLOWUP_CANONS = new Set(['FOLLOW_UP', 'FOLLOW_UP_NEEDED']);
export const PLANNING_2ND_CANONS = new Set(['PLANNING_2ND', 'PLANNING_2ND_INTRO', 'SECOND_INTRO_SCHEDULED']);
export const isFollowUpCanon = (rc?: string | null): boolean => {
  if (!rc) return false;
  return FOLLOWUP_CANONS.has(rc.toUpperCase());
};
export const isPlanning2ndCanon = (rc?: string | null): boolean => {
  if (!rc) return false;
  return PLANNING_2ND_CANONS.has(rc.toUpperCase());
};

export type RunResultLabel =
  | 'SALE' | 'Pending Sale' | 'Booked 2nd' | 'Follow-Up' | 'Planning to Buy'
  | 'Showed Up - Not Interested' | '5 Class Pack' | 'No Show' | 'VIP Intro'
  | 'Unresolved' | '—';

export function labelForRun(r?: { result_canon?: string | null; result?: string | null; buy_date?: string | null } | null): RunResultLabel {
  const rc = (r?.result_canon || '').toUpperCase();
  if (isSaleCanon(rc) || isMembershipSale(r?.result || '')) {
    // Post-dated sales should not advertise as closed until buy_date arrives.
    if (r && isPostDatedSale(r)) return 'Pending Sale';
    return 'SALE';
  }
  if (rc === 'NO_SHOW') return 'No Show';
  if (isPlanning2ndCanon(rc)) return 'Booked 2nd';
  if (rc === 'PLANNING_TO_BUY') return 'Planning to Buy';
  if (rc === 'NOT_INTERESTED') return 'Showed Up - Not Interested';
  if (rc === 'ON_5_CLASS_PACK') return '5 Class Pack';
  if (rc === 'VIP_CLASS_INTRO') return 'VIP Intro';
  if (rc === 'UNRESOLVED') return 'Unresolved';
  if (isFollowUpCanon(rc)) return 'Follow-Up';
  return '—';
}

/**
 * True if this run should count as a sale/close RIGHT NOW.
 * Post-dated sales (buy_date > today CST) are excluded — they flip to true
 * automatically on their buy_date.
 */
export function isCloseResult(r?: { result_canon?: string | null; result?: string | null; buy_date?: string | null } | null): boolean {
  if (!r) return false;
  const isSale = isSaleCanon(r.result_canon) || isMembershipSale(r.result || '');
  if (!isSale) return false;
  return !isPostDatedSale(r);
}
