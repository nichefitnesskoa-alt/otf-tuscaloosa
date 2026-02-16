/**
 * Shared constants and helpers for consistent metric computation
 * across Studio Scoreboard, Team Meeting, Coaching, and Pipeline.
 */

/** Lead sources excluded from SA performance metrics (show-rate, leaderboards) */
export const EXCLUDED_LEAD_SOURCES = [
  'Online Intro Offer (self-booked)',
  'Run-first entry',
  'Orangebook',
  'VIP Class',
];

/** SA names excluded from leaderboards / attribution */
export const EXCLUDED_SA_NAMES = [
  'TBD', 'Unknown', '', 'N/A',
  'Self Booked', 'Self-Booked', 'self booked', 'Self-booked',
  'Run-first entry',
  'Bulk Import', 'Self (VIP Form)',
  'VIP Registration',
];

/** Membership result strings (case-insensitive partial match) */
const MEMBERSHIP_KEYWORDS = ['premier', 'elite', 'basic'];

export function isMembershipSale(result: string): boolean {
  const lower = (result || '').toLowerCase();
  return MEMBERSHIP_KEYWORDS.some(m => lower.includes(m));
}

export function isPurchased(result: string): boolean {
  const lower = (result || '').toLowerCase();
  return lower === 'purchased' || isMembershipSale(result);
}

export function isNoShow(result: string): boolean {
  const lower = (result || '').toLowerCase();
  return lower === 'no-show' || lower === 'no show';
}

/** Color tier for lead-measure targets */
export function getLeadMeasureColor(
  value: number,
  thresholds: { green: number; amber: number },
): 'success' | 'warning' | 'destructive' {
  if (value >= thresholds.green) return 'success';
  if (value >= thresholds.amber) return 'warning';
  return 'destructive';
}

/** Q Completion target thresholds */
export const Q_COMPLETION_THRESHOLDS = { green: 70, amber: 50 };
/** Confirmation Rate target thresholds */
export const CONFIRMATION_THRESHOLDS = { green: 90, amber: 70 };
/** Follow-Up Completion target thresholds */
export const FOLLOWUP_THRESHOLDS = { green: 80, amber: 60 };
