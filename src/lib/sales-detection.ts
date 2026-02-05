/**
 * Shared utility functions for sales detection and date handling.
 * This ensures consistent logic across all components that deal with commission.
 */

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
 * Check if a date string falls within a date range
 */
export const isDateInRange = (
  dateStr: string | null | undefined,
  startDate: string,
  endDate: string
): boolean => {
  if (!dateStr) return false;
  return dateStr >= startDate && dateStr <= endDate;
};
