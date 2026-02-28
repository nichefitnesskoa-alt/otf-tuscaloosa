import { useMemo } from 'react';
import { IntroBooked, IntroRun, Sale, ShiftRecap, FollowUpQueueRow, FollowupTouchRow } from '@/context/DataContext';
import { DateRange } from '@/lib/pay-period';
import { isWithinInterval, isToday, parseISO } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { PerSAMetrics } from '@/components/dashboard/PerSATable';
import { BookerMetrics } from '@/components/dashboard/BookerStatsTable';
import { isMembershipSale, getRunSaleDate, isRunInRange, isSaleInRange } from '@/lib/sales-detection';
import { EXCLUDED_SA_NAMES } from '@/lib/studio-metrics';
import { getTodayYMD } from '@/lib/dateUtils';

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
  noShows: number;
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
  // Touch-based execution metrics
  touchesTodayTotal: number;
  followupsDoneToday: number;
  followupsDueToday: number;
  touchesTodayBySa: Map<string, number>;
  followupsDoneTodayBySa: Map<string, number>;
  followUpConversionsInRange: number;
  // Rebook/saves metrics
  rebooksCreatedInRange: number;
  noShowSavesInRange: number;
  savesToday: number;
  savesBySa: Map<string, number>;
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
  currentUserName?: string,
  followUpQueue: FollowUpQueueRow[] = [],
  followupTouches: FollowupTouchRow[] = [],
): DashboardMetrics {
  return useMemo(() => {
    // Status values that should be excluded from metrics (bad data, duplicates, etc.)
    // NOTE: "Closed (Purchased)" should NOT be excluded - those are successful conversions!
    const EXCLUDED_STATUSES = [
      'Duplicate',
      'Deleted (soft)',
      'DEAD',
    ];
    
    // Use EXCLUDED_SA_NAMES from studio-metrics as the single source of truth
    const EXCLUDED_NAMES = EXCLUDED_SA_NAMES;
    
    // Intentionally narrower than EXCLUDED_LEAD_SOURCES in studio-metrics.ts.
    // Booker stats only exclude self-booked and VIP, not Orangebook/Run-first,
    // because those can still be SA-initiated bookings.
    // Filter out bookings with excluded status, ignored from metrics, or VIP
    const activeBookings = introsBooked.filter(b => {
      // Prefer canon field, fall back to legacy
      const canonStatus = (b as any).booking_status_canon as string | undefined;
      const legacyStatus = ((b as any).booking_status || '').toUpperCase();
      const isExcludedStatus = canonStatus 
        ? ['DELETED_SOFT'].includes(canonStatus) || EXCLUDED_STATUSES.some(s => legacyStatus.includes(s.toUpperCase()))
        : EXCLUDED_STATUSES.some(s => legacyStatus.includes(s.toUpperCase()));
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
    const firstIntroBookings = activeBookings.filter(b => {
      const originatingId = (b as any).originating_booking_id;
      const isFirstIntro = originatingId === null || originatingId === undefined;
      const isInDateRange = isDateInRange(b.class_date, dateRange);
      return isFirstIntro && isInDateRange;
    });

    // Build booking → runs lookup (must be before pastAndTodayBookings)
    const bookingToRuns = new Map<string, IntroRun[]>();
    activeRuns.forEach(run => {
      const bookingId = run.linked_intro_booked_id;
      if (bookingId) {
        const existing = bookingToRuns.get(bookingId) || [];
        existing.push(run);
        bookingToRuns.set(bookingId, existing);
      }
    });

    // Past + today bookings only — used as denominator for show rate & no-shows
    // so future bookings don't deflate the percentage.
    const todayYMD = getTodayYMD();
    // Past bookings + today's bookings that actually have a run record (occurred).
    // Today's bookings with no run yet haven't happened and shouldn't count.
    const pastAndTodayBookings = firstIntroBookings.filter(b => {
      if (b.class_date > todayYMD) return false;
      if (b.class_date < todayYMD) return true;
      // Today: only include if there's a run record
      const runs = bookingToRuns.get(b.id);
      return runs && runs.length > 0;
    });
    
    // First intro bookings excluding self-booked (for studio-wide metrics)
    const firstIntroBookingsNoSelfBooked = firstIntroBookings.filter(b => {
      const bookedBy = (b as any).booked_by || b.sa_working_shift || '';
      return !EXCLUDED_NAMES.some(ex => bookedBy.toLowerCase() === ex.toLowerCase());
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
    // Uses shared utilities from sales-detection.ts:
    //   - isRunInRange() for intros-run count (booking metric)
    //   - isSaleInRange() for sales count (conversion metric)
    //   - getRunSaleDate() for purchase date fallback
    // =========================================

    const perSAData: PerSAMetrics[] = Array.from(allSAs).map(saName => {
      // Get ALL runs by this SA (no date filter yet - we apply date logic per-metric)
      const saAllRuns = activeRuns.filter(run => {
        return run.intro_owner === saName && run.result !== 'No-show';
      });

      // Dual-date filtering: include runs where EITHER run_date OR buy_date is in range
      const saRuns = saAllRuns.filter(run => {
        const runInRange = isRunInRange(run, dateRange);
        const saleInRange = isSaleInRange(run, dateRange);
        return runInRange || saleInRange;
      });

      // For linked runs, group by booking to get first runs only
      // For unlinked runs, count each one as a unique intro
      const runsByBooking = new Map<string, IntroRun[]>();
      const unlinkedRuns: IntroRun[] = [];
      
      saRuns.forEach(run => {
        if (run.linked_intro_booked_id) {
          if (firstIntroBookingIds.has(run.linked_intro_booked_id)) {
            const existing = runsByBooking.get(run.linked_intro_booked_id) || [];
            existing.push(run);
            runsByBooking.set(run.linked_intro_booked_id, existing);
          }
        } else {
          unlinkedRuns.push(run);
        }
      });

      let introsRunCount = 0;
      let salesCount = 0;
      let salesCommission = 0;
      const saFirstRuns: IntroRun[] = [];
      
      // Count linked runs - use run_date for intros, sale date for sales
      runsByBooking.forEach((runs) => {
        const sortedRuns = [...runs].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const firstValidRun = sortedRuns[0];
        if (firstValidRun) {
          // Only count as "intro run" if run_date is in range (booking metric)
          if (isRunInRange(firstValidRun, dateRange)) {
            introsRunCount++;
            saFirstRuns.push(firstValidRun);
          }
          
          // Check if ANY run for this booking has a sale with sale date in range (conversion metric)
          const saleRun = runs.find(r => isSaleInRange(r, dateRange));
          
          if (saleRun) {
            salesCount++;
            salesCommission += saleRun.commission_amount || 0;
          }
        }
      });
      
      // Add unlinked runs - same dual-date logic
      unlinkedRuns.forEach(run => {
        if (isRunInRange(run, dateRange)) {
          introsRunCount++;
          saFirstRuns.push(run);
        }
        if (isSaleInRange(run, dateRange)) {
          salesCount++;
          salesCommission += run.commission_amount || 0;
        }
      });

      // Close Rate = Sales (purchase-date filtered) / Intros Showed (run-date filtered)
      // This can exceed 100% when follow-up purchases from previous periods
      // land in a period with fewer new intros. This is correct behavior:
      // it reflects real revenue attribution for the selected period.
      const closingRate = introsRunCount > 0 ? (salesCount / introsRunCount) * 100 : 0;

      // Commission from intros
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
    // =========================================
    // Intentionally narrower than EXCLUDED_LEAD_SOURCES in studio-metrics.ts.
    // Booker stats only exclude self-booked and VIP, not Orangebook/Run-first,
    // because those can still be SA-initiated bookings.
    const EXCLUDED_LEAD_SOURCES_BOOKER = ['Online Intro Offer (self-booked)', 'VIP Class'];
    
    // Dual approach: total booked from all firstIntroBookings (activity metric),
    // show rate denominator from pastAndTodayBookings only (attendance metric).
    const bookerCounts = new Map<string, { booked: number; showed: number; pastBooked: number }>();
    const pastAndTodayBookingIds = new Set(pastAndTodayBookings.map(b => b.id));
    
    firstIntroBookings
      .filter(b => !EXCLUDED_LEAD_SOURCES_BOOKER.includes(b.lead_source))
      .forEach(b => {
        const bookedBy = (b as any).booked_by || b.sa_working_shift;
        if (bookedBy && !EXCLUDED_NAMES.includes(bookedBy)) {
          const existing = bookerCounts.get(bookedBy) || { booked: 0, showed: 0, pastBooked: 0 };
          existing.booked++;
          if (pastAndTodayBookingIds.has(b.id)) {
            existing.pastBooked++;
          }
          
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
        showRate: counts.pastBooked > 0 ? (counts.showed / counts.pastBooked) * 100 : 0,
        pipelineValue: counts.booked * 10,
      }))
      .filter(m => m.introsBooked > 0)
      .sort((a, b) => b.introsBooked - a.introsBooked);

    // =========================================
    // LEAD SOURCE METRICS
    // Uses isSaleInRange for conversion-based sale detection
    // =========================================
    // Lead source metrics: "booked" = all bookings, showed/sold = past+today only
    const leadSourceMap = new Map<string, LeadSourceMetrics>();
    firstIntroBookings.forEach(b => {
      const source = b.lead_source || 'Unknown';
      const existing = leadSourceMap.get(source) || { source, booked: 0, showed: 0, sold: 0, revenue: 0 };
      existing.booked++;
      
      // Only count showed/sold for past+today bookings
      if (pastAndTodayBookingIds.has(b.id)) {
        const runs = bookingToRuns.get(b.id) || [];
        const nonNoShowRun = runs.find(r => r.result !== 'No-show');
        if (nonNoShowRun) {
          existing.showed++;
          const saleRun = runs.find(r => isSaleInRange(r, dateRange));
          if (saleRun) {
            existing.sold++;
            existing.revenue += saleRun.commission_amount || 0;
          }
        }
      }
      
      leadSourceMap.set(source, existing);
    });

    const leadSourceMetrics = Array.from(leadSourceMap.values())
      .sort((a, b) => b.booked - a.booked);

    // =========================================
    // PIPELINE METRICS - uses isSaleInRange for conversion-based sale detection
    // =========================================
    // Pipeline: "booked" for show rate uses past+today only
    const pipelineBooked = pastAndTodayBookings.length;
    let pipelineShowed = 0;
    let pipelineSold = 0;
    let pipelineRevenue = 0;

    pastAndTodayBookings.forEach(b => {
      const runs = bookingToRuns.get(b.id) || [];
      const nonNoShowRun = runs.find(r => r.result !== 'No-show');
      if (nonNoShowRun) {
        pipelineShowed++;
        const saleRun = runs.find(r => isSaleInRange(r, dateRange));
        if (saleRun) {
          pipelineSold++;
          pipelineRevenue += saleRun.commission_amount || 0;
        }
      }
    });

    // Explicit no-show count: only bookings with a confirmed No-show result
    let pipelineNoShows = 0;
    pastAndTodayBookings.forEach(b => {
      const runs = bookingToRuns.get(b.id) || [];
      if (runs.length > 0 && runs.every(r => r.result === 'No-show')) {
        pipelineNoShows++;
      }
    });

    const pipeline: PipelineMetrics = {
      booked: pipelineBooked,
      showed: pipelineShowed,
      sold: pipelineSold,
      revenue: pipelineRevenue,
      noShows: pipelineNoShows,
    };

    // =========================================
    // TODAY'S RACE - uses isMembershipSale from shared utilities
    // =========================================
    const todaysRuns = activeRuns.filter(r => r.run_date && isToday(parseLocalDate(r.run_date)));
    const todaysRaceMap = new Map<string, { introsRun: number; sales: number }>();
    
    todaysRuns.forEach(run => {
      const name = run.intro_owner || run.sa_name;
      if (name && !EXCLUDED_NAMES.includes(name)) {
        const existing = todaysRaceMap.get(name) || { introsRun: 0, sales: 0 };
        if (run.result !== 'No-show') {
          existing.introsRun++;
          if (isMembershipSale(run.result)) {
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
    // STUDIO METRICS (aggregated from perSA)
    // =========================================
    const studioIntrosRun = perSAData.reduce((sum, m) => sum + m.introsRun, 0);
    // Count unattributed sales (runs with no valid intro_owner) so scoreboard matches funnel
    const attributedSANames = new Set(perSAData.map(m => m.saName));
    let unattributedSales = 0;
    activeRuns.forEach(run => {
      const owner = run.intro_owner;
      const isUnattributed = !owner || EXCLUDED_NAMES.includes(owner) || !attributedSANames.has(owner);
      if (isUnattributed && run.result !== 'No-show' && isSaleInRange(run, dateRange)) {
        unattributedSales++;
      }
    });
    const studioIntroSales = perSAData.reduce((sum, m) => sum + m.sales, 0) + unattributedSales;
    // Close Rate = Sales (purchase-date filtered) / Intros Showed (run-date filtered)
    // This can exceed 100% when follow-up purchases from previous periods
    // land in a period with fewer new intros. This is correct behavior:
    // it reflects real revenue attribution for the selected period.
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
    
    // Top Bookers
    const topBookers: LeaderEntry[] = Array.from(bookerCounts.entries())
      .map(([name, counts]) => ({ name, value: counts.booked }))
      .sort((a, b) => b.value - a.value);

    // Top Commission
    const allCommissionEntries: LeaderEntry[] = perSAData
      .map(m => ({ name: m.saName, value: m.commission }))
      .sort((a, b) => b.value - a.value);

    const topCommission = allCommissionEntries.slice(0, 3);

    // Best Closing %
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

    // Best Show Rate
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

    // =========================================
    // TOUCH-BASED EXECUTION METRICS
    // =========================================
    const today = new Date().toISOString().substring(0, 10);

    // Touches today total
    const touchesTodayTotal = followupTouches.filter(
      t => t.created_at && isToday(parseISO(t.created_at))
    ).length;

    // Follow-ups done today
    const followupsDoneToday = followUpQueue.filter(
      f => f.status === 'sent' && f.sent_at && isToday(parseISO(f.sent_at))
    ).length;

    // Follow-ups due today
    const followupsDueToday = followUpQueue.filter(
      f => f.status === 'pending' && f.scheduled_date <= today
    ).length;

    // Per-SA touches today
    const touchesTodayBySa = new Map<string, number>();
    for (const t of followupTouches) {
      if (t.created_at && isToday(parseISO(t.created_at))) {
        touchesTodayBySa.set(t.created_by, (touchesTodayBySa.get(t.created_by) || 0) + 1);
      }
    }

    // Per-SA follow-ups done today
    const followupsDoneTodayBySa = new Map<string, number>();
    for (const f of followUpQueue) {
      if (f.status === 'sent' && f.sent_at && f.sent_by && isToday(parseISO(f.sent_at))) {
        followupsDoneTodayBySa.set(f.sent_by, (followupsDoneTodayBySa.get(f.sent_by) || 0) + 1);
      }
    }

    // Follow-up conversions: sales where buy_date != run_date
    const followUpConversionsInRange = activeRuns.filter(r => {
      if (!isMembershipSale(r.result)) return false;
      const buyDate = (r as any).buy_date;
      const runDate = r.run_date;
      if (!buyDate || !runDate) return false;
      if (buyDate === runDate) return false;
      return isSaleInRange(r, dateRange);
    }).length;

    // =========================================
    // REBOOK / SAVES METRICS
    // =========================================
    const rebookBookings = introsBooked.filter(b => {
      const rebookedAt = (b as any).rebooked_at;
      if (!rebookedAt) return false;
      if (!dateRange) return true;
      try {
        const d = new Date(rebookedAt);
        return d >= dateRange.start && d <= dateRange.end;
      } catch { return false; }
    });

    const rebooksCreatedInRange = rebookBookings.length;
    const noShowSavesInRange = rebookBookings.filter(b => (b as any).rebook_reason === 'no_show_save').length;
    
    const savesToday = rebookBookings.filter(b => {
      const rebookedAt = (b as any).rebooked_at;
      return rebookedAt && isToday(parseISO(rebookedAt));
    }).length;

    const savesBySa = new Map<string, number>();
    rebookBookings.forEach(b => {
      const by = (b as any).booked_by || b.sa_working_shift;
      if (by) savesBySa.set(by, (savesBySa.get(by) || 0) + 1);
    });

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
      touchesTodayTotal,
      followupsDoneToday,
      followupsDueToday,
      touchesTodayBySa,
      followupsDoneTodayBySa,
      followUpConversionsInRange,
      rebooksCreatedInRange,
      noShowSavesInRange,
      savesToday,
      savesBySa,
    };
  }, [introsBooked, introsRun, sales, dateRange, shiftRecaps, currentUserName, followUpQueue, followupTouches]);
}
