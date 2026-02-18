/**
 * Pure selector functions for Pipeline data.
 * No Supabase calls. Only transforms.
 */
import { isMembershipSale } from '@/lib/sales-detection';
import { capitalizeNameOrNull, getLocalDateString } from './helpers';
import type {
  PipelineBooking,
  PipelineRun,
  ClientJourney,
  JourneyTab,
  TabCounts,
} from './pipelineTypes';

// ── Helpers ──

function capitalizeNameSafe(name: string | null | undefined): string | null {
  if (!name) return null;
  return name.replace(/\b\w/g, c => c.toUpperCase());
}

function isBookingPast(booking: PipelineBooking): boolean {
  const now = new Date();
  const today = getLocalDateString(now);
  if (booking.class_date < today) return true;
  if (booking.class_date > today) return false;
  if (!booking.intro_time) return false;
  const currentTime = now.toTimeString().slice(0, 5);
  return booking.intro_time <= currentTime;
}

function isBookingToday(booking: PipelineBooking): boolean {
  return booking.class_date === getLocalDateString(new Date());
}

function isBookingUpcoming(booking: PipelineBooking): boolean {
  const now = new Date();
  const today = getLocalDateString(now);
  if (booking.class_date > today) return true;
  if (booking.class_date < today) return false;
  if (!booking.intro_time) return true;
  const currentTime = now.toTimeString().slice(0, 5);
  return booking.intro_time > currentTime;
}

function hasPurchasedMembership(journey: ClientJourney): boolean {
  const hasSaleResult = journey.runs.some(r => isMembershipSale(r.result));
  const hasClosedBooking = journey.bookings.some(
    b => b.booking_status_canon === 'CLOSED_PURCHASED' || b.booking_status === 'Closed (Purchased)'
  );
  return hasSaleResult || hasClosedBooking;
}

// ── Build Journeys ──

export function buildJourneys(
  bookings: PipelineBooking[],
  runs: PipelineRun[],
): ClientJourney[] {
  const clientMap = new Map<string, { bookings: PipelineBooking[]; runs: PipelineRun[] }>();

  bookings.forEach(b => {
    const key = b.member_name.toLowerCase().replace(/\s+/g, '');
    if (!clientMap.has(key)) clientMap.set(key, { bookings: [], runs: [] });
    clientMap.get(key)!.bookings.push(b);
  });

  runs.forEach(r => {
    const key = r.member_name.toLowerCase().replace(/\s+/g, '');
    if (!clientMap.has(key)) clientMap.set(key, { bookings: [], runs: [] });
    clientMap.get(key)!.runs.push(r);
  });

  const journeys: ClientJourney[] = [];

  clientMap.forEach((data, key) => {
    const memberName = data.bookings[0]?.member_name || data.runs[0]?.member_name || key;
    let hasInconsistency = false;
    let inconsistencyType: string | null = null;

    data.runs.forEach(run => {
      if (run.linked_intro_booked_id) {
        const linked = data.bookings.find(b => b.id === run.linked_intro_booked_id);
        if (linked) {
          const runOwner = run.intro_owner || run.ran_by;
          if (runOwner && linked.intro_owner !== runOwner && run.result !== 'No-show') {
            hasInconsistency = true;
            inconsistencyType = `Run shows ${runOwner} but booking shows ${linked.intro_owner || 'none'}`;
          }
        }
      }
    });

    data.bookings.forEach(b => {
      if (b.intro_owner && b.intro_owner.includes('T') && b.intro_owner.includes(':')) {
        hasInconsistency = true;
        inconsistencyType = 'Corrupted intro_owner (timestamp value)';
      }
    });

    // Determine status using canon fields first
    let status: ClientJourney['status'] = 'unknown';
    const hasSale = data.runs.some(r => isMembershipSale(r.result));
    const hasNotInterested = data.bookings.some(
      b => b.booking_status_canon === 'NOT_INTERESTED' || b.booking_status === 'Not interested'
    );
    const hasClosed = data.bookings.some(
      b => b.booking_status_canon === 'CLOSED_PURCHASED' || b.booking_status === 'Closed (Purchased)'
    );
    const hasActive = data.bookings.some(
      b => b.booking_status_canon === 'ACTIVE' || b.booking_status === 'Active' || !b.booking_status
    );
    const hasNoShow = data.runs.some(
      r => r.result_canon === 'NO_SHOW' || r.result === 'No-show'
    );

    if (hasSale || hasClosed) status = 'purchased';
    else if (hasNotInterested) status = 'not_interested';
    else if (hasNoShow && !hasActive) status = 'no_show';
    else if (hasActive) status = 'active';

    const latestRun = data.runs.find(r => r.result !== 'No-show');
    const latestIntroOwner = latestRun?.intro_owner || latestRun?.ran_by || data.bookings[0]?.intro_owner || null;
    const totalCommission = data.runs.reduce((sum, r) => sum + (r.commission_amount || 0), 0);

    journeys.push({
      memberKey: key,
      memberName: capitalizeNameSafe(memberName) || memberName,
      bookings: data.bookings,
      runs: data.runs,
      hasInconsistency,
      inconsistencyType,
      hasSale,
      totalCommission,
      latestIntroOwner: capitalizeNameSafe(latestIntroOwner),
      status,
    });
  });

  // Sort: inconsistencies first, then by recent activity
  journeys.sort((a, b) => {
    if (a.hasInconsistency && !b.hasInconsistency) return -1;
    if (!a.hasInconsistency && b.hasInconsistency) return 1;
    const aDate = a.runs[0]?.run_date || a.bookings[0]?.class_date || '';
    const bDate = b.runs[0]?.run_date || b.bookings[0]?.class_date || '';
    return bDate.localeCompare(aDate);
  });

  return journeys;
}

// ── Tab Counts ──

export function computeTabCounts(journeys: ClientJourney[]): TabCounts {
  const counts: TabCounts = {
    all: 0, upcoming: 0, today: 0, completed: 0, no_show: 0,
    missed_guest: 0, second_intro: 0, not_interested: 0, by_lead_source: 0, vip_class: 0, leads: 0,
  };

  journeys.forEach(journey => {
    counts.all++;
    counts.by_lead_source++;

    const latestActiveBooking = journey.bookings.find(
      b => b.booking_status_canon === 'ACTIVE' || !b.booking_status || b.booking_status === 'Active'
    );
    const hasPurchased = hasPurchasedMembership(journey);

    if (journey.runs.length > 0 && journey.runs.some(r => r.result !== 'No-show')) counts.completed++;
    if (latestActiveBooking && isBookingUpcoming(latestActiveBooking)) counts.upcoming++;
    if (latestActiveBooking && isBookingToday(latestActiveBooking)) counts.today++;

    const hasActiveBooking = journey.bookings.some(
      b => (b.booking_status_canon === 'ACTIVE' || !b.booking_status || b.booking_status === 'Active') && isBookingPast(b)
    );
    const hasValidRun = journey.runs.some(r => r.result !== 'No-show');
    if (!hasPurchased && hasActiveBooking && !hasValidRun && journey.runs.every(r => !r || r.result === 'No-show')) {
      counts.no_show++;
    }

    const hasMissedResult = journey.runs.some(
      r => r.result === 'Follow-up needed' || r.result === 'Booked 2nd intro'
    );
    if (!hasPurchased && hasMissedResult) counts.missed_guest++;

    const has2ndIntro = journey.bookings.some(b => b.originating_booking_id) ||
      journey.runs.some(r => r.result === 'Booked 2nd intro') ||
      (journey.bookings.length > 1 && journey.bookings.some(b =>
        (b.booking_status_canon === 'ACTIVE' || !b.booking_status || b.booking_status === 'Active') && isBookingUpcoming(b)
      ) && journey.runs.length > 0);
    if (!hasPurchased && has2ndIntro) counts.second_intro++;

    if (journey.bookings.some(b => b.booking_status_canon === 'NOT_INTERESTED' || b.booking_status === 'Not interested')) {
      counts.not_interested++;
    }

    if (journey.bookings.some(b => b.lead_source === 'VIP Class')) counts.vip_class++;
  });

  return counts;
}

// ── Filter by Tab ──

export function filterJourneysByTab(
  journeyList: ClientJourney[],
  tab: JourneyTab,
  selectedLeadSource: string | null,
): ClientJourney[] {
  // VIP or COMP exclusion helper
  const isExcludedJourney = (j: ClientJourney) =>
    j.bookings.some(b =>
      b.lead_source === 'VIP Class' ||
      (b as any).is_vip === true ||
      (b as any).booking_type_canon === 'VIP' ||
      (b as any).booking_type_canon === 'COMP' ||
      (b.lead_source && b.lead_source.toLowerCase().includes('vip'))
    );

  if (tab === 'vip_class') {
    return journeyList.filter(j => isExcludedJourney(j));
  }

  // All non-VIP/COMP tabs: exclude those journeys
  const nonVipJourneys = journeyList.filter(j => !isExcludedJourney(j));
  if (tab === 'all') return nonVipJourneys;

  return nonVipJourneys.filter(journey => {
    const latestActiveBooking = journey.bookings.find(
      b => b.booking_status_canon === 'ACTIVE' || !b.booking_status || b.booking_status === 'Active'
    );
    const hasPurchased = hasPurchasedMembership(journey);

    switch (tab) {
      case 'upcoming':
        return latestActiveBooking && isBookingUpcoming(latestActiveBooking);
      case 'today':
        return latestActiveBooking && isBookingToday(latestActiveBooking);
      case 'completed':
        return journey.runs.length > 0 && journey.runs.some(r => r.result !== 'No-show');
      case 'no_show': {
        if (hasPurchased) return false;
        const hasActiveBooking = journey.bookings.some(
          b => (b.booking_status_canon === 'ACTIVE' || !b.booking_status || b.booking_status === 'Active') && isBookingPast(b)
        );
        const hasValidRun = journey.runs.some(r => r.result !== 'No-show');
        return hasActiveBooking && !hasValidRun && journey.runs.every(r => !r || r.result === 'No-show');
      }
      case 'missed_guest':
        if (hasPurchased) return false;
        return journey.runs.some(r => r.result === 'Follow-up needed' || r.result === 'Booked 2nd intro');
      case 'second_intro':
        if (hasPurchased) return false;
        return journey.bookings.some(b => b.originating_booking_id) ||
          journey.runs.some(r => r.result === 'Booked 2nd intro') ||
          (journey.bookings.length > 1 && journey.bookings.some(b =>
            (b.booking_status_canon === 'ACTIVE' || !b.booking_status || b.booking_status === 'Active') && isBookingUpcoming(b)
          ) && journey.runs.length > 0);
      case 'not_interested':
        return journey.bookings.some(b => b.booking_status_canon === 'NOT_INTERESTED' || b.booking_status === 'Not interested');
      case 'by_lead_source':
        if (selectedLeadSource) return journey.bookings.some(b => b.lead_source === selectedLeadSource);
        return true;
      default:
        return true;
    }
  });
}

// ── Search Filter ──

export function filterBySearch(journeys: ClientJourney[], searchTerm: string): ClientJourney[] {
  if (!searchTerm) return journeys;
  const term = searchTerm.toLowerCase();
  return journeys.filter(
    j => j.memberName.toLowerCase().includes(term) || j.latestIntroOwner?.toLowerCase().includes(term)
  );
}

// ── Lead source options ──

export function getLeadSourceOptions(journeys: ClientJourney[]): string[] {
  const sources = new Set<string>();
  journeys.forEach(j => j.bookings.forEach(b => { if (b.lead_source) sources.add(b.lead_source); }));
  return Array.from(sources).sort();
}

// ── VIP grouping ──

export function groupByVipClass(journeys: ClientJourney[]): [string, ClientJourney[]][] {
  const groups: Record<string, ClientJourney[]> = {};
  journeys.forEach(j => {
    const className = j.bookings.find(b => b.vip_class_name)?.vip_class_name || 'Ungrouped';
    if (!groups[className]) groups[className] = [];
    groups[className].push(j);
  });
  return Object.entries(groups).sort(([a], [b]) => {
    if (a === 'Ungrouped') return 1;
    if (b === 'Ungrouped') return -1;
    return a.localeCompare(b);
  });
}
