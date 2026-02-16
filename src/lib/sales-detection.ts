/**
 * Shared utility functions for sales detection and date handling.
 * This ensures consistent logic across all components that deal with commission.
 * 
 * ALL metrics code across the app MUST use these shared utilities:
 * - getRunSaleDate() for the purchase date fallback chain
 * - isRunInRange() for booking-based metrics (intros run, showed)
 * - isSaleInRange() for conversion-based metrics (sales, close rate, commission)
 */

import { DateRange } from '@/lib/pay-period';
import { parseLocalDate } from '@/lib/utils';
import { isWithinInterval } from 'date-fns';

/**
 * Check if a result string indicates a membership sale
 */
export const isMembershipSale = (result: string): boolean => {
  const lower = (result || '').toLowerCase();
  return ['premier', 'elite', 'basic'].some(m => lower.includes(m));
};

/**
 * Get the effective date for a sale/run, with proper fallback chain.
 * Priority: buy_date > date_closed > run_date > created_at
 * Used by components that have individual field params (e.g. MembershipPurchasesPanel).
 */
export const getSaleDate = (
  buyDate: string | null | undefined,
  runDate: string | null | undefined,
  dateClosed: string | null | undefined,
  createdAt: string
): string => {
  if (buyDate) return buyDate;
  if (dateClosed) return dateClosed;
  if (runDate) return runDate;
  // Extract date from ISO timestamp
  return createdAt.split('T')[0];
};

/**
 * Get the effective sale date from an IntroRun-shaped object.
 * Fallback chain: buy_date > run_date > created_at (date portion).
 * Used by metrics hooks for consistent sale date resolution.
 */
export function getRunSaleDate(run: { buy_date?: string | null; run_date?: string | null; created_at: string }): string {
  return run.buy_date || run.run_date || run.created_at.split('T')[0];
}

/**
 * Check if a run's run_date falls within a DateRange.
 * Used for BOOKING-BASED metrics: intros run count, intros showed.
 */
export function isRunInRange(
  run: { run_date?: string | null },
  dateRange: DateRange | null
): boolean {
  if (!dateRange) return true; // All time
  if (!run.run_date) return false;
  try {
    const date = parseLocalDate(run.run_date);
    return isWithinInterval(date, { start: dateRange.start, end: dateRange.end });
  } catch {
    return false;
  }
}

/**
 * Check if a run qualifies as a sale within a DateRange.
 * Uses the purchase date fallback chain (buy_date > run_date > created_at).
 * Used for CONVERSION-BASED metrics: sales count, close rate, commission.
 */
export function isSaleInRange(
  run: { buy_date?: string | null; run_date?: string | null; result?: string; created_at: string },
  dateRange: DateRange | null
): boolean {
  if (!isMembershipSale(run.result || '')) return false;
  if (!dateRange) return true; // All time
  const saleDate = getRunSaleDate(run);
  try {
    const date = parseLocalDate(saleDate);
    return isWithinInterval(date, { start: dateRange.start, end: dateRange.end });
  } catch {
    return false;
  }
}

/**
 * Check if a date string falls within a date range (simple string comparison).
 * For use with plain start/end date strings (not DateRange objects).
 */
export const isDateInRange = (
  dateStr: string | null | undefined,
  startDate: string,
  endDate: string
): boolean => {
  if (!dateStr) return false;
  return dateStr >= startDate && dateStr <= endDate;
};
