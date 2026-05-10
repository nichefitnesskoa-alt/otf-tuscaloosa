// Source of truth for close detection. Do not reimplement.
// If you find inline `isMembershipSale(r.result)` in a close-detection
// context, replace with `isCloseRun`. For canon-only checks use
// `isSaleCanon` / `SALE_CANONS` from '@/lib/sales-detection'.
import { supabase } from '@/integrations/supabase/client';
import { isCloseResult } from '@/lib/intros/resultLabels';

export interface RunRow {
  result_canon?: string | null;
  result?: string | null;
}

/** Pure predicate on a single intros_run row. Routes through canonical helper. */
export function isCloseRun(run: RunRow): boolean {
  return isCloseResult(run);
}

/**
 * Given a set of first-intro booking IDs, returns the set of those IDs whose
 * Total Journey ended in a sale — either a direct sale on one of the booking's
 * own runs, or a sale on a downstream 2nd-intro chained via originating_booking_id.
 *
 * Thin wrapper over the canonical journey traversal in @/lib/intros/journey.
 */
export async function resolveClosedFirstIntroIds(
  firstIntroBookingIds: string[]
): Promise<Set<string>> {
  const closed = new Set<string>();
  if (!firstIntroBookingIds.length) return closed;

  const { resolveJourneyChainsForBookings } = await import('./journey');
  const chains = await resolveJourneyChainsForBookings(firstIntroBookingIds);
  chains.forEach((chain, rootId) => {
    if (chain.isClosed) closed.add(rootId);
  });
  return closed;
}
