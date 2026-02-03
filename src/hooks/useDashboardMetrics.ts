import { useMemo } from 'react';
import { IntroBooked, IntroRun, Sale } from '@/context/DataContext';

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

export function useDashboardMetrics(
  introsBooked: IntroBooked[],
  introsRun: IntroRun[],
  sales: Sale[]
): DashboardMetrics {
  return useMemo(() => {
    // FIRST INTRO BOOKINGS ONLY (originating_booking_id IS NULL)
    // Note: We check for both null and undefined, and also check if the field doesn't exist
    const firstIntroBookings = introsBooked.filter(b => {
      const originatingId = (b as any).originating_booking_id;
      return originatingId === null || originatingId === undefined;
    });

    // Create a map of booking_id to intro runs (for linking)
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
    // Studio Intros Booked = count of first intro bookings
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

    // Studio Intro Sales = count of intro-based sales (from intros_run with commission > 0)
    const studioIntroSales = introsRun.filter(run => {
      // Must be linked to a first intro booking
      const booking = firstIntroBookings.find(b => b.id === run.linked_intro_booked_id);
      return booking && run.commission_amount && run.commission_amount > 0;
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
    const bookingCredit: BookingCreditMetrics[] = Array.from(allSAs).map(saName => {
      // SA's first intro bookings (where booked_by = SA)
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
    const conversionCredit: ConversionCreditMetrics[] = Array.from(allSAs).map(saName => {
      // Intros Ran = first intro runs where intro_owner = SA and outcome ≠ "No-show"
      // Only count runs linked to FIRST intro bookings
      // If multiple runs for same booking, use earliest non-no-show run only
      const firstIntroBookingIds = new Set(firstIntroBookings.map(b => b.id));
      
      // Group runs by linked booking
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

      // Sales = intro-based sales where intro_owner = SA
      const saSales = introsRun.filter(run => {
        // Must be linked to a first intro booking
        const booking = firstIntroBookings.find(b => b.id === run.linked_intro_booked_id);
        return booking && run.intro_owner === saName && run.commission_amount && run.commission_amount > 0;
      });
      const salesCount = saSales.length;

      // Closing % = Sales / Intros Ran
      const closingRate = introsRanCount > 0 
        ? (salesCount / introsRanCount) * 100 
        : 0;

      // Commission Earned (from intro runs + outside sales)
      const introCommission = introsRun
        .filter(r => r.intro_owner === saName)
        .reduce((sum, r) => sum + (r.commission_amount || 0), 0);
      
      const outsideCommission = sales
        .filter(s => s.intro_owner === saName)
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
  }, [introsBooked, introsRun, sales]);
}
