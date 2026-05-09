// Source of truth for "did this intro close." Every consumer uses this. No second implementation anywhere.
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
 */
export async function resolveClosedFirstIntroIds(
  firstIntroBookingIds: string[]
): Promise<Set<string>> {
  const closed = new Set<string>();
  if (!firstIntroBookingIds.length) return closed;

  // Direct sales on the booking's own runs.
  for (let i = 0; i < firstIntroBookingIds.length; i += 500) {
    const batch = firstIntroBookingIds.slice(i, i + 500);
    const { data: runs } = await supabase
      .from('intros_run')
      .select('linked_intro_booked_id, result, result_canon')
      .in('linked_intro_booked_id', batch);
    (runs || []).forEach((r: any) => {
      if (!r.linked_intro_booked_id) return;
      if (isCloseRun(r)) closed.add(r.linked_intro_booked_id);
    });
  }

  // Total Journey: find chained 2nd-intro bookings and their sale runs.
  const childrenByOrigin = new Map<string, string[]>();
  for (let i = 0; i < firstIntroBookingIds.length; i += 500) {
    const batch = firstIntroBookingIds.slice(i, i + 500);
    const { data: chained } = await supabase
      .from('intros_booked')
      .select('id, originating_booking_id')
      .in('originating_booking_id', batch);
    (chained || []).forEach((c: any) => {
      if (!c.originating_booking_id) return;
      const arr = childrenByOrigin.get(c.originating_booking_id) || [];
      arr.push(c.id);
      childrenByOrigin.set(c.originating_booking_id, arr);
    });
  }

  const allChildIds = Array.from(new Set(Array.from(childrenByOrigin.values()).flat()));
  const childSales = new Set<string>();
  for (let i = 0; i < allChildIds.length; i += 500) {
    const batch = allChildIds.slice(i, i + 500);
    if (!batch.length) continue;
    const { data: childRuns } = await supabase
      .from('intros_run')
      .select('linked_intro_booked_id, result, result_canon')
      .in('linked_intro_booked_id', batch);
    (childRuns || []).forEach((r: any) => {
      if (r.linked_intro_booked_id && isCloseRun(r)) childSales.add(r.linked_intro_booked_id);
    });
  }

  childrenByOrigin.forEach((kids, originId) => {
    if (kids.some(k => childSales.has(k))) closed.add(originId);
  });

  return closed;
}
