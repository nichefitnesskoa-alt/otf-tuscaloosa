import { useMemo } from 'react';
import { IntroBooked, IntroRun, Sale, ShiftRecap } from '@/context/DataContext';
import { DateRange } from '@/lib/pay-period';
import { isWithinInterval, parseISO } from 'date-fns';

interface StudioMetrics {
  introsBooked: number;
  introsShowed: number;
  showRate: number;
  introSales: number;
  closingRate: number;
  totalCommission: number;
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

interface IndividualActivityMetrics {
  saName: string;
  calls: number;
  texts: number;
  dms: number;
  emails: number;
  totalContacts: number;
  shiftsWorked: number;
  showRate: number | null;
}

export interface DashboardMetrics {
  studio: StudioMetrics;
  bookingCredit: BookingCreditMetrics[];
  conversionCredit: ConversionCreditMetrics[];
  individualActivity: IndividualActivityMetrics[];
}

/**
 * Check if a date string falls within a date range (or always true if range is null)
 */
function isDateInRange(dateStr: string | null | undefined, range: DateRange | null): boolean {
  if (!range) return true; // All time - no filtering
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
  dateRange: DateRange | null,
  shiftRecaps: ShiftRecap[] = []
): DashboardMetrics {
  return useMemo(() => {
    // Status values that should be excluded from metrics
    const EXCLUDED_STATUSES = [
      'Closed (Purchased)',
      'Not interested', 
      'Duplicate',
      'Deleted (soft)',
      'DEAD',
      'CLOSED',
    ];
    
    // Filter out bookings with excluded status or ignored from metrics
    const activeBookings = introsBooked.filter(b => {
      const status = ((b as any).booking_status || '').toUpperCase();
      const isExcludedStatus = EXCLUDED_STATUSES.some(s => status.includes(s.toUpperCase()));
      const isIgnored = (b as any).ignore_from_metrics === true;
      return !isExcludedStatus && !isIgnored;
    });
    
    // Filter out runs that are ignored from metrics
    const activeRuns = introsRun.filter(r => {
      const isIgnored = (r as any).ignore_from_metrics === true;
      return !isIgnored;
    });
    
    // FIRST INTRO BOOKINGS ONLY (originating_booking_id IS NULL)
    // Filter by booking date (class_date) within range
    const firstIntroBookings = activeBookings.filter(b => {
      const originatingId = (b as any).originating_booking_id;
      const isFirstIntro = originatingId === null || originatingId === undefined;
      const isInDateRange = isDateInRange(b.class_date, dateRange);
      return isFirstIntro && isInDateRange;
    });

    // Create a map of booking_id to intro runs (for linking)
    // Note: We don't filter runs by date here - we look at ALL runs linked to filtered bookings
    const bookingToRuns = new Map<string, IntroRun[]>();
    activeRuns.forEach(run => {
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
    const studioIntroSales = activeRuns.filter(run => {
      // Must be linked to a first intro booking (any, not just filtered)
      const booking = activeBookings.find(b => {
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

    // Get all unique SA names from bookings and runs (excluding TBD/Unknown)
    const EXCLUDED_NAMES = ['TBD', 'Unknown', '', 'N/A'];
    const allSAs = new Set<string>();
    firstIntroBookings.forEach(b => {
      // Use sa_working_shift as the "booked by" field
      const bookedBy = b.sa_working_shift;
      if (bookedBy && !EXCLUDED_NAMES.includes(bookedBy)) allSAs.add(bookedBy);
    });
    activeRuns.forEach(r => {
      if (r.intro_owner && !EXCLUDED_NAMES.includes(r.intro_owner)) allSAs.add(r.intro_owner);
      if (r.sa_name && !EXCLUDED_NAMES.includes(r.sa_name)) allSAs.add(r.sa_name);
    });
    // Add SAs from shift recaps
    shiftRecaps.forEach(s => {
      if (s.staff_name && !EXCLUDED_NAMES.includes(s.staff_name)) allSAs.add(s.staff_name);
    });

    // BOOKING CREDIT TABLE (per SA, credited to sa_working_shift / booked_by)
    // Filter by booking_date (class_date)
    const bookingCredit: BookingCreditMetrics[] = Array.from(allSAs).map(saName => {
      // SA's first intro bookings (where sa_working_shift = SA) - already filtered by date
      const saBookings = firstIntroBookings.filter(b => {
        return b.sa_working_shift === saName;
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
      activeRuns.forEach(run => {
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
      const saSales = activeRuns.filter(run => {
        // Must be linked to a first intro booking (any, not just filtered)
        const booking = activeBookings.find(b => {
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

      // Commission Earned - filter by date_closed (buy_date) in range for intro sales
      const introCommission = activeRuns
        .filter(r => r.intro_owner === saName && isDateInRange(r.buy_date, dateRange))
        .reduce((sum, r) => sum + (r.commission_amount || 0), 0);
      
      // Outside sales - use date_closed if available, fallback to created_at
      const outsideCommission = sales
        .filter(s => {
          const dateClosed = (s as any).date_closed || s.created_at;
          return s.intro_owner === saName && isDateInRange(dateClosed, dateRange);
        })
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

    // INDIVIDUAL ACTIVITY TABLE
    // Filter shift recaps by date range
    const filteredShifts = shiftRecaps.filter(s => isDateInRange(s.shift_date, dateRange));
    
    // Helper to safely parse numeric values (handles NaN, null, undefined, strings like "NaN")
    const safeNum = (val: unknown): number => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'string' && val.toLowerCase() === 'nan') return 0;
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    };
    
    const individualActivity: IndividualActivityMetrics[] = Array.from(allSAs).map(saName => {
      // Get shifts for this SA
      const saShifts = filteredShifts.filter(s => s.staff_name === saName);
      
      const calls = saShifts.reduce((sum, s) => sum + safeNum(s.calls_made), 0);
      const texts = saShifts.reduce((sum, s) => sum + safeNum(s.texts_sent), 0);
      const dms = saShifts.reduce((sum, s) => sum + safeNum(s.dms_sent), 0);
      const emails = saShifts.reduce((sum, s) => sum + safeNum(s.emails_sent), 0);
      const totalContacts = calls + texts + dms + emails;
      const shiftsWorked = saShifts.length;
      
      // Calculate show rate for this SA from their bookings
      const saBookings = firstIntroBookings.filter(b => b.sa_working_shift === saName);
      const saBooked = saBookings.length;
      const saShowed = saBookings.filter(booking => {
        const runs = bookingToRuns.get(booking.id) || [];
        return runs.some(run => run.result !== 'No-show');
      }).length;
      const showRate = saBooked > 0 ? (saShowed / saBooked) * 100 : null;
      
      return {
        saName,
        calls,
        texts,
        dms,
        emails,
        totalContacts,
        shiftsWorked,
        showRate,
      };
    }).filter(m => m.totalContacts > 0 || m.shiftsWorked > 0)
      .sort((a, b) => b.totalContacts - a.totalContacts);

    // Calculate total studio commission from all sources
    // Intro-based commission from intros_run (filter by buy_date)
    const totalIntroCommission = activeRuns
      .filter(r => isDateInRange(r.buy_date, dateRange) && r.commission_amount && r.commission_amount > 0)
      .reduce((sum, r) => sum + (r.commission_amount || 0), 0);
    
    // Outside-intro commission from sales (filter by date_closed)
    const totalOutsideCommission = sales
      .filter(s => {
        const dateClosed = (s as any).date_closed || s.created_at;
        return isDateInRange(dateClosed, dateRange) && s.commission_amount && s.commission_amount > 0;
      })
      .reduce((sum, s) => sum + (s.commission_amount || 0), 0);
    
    const totalStudioCommission = totalIntroCommission + totalOutsideCommission;

    return {
      studio: {
        introsBooked: studioIntrosBooked,
        introsShowed: studioIntrosShowed,
        showRate: studioShowRate,
        introSales: studioIntroSales,
        closingRate: studioClosingRate,
        totalCommission: totalStudioCommission,
      },
      bookingCredit,
      conversionCredit,
      individualActivity,
    };
  }, [introsBooked, introsRun, sales, dateRange, shiftRecaps]);
}
