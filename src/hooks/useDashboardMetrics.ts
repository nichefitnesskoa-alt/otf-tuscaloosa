import { useMemo } from 'react';
import { IntroBooked, IntroRun, Sale, ShiftRecap } from '@/context/DataContext';
import { DateRange } from '@/lib/pay-period';
import { isWithinInterval, isToday } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { PerSAMetrics } from '@/components/dashboard/PerSATable';
import { BookerMetrics } from '@/components/dashboard/BookerStatsTable';

interface StudioMetrics {
  introsRun: number;
  introSales: number;
  closingRate: number;
  totalCommission: number;
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

interface LeadSourceMetrics {
  source: string;
  booked: number;
  showed: number;
  sold: number;
  revenue: number;
}

interface PipelineMetrics {
  booked: number;
  showed: number;
  sold: number;
  revenue: number;
}

interface TodaysRaceEntry {
  name: string;
  introsRun: number;
  sales: number;
  isCurrentUser: boolean;
}

export interface DashboardMetrics {
  studio: StudioMetrics;
  perSA: PerSAMetrics[];
  bookerStats: BookerMetrics[];
  individualActivity: IndividualActivityMetrics[];
  leadSourceMetrics: LeadSourceMetrics[];
  pipeline: PipelineMetrics;
  todaysRace: TodaysRaceEntry[];
  leaderboards: {
    topBookers: LeaderEntry[];
    topCommission: LeaderEntry[];
    topClosing: LeaderEntry[];
    topShowRate: LeaderEntry[];
  };
  participantCounts: {
    bookers: number;
    commission: number;
    closing: number;
    showRate: number;
  };
}

/**
 * Check if a date string falls within a date range (or always true if range is null)
 */
function isDateInRange(dateStr: string | null | undefined, range: DateRange | null): boolean {
  if (!range) return true; // All time - no filtering
  if (!dateStr) return false;
  try {
    const date = parseLocalDate(dateStr);
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
  shiftRecaps: ShiftRecap[] = [],
  currentUserName?: string
): DashboardMetrics {
  return useMemo(() => {
    // Status values that should be excluded from metrics (bad data, duplicates, etc.)
    // NOTE: "Closed (Purchased)" should NOT be excluded - those are successful conversions!
    const EXCLUDED_STATUSES = [
      'Duplicate',
      'Deleted (soft)',
      'DEAD',
    ];
    
    const EXCLUDED_NAMES = ['TBD', 'Unknown', '', 'N/A', 'Self Booked', 'Self-Booked', 'self booked', 'Self-booked', 'Run-first entry', 'Bulk Import', 'Self (VIP Form)', 'VIP Registration'];
    
    // Filter out bookings with excluded status, ignored from metrics, or VIP
    const activeBookings = introsBooked.filter(b => {
      const status = ((b as any).booking_status || '').toUpperCase();
      const isExcludedStatus = EXCLUDED_STATUSES.some(s => status.includes(s.toUpperCase()));
      const isIgnored = (b as any).ignore_from_metrics === true;
      const isVip = (b as any).is_vip === true;
      return !isExcludedStatus && !isIgnored && !isVip;
    });
    
    // Filter out runs that are ignored from metrics or linked to VIP bookings
    const vipBookingIds = new Set(
      introsBooked.filter(b => (b as any).is_vip === true).map(b => b.id)
    );
    const activeRuns = introsRun.filter(r => {
      const isIgnored = (r as any).ignore_from_metrics === true;
      const isVipRun = r.linked_intro_booked_id && vipBookingIds.has(r.linked_intro_booked_id);
      return !isIgnored && !isVipRun;
    });
    
    // FIRST INTRO BOOKINGS ONLY (for leaderboards - show rate)
    // Also exclude self-booked for studio metrics
    const firstIntroBookings = activeBookings.filter(b => {
      const originatingId = (b as any).originating_booking_id;
      const isFirstIntro = originatingId === null || originatingId === undefined;
      const isInDateRange = isDateInRange(b.class_date, dateRange);
      return isFirstIntro && isInDateRange;
    });
    
    // First intro bookings excluding self-booked (for studio-wide metrics)
    const firstIntroBookingsNoSelfBooked = firstIntroBookings.filter(b => {
      const bookedBy = (b as any).booked_by || b.sa_working_shift || '';
      return !EXCLUDED_NAMES.some(ex => bookedBy.toLowerCase() === ex.toLowerCase());
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
      // Get all runs by this SA within date range (using run_date for booking-based metrics)
      const saRuns = activeRuns.filter(run => {
        const runDateInRange = isDateInRange(run.run_date, dateRange);
        return run.intro_owner === saName && runDateInRange && run.result !== 'No-show';
      });

      // For linked runs, group by booking to get first runs only
      // For unlinked runs, count each one as a unique intro
      const runsByBooking = new Map<string, IntroRun[]>();
      const unlinkedRuns: IntroRun[] = [];
      
      saRuns.forEach(run => {
        if (run.linked_intro_booked_id) {
          // Check if it's linked to a first intro booking
          if (firstIntroBookingIds.has(run.linked_intro_booked_id)) {
            const existing = runsByBooking.get(run.linked_intro_booked_id) || [];
            existing.push(run);
            runsByBooking.set(run.linked_intro_booked_id, existing);
          }
        } else {
          // Unlinked runs count directly
          unlinkedRuns.push(run);
        }
      });

      // Count intros run: unique bookings where SA ran any non-no-show intro + unlinked runs
      // FIX: Track whether ANY run for a booking resulted in a sale (not just first run)
      let introsRunCount = 0;
      let salesCount = 0;
      let salesCommission = 0;
      const saFirstRuns: IntroRun[] = [];
      
      const MEMBERSHIP_RESULTS = ['premier', 'elite', 'basic'];
      const isMembershipSale = (result: string) => {
        const lower = (result || '').toLowerCase();
        return MEMBERSHIP_RESULTS.some(m => lower.includes(m));
      };
      
      // Count linked runs - check ALL runs per booking for sale outcome
      runsByBooking.forEach((runs) => {
        const sortedRuns = [...runs].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const firstValidRun = sortedRuns[0]; // First non-no-show run determines "ran"
        if (firstValidRun) {
          introsRunCount++;
          saFirstRuns.push(firstValidRun);
          
          // Check if ANY run for this booking has a sale result
          const saleRun = runs.find(r => {
            const saleDate = r.buy_date || r.run_date;
            const saleDateInRange = isDateInRange(saleDate, dateRange);
            return isMembershipSale(r.result) && saleDateInRange;
          });
          
          if (saleRun) {
            salesCount++;
            salesCommission += saleRun.commission_amount || 0;
          }
        }
      });
      
      // Add unlinked runs
      unlinkedRuns.forEach(run => {
        introsRunCount++;
        saFirstRuns.push(run);
        const saleDate = run.buy_date || run.run_date;
        const saleDateInRange = isDateInRange(saleDate, dateRange);
        if (isMembershipSale(run.result) && saleDateInRange) {
          salesCount++;
          salesCommission += run.commission_amount || 0;
        }
      });

      const closingRate = introsRunCount > 0 ? (salesCount / introsRunCount) * 100 : 0;

      // Commission from intros (already calculated in salesCommission from any-run-with-sale logic)
      const introCommission = salesCommission;
      
      // Commission from outside sales
      const outsideCommission = sales
        .filter(s => {
          const dateClosed = (s as any).date_closed || s.created_at;
          return s.intro_owner === saName && isDateInRange(dateClosed, dateRange);
        })
        .reduce((sum, s) => sum + (s.commission_amount || 0), 0);
      
      const commission = introCommission + outsideCommission;

      return {
        saName,
        introsRun: introsRunCount,
        sales: salesCount,
        closingRate,
        commission,
      };
    }).filter(m => m.introsRun > 0 || m.sales > 0 || m.commission > 0)
      .sort((a, b) => b.commission - a.commission);

    // =========================================
    // BOOKER STATS (attributed to booked_by)
    // Excludes "Online Intro Offer (self-booked)" lead source from booker stats
    // =========================================
    const EXCLUDED_LEAD_SOURCES_BOOKER = ['Online Intro Offer (self-booked)', 'VIP Class'];
    
    const bookerCounts = new Map<string, { booked: number; showed: number }>();
    firstIntroBookings
      .filter(b => !EXCLUDED_LEAD_SOURCES_BOOKER.includes(b.lead_source)) // Exclude self-booked & VIP lead sources
      .forEach(b => {
        const bookedBy = (b as any).booked_by || b.sa_working_shift;
        if (bookedBy && !EXCLUDED_NAMES.includes(bookedBy)) {
          const existing = bookerCounts.get(bookedBy) || { booked: 0, showed: 0 };
          existing.booked++;
          
          // Check if this booking has a non-no-show run
          const runs = bookingToRuns.get(b.id) || [];
          if (runs.some(run => run.result !== 'No-show')) {
            existing.showed++;
          }
          
          bookerCounts.set(bookedBy, existing);
        }
      });

    const bookerStats: BookerMetrics[] = Array.from(bookerCounts.entries())
      .map(([saName, counts]) => ({
        saName,
        introsBooked: counts.booked,
        introsShowed: counts.showed,
        showRate: counts.booked > 0 ? (counts.showed / counts.booked) * 100 : 0,
        pipelineValue: counts.booked * 10, // Estimate ~$10 avg commission per booking
      }))
      .filter(m => m.introsBooked > 0)
      .sort((a, b) => b.introsBooked - a.introsBooked);

    // =========================================
    // LEAD SOURCE METRICS
    // =========================================
    const MEMBERSHIP_RESULTS_GLOBAL = ['premier', 'elite', 'basic'];
    const isMembershipSaleGlobal = (result: string) => {
      const lower = (result || '').toLowerCase();
      return MEMBERSHIP_RESULTS_GLOBAL.some(m => lower.includes(m));
    };

    // Lead sources - include ALL first intros for complete studio/marketing analytics
    const leadSourceMap = new Map<string, LeadSourceMetrics>();
    firstIntroBookings.forEach(b => {
      const source = b.lead_source || 'Unknown';
      // Include ALL lead sources including self-booked for complete marketing analysis
      const existing = leadSourceMap.get(source) || { source, booked: 0, showed: 0, sold: 0, revenue: 0 };
      existing.booked++;
      
      const runs = bookingToRuns.get(b.id) || [];
      const nonNoShowRun = runs.find(r => r.result !== 'No-show');
      if (nonNoShowRun) {
        existing.showed++;
        // Check if ANY run has a sale result
        const saleRun = runs.find(r => isMembershipSaleGlobal(r.result));
        if (saleRun) {
          existing.sold++;
          existing.revenue += saleRun.commission_amount || 0;
        }
      }
      
      leadSourceMap.set(source, existing);
    });

    const leadSourceMetrics = Array.from(leadSourceMap.values())
      .sort((a, b) => b.booked - a.booked);

    // =========================================
    // PIPELINE METRICS - include ALL first intros for complete studio view
    // =========================================
    const pipelineBooked = firstIntroBookings.length;
    let pipelineShowed = 0;
    let pipelineSold = 0;
    let pipelineRevenue = 0;

    firstIntroBookings.forEach(b => {
      const runs = bookingToRuns.get(b.id) || [];
      const nonNoShowRun = runs.find(r => r.result !== 'No-show');
      if (nonNoShowRun) {
        pipelineShowed++;
        // Check if ANY run has a sale result
        const saleRun = runs.find(r => isMembershipSaleGlobal(r.result));
        if (saleRun) {
          pipelineSold++;
          pipelineRevenue += saleRun.commission_amount || 0;
        }
      }
    });

    const pipeline: PipelineMetrics = {
      booked: pipelineBooked,
      showed: pipelineShowed,
      sold: pipelineSold,
      revenue: pipelineRevenue,
    };

    // =========================================
    // TODAY'S RACE
    // =========================================
    const todaysRuns = activeRuns.filter(r => r.run_date && isToday(parseLocalDate(r.run_date)));
    const todaysRaceMap = new Map<string, { introsRun: number; sales: number }>();
    
    todaysRuns.forEach(run => {
      const name = run.intro_owner || run.sa_name;
      if (name && !EXCLUDED_NAMES.includes(name)) {
        const existing = todaysRaceMap.get(name) || { introsRun: 0, sales: 0 };
        if (run.result !== 'No-show') {
          existing.introsRun++;
          // FIX: Use result string to detect sales, not commission_amount
          if (isMembershipSaleGlobal(run.result)) {
            existing.sales++;
          }
        }
        todaysRaceMap.set(name, existing);
      }
    });

    const todaysRace: TodaysRaceEntry[] = Array.from(todaysRaceMap.entries())
      .map(([name, data]) => ({
        name,
        introsRun: data.introsRun,
        sales: data.sales,
        isCurrentUser: name === currentUserName,
      }))
      .sort((a, b) => b.introsRun - a.introsRun);

    // =========================================
    // STUDIO METRICS (aggregated)
    // =========================================
    const studioIntrosRun = perSAData.reduce((sum, m) => sum + m.introsRun, 0);
    const studioIntroSales = perSAData.reduce((sum, m) => sum + m.sales, 0);
    const studioClosingRate = studioIntrosRun > 0 ? (studioIntroSales / studioIntrosRun) * 100 : 0;
    const studioCommission = perSAData.reduce((sum, m) => sum + m.commission, 0);


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
    const topBookers: LeaderEntry[] = Array.from(bookerCounts.entries())
      .map(([name, counts]) => ({ name, value: counts.booked }))
      .sort((a, b) => b.value - a.value);

    // Top Commission (include all participants for ranking)
    const allCommissionEntries: LeaderEntry[] = perSAData
      .map(m => ({ name: m.saName, value: m.commission }))
      .sort((a, b) => b.value - a.value);

    const topCommission = allCommissionEntries.slice(0, 3);

    // Best Closing % (minimum 3 intros to qualify)
    const MIN_INTROS_FOR_CLOSING = 1;
    const allClosingEntries: LeaderEntry[] = perSAData
      .filter(m => m.introsRun >= MIN_INTROS_FOR_CLOSING)
      .map(m => ({ 
        name: m.saName, 
        value: m.closingRate, 
        subValue: `${m.sales}/${m.introsRun}` 
      }))
      .sort((a, b) => b.value - a.value);

    const topClosing = allClosingEntries.slice(0, 3);

    // Best Show Rate (booking-based, credited to booked_by)
    const MIN_BOOKINGS_FOR_SHOWRATE = 3;
    const allShowRateEntries: LeaderEntry[] = [];
    bookerCounts.forEach((counts, saName) => {
      if (counts.booked >= MIN_BOOKINGS_FOR_SHOWRATE) {
        const showRate = counts.booked > 0 ? (counts.showed / counts.booked) * 100 : 0;
        allShowRateEntries.push({ 
          name: saName, 
          value: showRate, 
          subValue: `${counts.showed}/${counts.booked}` 
        });
      }
    });
    allShowRateEntries.sort((a, b) => b.value - a.value);

    const topShowRate = allShowRateEntries.slice(0, 3);

    // Participant counts for My Rank
    const participantCounts = {
      bookers: bookerCounts.size,
      commission: allCommissionEntries.length,
      closing: allClosingEntries.length,
      showRate: allShowRateEntries.length,
    };

    return {
      studio: {
        introsRun: studioIntrosRun,
        introSales: studioIntroSales,
        closingRate: studioClosingRate,
        totalCommission: studioCommission,
      },
      perSA: perSAData,
      bookerStats,
      individualActivity,
      leadSourceMetrics,
      pipeline,
      todaysRace,
      leaderboards: {
        topBookers,
        topCommission,
        topClosing,
        topShowRate,
      },
      participantCounts,
    };
  }, [introsBooked, introsRun, sales, dateRange, shiftRecaps, currentUserName]);
}
