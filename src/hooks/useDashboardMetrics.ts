import { useMemo } from 'react';
import { IntroBooked, IntroRun, Sale } from '@/context/DataContext';
import { DateRange } from '@/lib/pay-period';
import { isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';

interface StudioMetrics {
  introsBooked: number;
  introsShowed: number;
  showRate: number;
  introSales: number;
  closingRate: number;
}

interface BookingCreditMetrics {
  saName: string;
  introsBooked: number;
  introsShowed: number;
  showRate: number;
  leadMeasureRate: number;
  qualityGoalRate: number;
  pricingEngagementRate: number;
}

interface ConversionCreditMetrics {
  saName: string;
  introsRan: number;
  sales: number;
  closingRate: number;
  commissionEarned: number;
}

export interface DashboardMetrics {
  studio: StudioMetrics;
  bookingCredit: BookingCreditMetrics[];
  conversionCredit: ConversionCreditMetrics[];
}

/**
 * Check if a date string falls within a date range
 */
function isDateInRange(dateStr: string | null | undefined, range: DateRange): boolean {
  if (!dateStr) return false;
  try {
    const date = parseISO(dateStr);
    return isWithinInterval(date, { start: range.start, end: range.end });
  } catch {
    return false;
  }
}

export function useDashboardMetrics(
  introsBooked: IntroBooked[],
  introsRun: IntroRun[],
  sales: Sale[],
  dateRange: DateRange
): DashboardMetrics {
  return useMemo(() => {
    // FIRST INTRO BOOKINGS ONLY (originating_booking_id IS NULL)
    // Filter by booking date (class_date) within range
    const firstIntroBookings = introsBooked.filter(b => {
      const originatingId = (b as any).originating_booking_id;
      const isFirstIntro = originatingId === null || originatingId === undefined;
      const isInDateRange = isDateInRange(b.class_date, dateRange);
      return isFirstIntro && isInDateRange;
    });

    // Create a map of booking_id to intro runs (for linking)
    // Note: We don't filter runs by date here - we look at ALL runs linked to filtered bookings
    const bookingToRuns = new Map<string, IntroRun[]>();
    introsRun.forEach(run => {
      const bookingId = run.linked_intro_booked_id;
      if (bookingId) {
        const existing = bookingToRuns.get(bookingId) || [];
        existing.push(run);
        bookingToRuns.set(bookingId, existing);
      }
    });

    // STUDIO METRICS
    // Studio Intros Booked = count of first intro bookings in date range
    const studioIntrosBooked = firstIntroBookings.length;

    // Studio Intros Showed = count of first bookings that have a linked run with outcome ≠ "No-show"
    // Each booking counts ONCE max
    const studioIntrosShowed = firstIntroBookings.filter(booking => {
      const runs = bookingToRuns.get(booking.id) || [];
      return runs.some(run => run.result !== 'No-show');
    }).length;

    // Studio Show Rate
    const studioShowRate = studioIntrosBooked > 0 
      ? (studioIntrosShowed / studioIntrosBooked) * 100 
      : 0;

    // Studio Intro Sales = count of intro-based sales where date_closed (buy_date) is in range
    // Only count sales from intros_run where commission > 0 and buy_date is in range
    const studioIntroSales = introsRun.filter(run => {
      // Must be linked to a first intro booking (any, not just filtered)
      const booking = introsBooked.find(b => {
        const originatingId = (b as any).originating_booking_id;
        return b.id === run.linked_intro_booked_id && (originatingId === null || originatingId === undefined);
      });
      // Filter by buy_date (date_closed) in range
      const buyDateInRange = isDateInRange(run.buy_date, dateRange);
      return booking && run.commission_amount && run.commission_amount > 0 && buyDateInRange;
    }).length;

    // Studio Closing % = Intro Sales / Intros Showed
    const studioClosingRate = studioIntrosShowed > 0 
      ? (studioIntroSales / studioIntrosShowed) * 100 
      : 0;

    // Get all unique SA names from bookings and runs
    const allSAs = new Set<string>();
    firstIntroBookings.forEach(b => {
      const bookedBy = (b as any).booked_by || b.sa_working_shift;
      if (bookedBy) allSAs.add(bookedBy);
    });
    introsRun.forEach(r => {
      if (r.intro_owner) allSAs.add(r.intro_owner);
      if (r.sa_name) allSAs.add(r.sa_name);
    });

    // BOOKING CREDIT TABLE (per SA, credited to booked_by)
    // Filter by booking_date (class_date)
    const bookingCredit: BookingCreditMetrics[] = Array.from(allSAs).map(saName => {
      // SA's first intro bookings (where booked_by = SA) - already filtered by date
      const saBookings = firstIntroBookings.filter(b => {
        const bookedBy = (b as any).booked_by || b.sa_working_shift;
        return bookedBy === saName;
      });

      const introsBookedCount = saBookings.length;

      // Intros Showed = those bookings that have a linked run with outcome ≠ "No-show"
      const showedBookings = saBookings.filter(booking => {
        const runs = bookingToRuns.get(booking.id) || [];
        return runs.some(run => run.result !== 'No-show');
      });
      const introsShowedCount = showedBookings.length;

      // Show Rate
      const showRate = introsBookedCount > 0 
        ? (introsShowedCount / introsBookedCount) * 100 
        : 0;

      // Get all runs linked to SA's bookings (for lead measures, quality, pricing)
      const linkedRuns: IntroRun[] = [];
      saBookings.forEach(booking => {
        const runs = bookingToRuns.get(booking.id) || [];
        linkedRuns.push(...runs.filter(r => r.result !== 'No-show'));
      });

      // Lead Measure Execution % (3 measures: halfway, premobility, coaching_summary)
      let leadMeasureTotal = linkedRuns.length * 3;
      let leadMeasureCompleted = linkedRuns.reduce((sum, r) => {
        let count = 0;
        if (r.halfway_encouragement) count++;
        if (r.premobility_encouragement) count++;
        if (r.coaching_summary_presence) count++;
        return sum + count;
      }, 0);
      const leadMeasureRate = leadMeasureTotal > 0 
        ? (leadMeasureCompleted / leadMeasureTotal) * 100 
        : 0;

      // Quality Goal % (Clear goals)
      const withGoalQuality = linkedRuns.filter(r => r.goal_quality);
      const clearGoals = withGoalQuality.filter(r => r.goal_quality === 'Clear');
      const qualityGoalRate = withGoalQuality.length > 0 
        ? (clearGoals.length / withGoalQuality.length) * 100 
        : 0;

      // Pricing Engagement % (Yes)
      const withPricingEngagement = linkedRuns.filter(r => r.pricing_engagement);
      const yesEngagement = withPricingEngagement.filter(r => r.pricing_engagement === 'Yes');
      const pricingEngagementRate = withPricingEngagement.length > 0 
        ? (yesEngagement.length / withPricingEngagement.length) * 100 
        : 0;

      return {
        saName,
        introsBooked: introsBookedCount,
        introsShowed: introsShowedCount,
        showRate,
        leadMeasureRate,
        qualityGoalRate,
        pricingEngagementRate,
      };
    }).filter(m => m.introsBooked > 0 || m.introsShowed > 0)
      .sort((a, b) => b.introsBooked - a.introsBooked);

    // CONVERSION CREDIT TABLE (per SA, credited to intro_owner)
    // Intros Ran: filter by booking_date (from linked first intro bookings in range)
    // Sales/Commission: filter by date_closed (buy_date) in range
    const conversionCredit: ConversionCreditMetrics[] = Array.from(allSAs).map(saName => {
      // Get first intro booking IDs that are in the date range
      const firstIntroBookingIds = new Set(firstIntroBookings.map(b => b.id));
      
      // Group runs by linked booking (only for first intros in date range)
      const runsByBooking = new Map<string, IntroRun[]>();
      introsRun.forEach(run => {
        if (run.linked_intro_booked_id && firstIntroBookingIds.has(run.linked_intro_booked_id)) {
          const existing = runsByBooking.get(run.linked_intro_booked_id) || [];
          existing.push(run);
          runsByBooking.set(run.linked_intro_booked_id, existing);
        }
      });

      // Count unique bookings where SA ran the first non-no-show intro
      let introsRanCount = 0;
      runsByBooking.forEach((runs, bookingId) => {
        // Sort by created_at to get earliest
        const sortedRuns = [...runs].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        // Find first non-no-show run
        const firstValidRun = sortedRuns.find(r => r.result !== 'No-show');
        if (firstValidRun && firstValidRun.intro_owner === saName) {
          introsRanCount++;
        }
      });

      // Sales = intro-based sales where intro_owner = SA AND buy_date (date_closed) is in range
      const saSales = introsRun.filter(run => {
        // Must be linked to a first intro booking (any, not just filtered)
        const booking = introsBooked.find(b => {
          const originatingId = (b as any).originating_booking_id;
          return b.id === run.linked_intro_booked_id && (originatingId === null || originatingId === undefined);
        });
        // Filter by buy_date (date_closed) in range
        const buyDateInRange = isDateInRange(run.buy_date, dateRange);
        return booking && run.intro_owner === saName && run.commission_amount && run.commission_amount > 0 && buyDateInRange;
      });
      const salesCount = saSales.length;

      // Closing % = Sales / Intros Ran
      const closingRate = introsRanCount > 0 
        ? (salesCount / introsRanCount) * 100 
        : 0;

      // Commission Earned - filter by date_closed (buy_date) in range
      const introCommission = introsRun
        .filter(r => r.intro_owner === saName && isDateInRange(r.buy_date, dateRange))
        .reduce((sum, r) => sum + (r.commission_amount || 0), 0);
      
      // Outside sales - filter by created_at (as proxy for date_closed) in range
      const outsideCommission = sales
        .filter(s => s.intro_owner === saName && isDateInRange(s.created_at, dateRange))
        .reduce((sum, s) => sum + (s.commission_amount || 0), 0);

      const commissionEarned = introCommission + outsideCommission;

      return {
        saName,
        introsRan: introsRanCount,
        sales: salesCount,
        closingRate,
        commissionEarned,
      };
    }).filter(m => m.introsRan > 0 || m.sales > 0 || m.commissionEarned > 0)
      .sort((a, b) => b.commissionEarned - a.commissionEarned);

    return {
      studio: {
        introsBooked: studioIntrosBooked,
        introsShowed: studioIntrosShowed,
        showRate: studioShowRate,
        introSales: studioIntroSales,
        closingRate: studioClosingRate,
      },
      bookingCredit,
      conversionCredit,
    };
  }, [introsBooked, introsRun, sales, dateRange]);
}
