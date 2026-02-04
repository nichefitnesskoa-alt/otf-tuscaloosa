import { useMemo } from 'react';
import { IntroBooked, IntroRun, Sale, ShiftRecap } from '@/context/DataContext';
import { DateRange } from '@/lib/pay-period';
import { isWithinInterval, parseISO } from 'date-fns';
import { PerSAMetrics } from '@/components/dashboard/PerSATable';

interface StudioMetrics {
  introsRun: number;
  introSales: number;
  closingRate: number;
  totalCommission: number;
  goalWhyRate: number;
  relationshipRate: number;
  madeAFriendRate: number;
}

interface LeaderEntry {
  name: string;
  value: number;
  subValue?: string;
}

interface IndividualActivityMetrics {
  saName: string;
  calls: number;
  texts: number;
  dms: number;
  emails: number;
  totalContacts: number;
  shiftsWorked: number;
}

export interface DashboardMetrics {
  studio: StudioMetrics;
  perSA: PerSAMetrics[];
  individualActivity: IndividualActivityMetrics[];
  leaderboards: {
    topBookers: LeaderEntry[];
    topCommission: LeaderEntry[];
    topClosing: LeaderEntry[];
    topShowRate: LeaderEntry[];
  };
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
    
    const EXCLUDED_NAMES = ['TBD', 'Unknown', '', 'N/A'];
    
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
    
    // FIRST INTRO BOOKINGS ONLY (for leaderboards - show rate)
    const firstIntroBookings = activeBookings.filter(b => {
      const originatingId = (b as any).originating_booking_id;
      const isFirstIntro = originatingId === null || originatingId === undefined;
      const isInDateRange = isDateInRange(b.class_date, dateRange);
      return isFirstIntro && isInDateRange;
    });

    // Create a map of booking_id to intro runs
    const bookingToRuns = new Map<string, IntroRun[]>();
    activeRuns.forEach(run => {
      const bookingId = run.linked_intro_booked_id;
      if (bookingId) {
        const existing = bookingToRuns.get(bookingId) || [];
        existing.push(run);
        bookingToRuns.set(bookingId, existing);
      }
    });

    // Get all unique SA names
    const allSAs = new Set<string>();
    activeRuns.forEach(r => {
      if (r.intro_owner && !EXCLUDED_NAMES.includes(r.intro_owner)) allSAs.add(r.intro_owner);
    });
    activeBookings.forEach(b => {
      const bookedBy = (b as any).booked_by || b.sa_working_shift;
      if (bookedBy && !EXCLUDED_NAMES.includes(bookedBy)) allSAs.add(bookedBy);
    });
    shiftRecaps.forEach(s => {
      if (s.staff_name && !EXCLUDED_NAMES.includes(s.staff_name)) allSAs.add(s.staff_name);
    });

    // Helper to safely parse values
    const safeNum = (val: unknown): number => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'string' && val.toLowerCase() === 'nan') return 0;
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    };

    // Get first intro booking IDs for filtering runs
    const firstIntroBookingIds = new Set(firstIntroBookings.map(b => b.id));

    // =========================================
    // PER-SA METRICS (attributed to intro_owner)
    // =========================================
    const perSAData: PerSAMetrics[] = Array.from(allSAs).map(saName => {
      // Group runs by linked booking for this SA
      const runsByBooking = new Map<string, IntroRun[]>();
      activeRuns.forEach(run => {
        if (run.linked_intro_booked_id && firstIntroBookingIds.has(run.linked_intro_booked_id)) {
          const existing = runsByBooking.get(run.linked_intro_booked_id) || [];
          existing.push(run);
          runsByBooking.set(run.linked_intro_booked_id, existing);
        }
      });

      // Count intros run: unique bookings where SA ran the first non-no-show intro
      let introsRunCount = 0;
      const saFirstRuns: IntroRun[] = [];
      runsByBooking.forEach((runs) => {
        const sortedRuns = [...runs].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const firstValidRun = sortedRuns.find(r => r.result !== 'No-show');
        if (firstValidRun && firstValidRun.intro_owner === saName) {
          introsRunCount++;
          saFirstRuns.push(firstValidRun);
        }
      });

      // Sales = runs by this SA with commission > 0 and buy_date in range
      const saSales = activeRuns.filter(run => {
        const booking = activeBookings.find(b => {
          const originatingId = (b as any).originating_booking_id;
          return b.id === run.linked_intro_booked_id && (originatingId === null || originatingId === undefined);
        });
        const buyDateInRange = isDateInRange(run.buy_date, dateRange);
        return booking && run.intro_owner === saName && run.commission_amount && run.commission_amount > 0 && buyDateInRange;
      });
      const salesCount = saSales.length;
      const closingRate = introsRunCount > 0 ? (salesCount / introsRunCount) * 100 : 0;

      // Commission from intros
      const introCommission = activeRuns
        .filter(r => r.intro_owner === saName && isDateInRange(r.buy_date, dateRange))
        .reduce((sum, r) => sum + (r.commission_amount || 0), 0);
      
      // Commission from outside sales
      const outsideCommission = sales
        .filter(s => {
          const dateClosed = (s as any).date_closed || s.created_at;
          return s.intro_owner === saName && isDateInRange(dateClosed, dateRange);
        })
        .reduce((sum, s) => sum + (s.commission_amount || 0), 0);
      
      const commission = introCommission + outsideCommission;

      // Lead measures (from SA's first runs only)
      // Goal + Why captured: Yes or Partial
      const withGoalWhy = saFirstRuns.filter(r => (r as any).goal_why_captured);
      const goalWhyYes = withGoalWhy.filter(r => ['Yes', 'Partial'].includes((r as any).goal_why_captured));
      const goalWhyRate = withGoalWhy.length > 0 ? (goalWhyYes.length / withGoalWhy.length) * 100 : 0;

      // Relationship experience: Yes or Partial
      const withRelationship = saFirstRuns.filter(r => (r as any).relationship_experience);
      const relationshipYes = withRelationship.filter(r => ['Yes', 'Partial'].includes((r as any).relationship_experience));
      const relationshipRate = withRelationship.length > 0 ? (relationshipYes.length / withRelationship.length) * 100 : 0;

      // Made a friend: Yes
      const withFriend = saFirstRuns.filter(r => (r as any).made_a_friend !== undefined && (r as any).made_a_friend !== null);
      const friendYes = withFriend.filter(r => (r as any).made_a_friend === true);
      const madeAFriendRate = withFriend.length > 0 ? (friendYes.length / withFriend.length) * 100 : 0;

      return {
        saName,
        introsRun: introsRunCount,
        sales: salesCount,
        closingRate,
        goalWhyRate,
        relationshipRate,
        madeAFriendRate,
        commission,
      };
    }).filter(m => m.introsRun > 0 || m.sales > 0 || m.commission > 0)
      .sort((a, b) => b.commission - a.commission);

    // =========================================
    // STUDIO METRICS (aggregated)
    // =========================================
    const studioIntrosRun = perSAData.reduce((sum, m) => sum + m.introsRun, 0);
    const studioIntroSales = perSAData.reduce((sum, m) => sum + m.sales, 0);
    const studioClosingRate = studioIntrosRun > 0 ? (studioIntroSales / studioIntrosRun) * 100 : 0;
    const studioCommission = perSAData.reduce((sum, m) => sum + m.commission, 0);

    // Studio lead measures - weighted average
    const totalRuns = perSAData.reduce((sum, m) => sum + m.introsRun, 0);
    const studioGoalWhyRate = totalRuns > 0 
      ? perSAData.reduce((sum, m) => sum + (m.goalWhyRate * m.introsRun), 0) / totalRuns 
      : 0;
    const studioRelationshipRate = totalRuns > 0 
      ? perSAData.reduce((sum, m) => sum + (m.relationshipRate * m.introsRun), 0) / totalRuns 
      : 0;
    const studioMadeAFriendRate = totalRuns > 0 
      ? perSAData.reduce((sum, m) => sum + (m.madeAFriendRate * m.introsRun), 0) / totalRuns 
      : 0;

    // =========================================
    // INDIVIDUAL ACTIVITY TABLE
    // =========================================
    const filteredShifts = shiftRecaps.filter(s => isDateInRange(s.shift_date, dateRange));
    
    const individualActivity: IndividualActivityMetrics[] = Array.from(allSAs).map(saName => {
      const saShifts = filteredShifts.filter(s => s.staff_name === saName);
      
      const calls = saShifts.reduce((sum, s) => sum + safeNum(s.calls_made), 0);
      const texts = saShifts.reduce((sum, s) => sum + safeNum(s.texts_sent), 0);
      const dms = saShifts.reduce((sum, s) => sum + safeNum(s.dms_sent), 0);
      const emails = saShifts.reduce((sum, s) => sum + safeNum(s.emails_sent), 0);
      const totalContacts = calls + texts + dms + emails;
      const shiftsWorked = saShifts.length;
      
      return {
        saName,
        calls,
        texts,
        dms,
        emails,
        totalContacts,
        shiftsWorked,
      };
    }).filter(m => m.totalContacts > 0 || m.shiftsWorked > 0)
      .sort((a, b) => b.totalContacts - a.totalContacts);

    // =========================================
    // LEADERBOARDS
    // =========================================
    
    // Top Bookers (by booking count, credited to booked_by first, fallback to sa_working_shift)
    const bookerCounts = new Map<string, number>();
    firstIntroBookings.forEach(b => {
      const bookedBy = (b as any).booked_by || b.sa_working_shift;
      if (bookedBy && !EXCLUDED_NAMES.includes(bookedBy)) {
        bookerCounts.set(bookedBy, (bookerCounts.get(bookedBy) || 0) + 1);
      }
    });
    const topBookers: LeaderEntry[] = Array.from(bookerCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);

    // Top Commission
    const topCommission: LeaderEntry[] = perSAData
      .filter(m => m.commission > 0)
      .map(m => ({ name: m.saName, value: m.commission }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);

    // Best Closing % (minimum 3 intros to qualify)
    const MIN_INTROS_FOR_CLOSING = 3;
    const topClosing: LeaderEntry[] = perSAData
      .filter(m => m.introsRun >= MIN_INTROS_FOR_CLOSING)
      .map(m => ({ 
        name: m.saName, 
        value: m.closingRate, 
        subValue: `${m.sales}/${m.introsRun}` 
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);

    // Best Show Rate (booking-based, credited to booked_by)
    const showRateData: LeaderEntry[] = [];
    const MIN_BOOKINGS_FOR_SHOWRATE = 3;
    bookerCounts.forEach((booked, saName) => {
      if (booked >= MIN_BOOKINGS_FOR_SHOWRATE) {
        const saBookings = firstIntroBookings.filter(b => {
          const bookedBy = (b as any).booked_by || b.sa_working_shift;
          return bookedBy === saName;
        });
        const showed = saBookings.filter(booking => {
          const runs = bookingToRuns.get(booking.id) || [];
          return runs.some(run => run.result !== 'No-show');
        }).length;
        const showRate = booked > 0 ? (showed / booked) * 100 : 0;
        showRateData.push({ 
          name: saName, 
          value: showRate, 
          subValue: `${showed}/${booked}` 
        });
      }
    });
    const topShowRate = showRateData.sort((a, b) => b.value - a.value).slice(0, 3);

    return {
      studio: {
        introsRun: studioIntrosRun,
        introSales: studioIntroSales,
        closingRate: studioClosingRate,
        totalCommission: studioCommission,
        goalWhyRate: studioGoalWhyRate,
        relationshipRate: studioRelationshipRate,
        madeAFriendRate: studioMadeAFriendRate,
      },
      perSA: perSAData,
      individualActivity,
      leaderboards: {
        topBookers,
        topCommission,
        topClosing,
        topShowRate,
      },
    };
  }, [introsBooked, introsRun, sales, dateRange, shiftRecaps]);
}
