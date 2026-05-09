/**
 * Canonical result_canon helpers + display labels.
 * Single source of truth — DO NOT inline string-compare result_canon elsewhere.
 *
 * Real DB canon values (verified):
 *   SECOND_INTRO_SCHEDULED, FOLLOW_UP_NEEDED, PLANNING_TO_BUY, PLANNING_2ND_INTRO,
 *   NOT_INTERESTED, ON_5_CLASS_PACK, PREMIER, PREMIER_OTBEAT, ELITE, BASIC,
 *   NO_SHOW, VIP_CLASS_INTRO, UNRESOLVED
 */
import { isMembershipSale } from '@/lib/sales-detection';

export const SALE_CANONS = new Set(['SALE', 'PREMIER', 'PREMIER_OTBEAT', 'ELITE', 'BASIC']);
export const FOLLOWUP_CANONS = new Set(['FOLLOW_UP', 'FOLLOW_UP_NEEDED']);
export const PLANNING_2ND_CANONS = new Set(['PLANNING_2ND', 'PLANNING_2ND_INTRO', 'SECOND_INTRO_SCHEDULED']);

export const isSaleCanon = (rc?: string | null): boolean => {
  if (!rc) return false;
  return SALE_CANONS.has(rc.toUpperCase());
};
export const isFollowUpCanon = (rc?: string | null): boolean => {
  if (!rc) return false;
  return FOLLOWUP_CANONS.has(rc.toUpperCase());
};
export const isPlanning2ndCanon = (rc?: string | null): boolean => {
  if (!rc) return false;
  return PLANNING_2ND_CANONS.has(rc.toUpperCase());
};

export type RunResultLabel =
  | 'SALE' | 'Booked 2nd' | 'Follow-Up' | 'Planning to Buy'
  | 'Not Interested' | '5 Class Pack' | 'No Show' | 'VIP Intro'
  | 'Unresolved' | '—';

export function labelForRun(r?: { result_canon?: string | null; result?: string | null } | null): RunResultLabel {
  const rc = (r?.result_canon || '').toUpperCase();
  if (isSaleCanon(rc) || isMembershipSale(r?.result || '')) return 'SALE';
  if (rc === 'NO_SHOW') return 'No Show';
  if (isPlanning2ndCanon(rc)) return 'Booked 2nd';
  if (rc === 'PLANNING_TO_BUY') return 'Planning to Buy';
  if (rc === 'NOT_INTERESTED') return 'Not Interested';
  if (rc === 'ON_5_CLASS_PACK') return '5 Class Pack';
  if (rc === 'VIP_CLASS_INTRO') return 'VIP Intro';
  if (rc === 'UNRESOLVED') return 'Unresolved';
  if (isFollowUpCanon(rc)) return 'Follow-Up';
  return '—';
}

/** True if this run should count as a sale/close. */
export function isCloseResult(r?: { result_canon?: string | null; result?: string | null } | null): boolean {
  if (!r) return false;
  return isSaleCanon(r.result_canon) || isMembershipSale(r.result || '');
}
