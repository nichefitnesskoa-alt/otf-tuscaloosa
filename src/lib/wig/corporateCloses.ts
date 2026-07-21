/**
 * Corporate "Last Coach" journey close resolution.
 *
 * Scope: WIG · Coach Stats — OTF Corporate section ONLY.
 * A ran intro counts as a corporate Close when EITHER that run itself is a
 * sale, OR the run belongs to a journey chain that ended in a sale (with
 * the sale's buy_date inside the current range). Every ran class in a
 * closed journey gets credit, credited to the coach of that specific run.
 *
 * This does NOT change isCloseRun, isSaleCanon, isMembershipSale, or any
 * commission / Sales tab / Studio / Internal Total-Journey math. Those
 * remain byte-identical.
 */
import { resolveJourneyChainsForBookings, type JourneyChain } from '@/lib/intros/journey';
import { isCloseRun } from '@/lib/intros/close-detection';

export interface CoachedBookingLike {
  id: string;
  originating_booking_id?: string | null;
}

export interface CorporateJourneyLookup {
  /** Root-booking-id → JourneyChain. */
  chainsByRoot: Map<string, JourneyChain>;
  /**
   * Returns true when the booking's journey chain has at least one sale run
   * whose buy_date is within [rangeStart, rangeEnd] (YYYY-MM-DD, inclusive).
   */
  isJourneyClosedInRange(bookingId: string): boolean;
}

export async function resolveCorporateJourneyChains(
  coachedBookings: CoachedBookingLike[],
  rangeStart: string,
  rangeEnd: string,
): Promise<CorporateJourneyLookup> {
  const rootByBookingId = new Map<string, string>();
  for (const b of coachedBookings) {
    rootByBookingId.set(b.id, b.originating_booking_id || b.id);
  }
  const rootIds = Array.from(new Set(rootByBookingId.values()));
  const chainsByRoot = await resolveJourneyChainsForBookings(rootIds);

  const rootHasInRangeSale = new Map<string, boolean>();
  for (const [rootId, chain] of chainsByRoot) {
    if (!chain.isClosed) { rootHasInRangeSale.set(rootId, false); continue; }
    const soldIds = new Set(chain.soldBookings.map(b => b.id));
    const hit = chain.runs.some(r => {
      if (!r.linked_intro_booked_id || !soldIds.has(r.linked_intro_booked_id)) return false;
      if (!isCloseRun(r)) return false; // respects post-dated buy_date guard
      const bd = r.buy_date;
      if (!bd) return false;
      return bd >= rangeStart && bd <= rangeEnd;
    });
    rootHasInRangeSale.set(rootId, hit);
  }

  return {
    chainsByRoot,
    isJourneyClosedInRange(bookingId: string): boolean {
      const root = rootByBookingId.get(bookingId);
      if (!root) return false;
      return rootHasInRangeSale.get(root) === true;
    },
  };
}
