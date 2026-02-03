import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, differenceInDays, addDays, subDays, subMonths, subWeeks, subYears, format } from 'date-fns';

// Pay periods are biweekly, anchored to January 26, 2026
const PAY_PERIOD_ANCHOR = new Date(2026, 0, 26); // January 26, 2026
const PAY_PERIOD_DAYS = 14;

export interface DateRange {
  start: Date;
  end: Date;
}

export type DatePreset = 
  | 'all_time'
  | 'today' 
  | 'this_week' 
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'pay_period' 
  | 'last_pay_period'
  | 'this_year'
  | 'last_year'
  | 'custom';

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
 * Get the previous pay period (before the current one)
 */
export function getLastPayPeriod(): DateRange {
  const currentPayPeriod = getPayPeriodForDate(new Date());
  const lastPayPeriodStart = subDays(currentPayPeriod.start, PAY_PERIOD_DAYS);
  const lastPayPeriodEnd = subDays(currentPayPeriod.start, 1);
  
  return {
    start: startOfDay(lastPayPeriodStart),
    end: endOfDay(lastPayPeriodEnd),
  };
}

/**
 * Get date range for a preset
 */
export function getDateRangeForPreset(preset: DatePreset, customRange?: DateRange): DateRange | null {
  const today = new Date();
  
  switch (preset) {
    case 'all_time':
      return null; // No date filtering
    
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
    
    case 'last_week':
      const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 0 });
      const lastWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 0 });
      return {
        start: lastWeekStart,
        end: lastWeekEnd,
      };
    
    case 'this_month':
      return {
        start: startOfMonth(today),
        end: endOfMonth(today),
      };
    
    case 'last_month':
      const lastMonth = subMonths(today, 1);
      return {
        start: startOfMonth(lastMonth),
        end: endOfMonth(lastMonth),
      };
    
    case 'pay_period':
      return getPayPeriodForDate(today);
    
    case 'last_pay_period':
      return getLastPayPeriod();
    
    case 'this_year':
      return {
        start: startOfYear(today),
        end: endOfYear(today),
      };
    
    case 'last_year':
      const lastYear = subYears(today, 1);
      return {
        start: startOfYear(lastYear),
        end: endOfYear(lastYear),
      };
    
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
export function getPresetLabel(preset: DatePreset, dateRange?: DateRange | null): string {
  switch (preset) {
    case 'all_time':
      return 'All Time';
    case 'today':
      return 'Today';
    case 'this_week':
      return 'This Week';
    case 'last_week':
      return 'Last Week';
    case 'this_month':
      return 'This Month';
    case 'last_month':
      return 'Last Month';
    case 'pay_period':
      return 'Pay Period';
    case 'last_pay_period':
      return 'Last Pay Period';
    case 'this_year':
      return 'This Year';
    case 'last_year':
      return 'Last Year';
    case 'custom':
      return 'Custom Range';
    default:
      return 'Pay Period';
  }
}
