/**
 * Canonical "which surface counts this booking?" helper for the drift alert.
 *
 * Three surfaces:
 *  - Studio Scoreboard  → uses pipelineShowed = first-intro bookings (in date
 *                         range, past+today) that have at least one ran run.
 *  - Per-SA Runner Stats → same first-intro set, but only if the run has a
 *                          valid intro_owner (not excluded, not blank).
 *  - Conversion Funnel  → first.showed + second.showed from
 *                         computeFunnelBothRows (orphan-promoted, with
 *                         personHasPassedSecond suppression of 1sts).
 *
 * For each booking that surfaces in ANY of the three but not ALL, we surface
 * a DriftItem with a human-readable reason and a list of suggested fixes.
 */
import { IntroBooked, IntroRun } from '@/context/DataContext';
import { DateRange } from '@/lib/pay-period';
import { didIntroActuallyRun } from '@/lib/canon/introRules';
import { isRunInRange } from '@/lib/sales-detection';
import {
  resolvePromotedOrphanBookingIds,
  isFirstIntroForMetrics,
} from '@/lib/intros/orphanedFirstIntros';
import { isBookingExcludedFromMetrics } from '@/lib/intros/excludedBookings';
import { EXCLUDED_SA_NAMES } from '@/lib/studio-metrics';
import { computeFunnelBothRows } from '@/components/dashboard/ConversionFunnel';
import { getTodayYMD } from '@/lib/dateUtils';

export type SurfaceName = 'Scoreboard' | 'Per-SA' | 'Funnel';

export type FixAction =
  | 'promote_to_first_intro'   // clear originating_booking_id
  | 'assign_intro_owner'        // open owner picker
  | 'toggle_ignore_metrics'     // flip ignore_from_metrics
  | 'toggle_vip'                // flip is_vip
  | 'view_booking';             // open detail

export interface DriftItem {
  bookingId: string;
  memberName: string;
  classDate: string;
  introOwner: string | null;
  bookedBy: string | null;
  in: SurfaceName[];
  missingFrom: SurfaceName[];
  reasonCode:
    | 'orphan_parent_excluded'
    | 'missing_intro_owner'
    | 'excluded_sa_owner'
    | 'second_intro_outside_funnel_first'
    | 'first_intro_suppressed_by_passed_second'
    | 'booking_excluded_but_run_counted'
    | 'no_ran_run'
    | 'unknown';
  reasonText: string;
  suggestedFixes: FixAction[];
}

interface Args {
  introsBooked: IntroBooked[];
  introsRun: IntroRun[];
  dateRange: DateRange | null | undefined;
}

function hasBookingPassed(b: IntroBooked, now = new Date()): boolean {
  const [y, m, d] = b.class_date.split('-').map(Number);
  const introTime = (b as any).intro_time as string | null | undefined;
  if (introTime) {
    const match = introTime.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      return new Date(y, m - 1, d, +match[1], +match[2]) <= now;
    }
  }
  return new Date(y, m - 1, d, 23, 59, 59) <= now;
}

function isDateInRange(ymd: string, range: DateRange | null | undefined): boolean {
  if (!range) return true;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt >= range.start && dt <= range.end;
}

function nameKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '');
}

export interface SourceMembershipResult {
  scoreboardRan: number;
  perSARan: number;
  funnelRan: number;
  drift: DriftItem[];
}

export function computeSourceMembership({
  introsBooked,
  introsRun,
  dateRange,
}: Args): SourceMembershipResult {
  // 1. Build active sets (mirror useDashboardMetrics)
  const activeBookings = introsBooked.filter(b => !isBookingExcludedFromMetrics(b));
  const vipBookingIds = new Set(
    introsBooked.filter(b => (b as any).is_vip === true).map(b => b.id),
  );
  const activeRuns = introsRun.filter(r => {
    const isIgnored = (r as any).ignore_from_metrics === true;
    const isVipRun = r.linked_intro_booked_id && vipBookingIds.has(r.linked_intro_booked_id);
    return !isIgnored && !isVipRun;
  });

  const promotedOrphanIds = resolvePromotedOrphanBookingIds(activeBookings, activeRuns);

  // 2. First-intro set (Scoreboard + Per-SA denominator)
  const todayYMD = getTodayYMD();
  const firstIntroBookings = activeBookings.filter(b => {
    if (!isFirstIntroForMetrics(b as any, promotedOrphanIds)) return false;
    if (!isDateInRange(b.class_date, dateRange ?? null)) return false;
    return true;
  });
  const pastAndTodayFirsts = firstIntroBookings.filter(b => {
    if (b.class_date > todayYMD) return false;
    if (b.class_date < todayYMD) return true;
    return hasBookingPassed(b);
  });

  // 3. Per-booking ran run lookup
  const runsByBooking = new Map<string, IntroRun[]>();
  activeRuns.forEach(r => {
    if (!r.linked_intro_booked_id) return;
    const arr = runsByBooking.get(r.linked_intro_booked_id) || [];
    arr.push(r);
    runsByBooking.set(r.linked_intro_booked_id, arr);
  });

  const scoreboardSet = new Set<string>();
  const perSASet = new Set<string>();
  pastAndTodayFirsts.forEach(b => {
    const runs = runsByBooking.get(b.id) || [];
    const ranRun = runs.find(r => didIntroActuallyRun(r) && isRunInRange(r, dateRange ?? null));
    if (!ranRun) return;
    scoreboardSet.add(b.id);
    const owner = ranRun.intro_owner;
    const ownerValid =
      !!owner && !EXCLUDED_SA_NAMES.some(ex => ex.toLowerCase() === owner.toLowerCase());
    if (ownerValid) perSASet.add(b.id);
  });

  // 4. Funnel set — map funnel showed people back to booking IDs
  const funnel = computeFunnelBothRows(introsBooked, introsRun, dateRange ?? null);
  const funnelShowedKeys = new Set<string>();
  [...funnel.first.showedPeople, ...funnel.second.showedPeople].forEach(p => {
    funnelShowedKeys.add(`${nameKey(p.name)}|${p.date}`);
  });

  // Build name+date → bookingId for active bookings so we can correlate
  const keyToBookingId = new Map<string, string>();
  activeBookings.forEach(b => {
    keyToBookingId.set(`${nameKey(b.member_name)}|${b.class_date}`, b.id);
  });

  const funnelSet = new Set<string>();
  funnelShowedKeys.forEach(k => {
    const id = keyToBookingId.get(k);
    if (id) funnelSet.add(id);
  });

  // 5. Diff
  const allBookingIds = new Set<string>([...scoreboardSet, ...perSASet, ...funnelSet]);
  const bookingById = new Map<string, IntroBooked>();
  introsBooked.forEach(b => bookingById.set(b.id, b));

  const drift: DriftItem[] = [];
  allBookingIds.forEach(id => {
    const inSb = scoreboardSet.has(id);
    const inPs = perSASet.has(id);
    const inFn = funnelSet.has(id);
    if (inSb && inPs && inFn) return; // all agree

    const b = bookingById.get(id);
    if (!b) return;
    const runs = runsByBooking.get(id) || [];
    const ranRun = runs.find(r => didIntroActuallyRun(r));
    const owner = ranRun?.intro_owner ?? b.intro_owner ?? null;
    const ownerExcluded =
      !!owner && EXCLUDED_SA_NAMES.some(ex => ex.toLowerCase() === owner.toLowerCase());

    const inList: SurfaceName[] = [];
    const missList: SurfaceName[] = [];
    (['Scoreboard', 'Per-SA', 'Funnel'] as SurfaceName[]).forEach(s => {
      const present = s === 'Scoreboard' ? inSb : s === 'Per-SA' ? inPs : inFn;
      (present ? inList : missList).push(s);
    });

    // Reason inference
    let reasonCode: DriftItem['reasonCode'] = 'unknown';
    let reasonText = 'Counted inconsistently across surfaces.';
    const fixes: FixAction[] = ['view_booking'];

    if (!owner && (inSb || inFn) && !inPs) {
      reasonCode = 'missing_intro_owner';
      reasonText = 'Run has no intro_owner — Per-SA can\'t attribute it.';
      fixes.unshift('assign_intro_owner');
    } else if (ownerExcluded && (inSb || inFn) && !inPs) {
      reasonCode = 'excluded_sa_owner';
      reasonText = `intro_owner "${owner}" is in the excluded staff list.`;
      fixes.unshift('assign_intro_owner');
    } else if (inSb && inPs && !inFn) {
      // Scoreboard/Per-SA counted but funnel skipped
      const origId = (b as any).originating_booking_id;
      const isPromotedOrphan = promotedOrphanIds.has(id);
      if (origId && !isPromotedOrphan) {
        reasonCode = 'orphan_parent_excluded';
        reasonText = 'Booking has originating_booking_id → funnel treats it as 2nd intro. May need to promote to 1st intro.';
        fixes.unshift('promote_to_first_intro');
      } else {
        reasonCode = 'first_intro_suppressed_by_passed_second';
        reasonText = 'Funnel suppressed this 1st intro because the member already had a 2nd intro pass.';
      }
    } else if (inFn && !inSb) {
      reasonCode = 'second_intro_outside_funnel_first';
      reasonText = 'Funnel counts this (likely 2nd intro) but Scoreboard only counts 1st intros.';
    } else if (!ranRun) {
      reasonCode = 'no_ran_run';
      reasonText = 'No ran run found in range for this booking.';
    }

    if (!fixes.includes('toggle_ignore_metrics')) fixes.push('toggle_ignore_metrics');

    drift.push({
      bookingId: id,
      memberName: b.member_name,
      classDate: b.class_date,
      introOwner: owner,
      bookedBy: (b as any).booked_by || b.sa_working_shift || null,
      in: inList,
      missingFrom: missList,
      reasonCode,
      reasonText,
      suggestedFixes: fixes,
    });
  });

  drift.sort((a, b) => a.classDate.localeCompare(b.classDate));

  return {
    scoreboardRan: scoreboardSet.size,
    perSARan: perSASet.size,
    funnelRan: funnel.first.showed + funnel.second.showed,
    drift,
  };
}
