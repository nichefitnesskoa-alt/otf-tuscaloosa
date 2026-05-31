/**
 * Canonical helper: SA sales for the weekly Sales goal.
 *
 * Single source of truth for the SA "sales" metric used by:
 *   - WIG SA leaderboard (tile + per-SA column + drilldown)
 *   - Own It SA Weekly Goals card
 *
 * Definition of an SA-countable sale:
 *   A row in intros_run whose result_canon is in the canonical sale set
 *   (SALE_CANONS via isSaleCanon), not ignore_from_metrics, and not a
 *   post-dated future sale (until buy_date arrives, it does not count).
 *   ON_5_CLASS_PACK is NOT a sale (free trial pack).
 *
 * Attribution (each sale counts exactly ONCE):
 *   - Credit goes to intro_owner on the linked intros_booked row
 *     (the SA who gets commission). NOT booked_by, NOT coach_name.
 *   - If linked booking has no intro_owner → uncredited, never guessed.
 *
 * Week boundary: Monday-start, America/Chicago.
 * Date field for "when the sale closed": getRunSaleDate fallback
 *   (buy_date > run_date > created_at).
 */
import { isSaleCanon, getRunSaleDate, isEffectiveSale } from '@/lib/sales-detection';
import { PHANTOM_BOOKED_BY } from '@/lib/sa/leadsBooked';

export interface SaSaleRunInput {
  id: string;
  result_canon: string | null;
  result?: string | null;
  buy_date: string | null;
  run_date: string | null;
  created_at: string;
  linked_intro_booked_id: string | null;
  ignore_from_metrics?: boolean | null;
}

export interface SaSaleBookingLite {
  id: string;
  intro_owner: string | null;
  member_name?: string | null;
}

/** Pure predicate: does this run qualify as an SA-countable sale? */
export function isSaCountableSale(r: SaSaleRunInput): boolean {
  if (r.ignore_from_metrics) return false;
  if (!isSaleCanon(r.result_canon)) return false;
  // isEffectiveSale handles post-dated future buys (excluded until buy_date arrives).
  return isEffectiveSale(r);
}

/** Returns the SA who should get credit for this sale, or null if uncredited. */
export function getSaleCreditSa(
  r: SaSaleRunInput,
  bookingsById: Map<string, SaSaleBookingLite>,
): string | null {
  if (!r.linked_intro_booked_id) return null;
  const b = bookingsById.get(r.linked_intro_booked_id);
  return b?.intro_owner?.trim() || null;
}

/** YYYY-MM-DD of the sale's close date in America/Chicago.
 *  getRunSaleDate returns YYYY-MM-DD for buy_date/run_date directly and
 *  splits created_at's ISO date — which is already a calendar date for
 *  CT-anchored writes. */
export function saleCloseYMD(r: SaSaleRunInput): string {
  return getRunSaleDate(r);
}

/** Aggregate SA-countable sales per SA across runs + linked bookings.
 *  Optional [rangeStartYMD, rangeEndYMD] filters by close date (CST). */
export function aggregateSalesBySa(
  runs: SaSaleRunInput[],
  bookings: SaSaleBookingLite[],
  rangeStartYMD?: string,
  rangeEndYMD?: string,
): Map<string, { count: number; runs: Array<{ run: SaSaleRunInput; member: string | null; closeYMD: string }> }> {
  const bookingMap = new Map(bookings.map(b => [b.id, b]));
  const out = new Map<string, { count: number; runs: Array<{ run: SaSaleRunInput; member: string | null; closeYMD: string }> }>();
  for (const r of runs) {
    if (!isSaCountableSale(r)) continue;
    const closeYMD = saleCloseYMD(r);
    if (rangeStartYMD && closeYMD < rangeStartYMD) continue;
    if (rangeEndYMD && closeYMD > rangeEndYMD) continue;
    const sa = getSaleCreditSa(r, bookingMap);
    if (!sa) continue;
    const member = r.linked_intro_booked_id
      ? bookingMap.get(r.linked_intro_booked_id)?.member_name ?? null
      : null;
    const cur = out.get(sa) || { count: 0, runs: [] };
    cur.count += 1;
    cur.runs.push({ run: r, member, closeYMD });
    out.set(sa, cur);
  }
  return out;
}
