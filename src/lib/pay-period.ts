import { startOfDay, endOfDay, startOfWeek, endOfWeek, differenceInDays, addDays, format } from 'date-fns';

// Pay periods are biweekly, anchored to January 26, 2026
const PAY_PERIOD_ANCHOR = new Date(2026, 0, 26); // January 26, 2026
const PAY_PERIOD_DAYS = 14;

export interface DateRange {
  start: Date;
  end: Date;
}

export type DatePreset = 'today' | 'this_week' | 'pay_period' | 'custom';

/**
 * Calculate the pay period that contains the given date
 */
export function getPayPeriodForDate(date: Date): DateRange {
  const targetDate = startOfDay(date);
  const anchor = startOfDay(PAY_PERIOD_ANCHOR);
  
  // Calculate how many days from the anchor
  const daysDiff = differenceInDays(targetDate, anchor);
  
  // Find which pay period this falls into
  const periodIndex = Math.floor(daysDiff / PAY_PERIOD_DAYS);
  
  // Calculate the start of this pay period
  const periodStart = addDays(anchor, periodIndex * PAY_PERIOD_DAYS);
  const periodEnd = addDays(periodStart, PAY_PERIOD_DAYS - 1);
  
  return {
    start: startOfDay(periodStart),
    end: endOfDay(periodEnd),
  };
}

/**
 * Get date range for a preset
 */
export function getDateRangeForPreset(preset: DatePreset, customRange?: DateRange): DateRange {
  const today = new Date();
  
  switch (preset) {
    case 'today':
      return {
        start: startOfDay(today),
        end: endOfDay(today),
      };
    
    case 'this_week':
      return {
        start: startOfWeek(today, { weekStartsOn: 0 }), // Sunday
        end: endOfWeek(today, { weekStartsOn: 0 }),
      };
    
    case 'pay_period':
      return getPayPeriodForDate(today);
    
    case 'custom':
      if (customRange) {
        return {
          start: startOfDay(customRange.start),
          end: endOfDay(customRange.end),
        };
      }
      // Fallback to pay period if no custom range provided
      return getPayPeriodForDate(today);
    
    default:
      return getPayPeriodForDate(today);
  }
}

/**
 * Format date range for display
 */
export function formatDateRange(range: DateRange): string {
  return `${format(range.start, 'MMM d')} – ${format(range.end, 'MMM d, yyyy')}`;
}

/**
 * Get preset label
 */
export function getPresetLabel(preset: DatePreset): string {
  switch (preset) {
    case 'today':
      return 'Today';
    case 'this_week':
      return 'This Week';
    case 'pay_period':
      return 'Pay Period';
    case 'custom':
      return 'Custom Range';
    default:
      return 'Pay Period';
  }
}
