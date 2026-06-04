/**
 * Canonical helper: self-generated leads booked per SA.
 *
 * Single source of truth for the SA "leads booked" metric used by:
 *   - WIG SA leaderboard (tile + per-SA column)
 *   - (future) Own It / per-SA detail
 *
 * Definition of a self-generated lead booked:
 *   A row in intros_booked whose lead_source is NOT in EXCLUDED_LEAD_SOURCES,
 *   is not soft-deleted, and is not ignore_from_metrics.
 *
 * Attribution (each booking counts exactly ONCE):
 *   - VIP Class / VIP Class (Friend) booking tied to a vip_session → credit
 *     the session's sa_setup_name (NOT booked_by). If unset, uncredited.
 *   - All other sources → credit booked_by.
 *
 * Week boundary: Monday-start, America/Chicago.
 * Date field for "when the lead was booked": intros_booked.created_at.
 */

/** Exactly two sources are excluded — both "bare/no-effort" sources.
 *  Every "(Friend)" variant counts IN because an SA brought that friend in. */
export const EXCLUDED_LEAD_SOURCES = new Set<string>([
  'Lead Management',
  'Online Intro Offer (self-booked)',
]);

/**
 * Canonical predicate: does this lead_source string count as "self-sourced
 * by an SA"? Used by BOTH the booked-SGL path (intros_booked aggregation)
 * AND the un-booked-leads path (leads table aggregation) so the two surfaces
 * always agree on what counts as self-sourced. A null/blank source is treated
 * as NOT self-sourced (unknown provenance).
 */
export function isSelfSourcedLeadSource(source: string | null | undefined): boolean {
  if (!source) return false;
  return !EXCLUDED_LEAD_SOURCES.has(source);
}

const VIP_LEAD_SOURCES = new Set<string>([
  'VIP Class',
  'VIP Class (Friend)',
]);

/** Phantom booked_by values that are NOT real people — never credit them on the
 *  leaderboard. If these appear, the booking is treated as unattributed and
 *  hidden until a real SA is assigned. Safety net for legacy/import artifacts. */
export const PHANTOM_BOOKED_BY = new Set<string>([
  'System (Auto-Import)',
  'Self (VIP Form)',
  'Self-booked',
  'Self booked',
  'Unknown',
  'TBD',
]);

export interface LeadBookedBookingInput {
  id: string;
  lead_source: string | null;
  booked_by: string | null;
  vip_session_id: string | null;
  created_at: string;
  deleted_at?: string | null;
  ignore_from_metrics?: boolean | null;
  member_name?: string | null;
}

export interface VipSessionLite {
  id: string;
  sa_setup_name: string | null;
}

/** Pure predicate: does this row qualify as a self-generated lead booked? */
export function isSelfGeneratedLeadBooked(b: LeadBookedBookingInput): boolean {
  if (!b.lead_source) return false;
  if (b.deleted_at) return false;
  if (b.ignore_from_metrics) return false;
  return !EXCLUDED_LEAD_SOURCES.has(b.lead_source);
}

/** Returns the SA who should get credit for this booking, or null if uncredited. */
export function getLeadBookedCreditSa(
  b: LeadBookedBookingInput,
  vipSessionsById: Map<string, VipSessionLite>,
): string | null {
  if (b.lead_source && VIP_LEAD_SOURCES.has(b.lead_source) && b.vip_session_id) {
    const sess = vipSessionsById.get(b.vip_session_id);
    const name = sess?.sa_setup_name?.trim() || null;
    if (!name || PHANTOM_BOOKED_BY.has(name)) return null;
    return name;
  }
  const raw = b.booked_by?.trim() || null;
  if (!raw || PHANTOM_BOOKED_BY.has(raw)) return null;
  return raw;
}

/** YYYY-MM-DD of the booking's created_at in America/Chicago. */
export function bookingCentralYMD(createdAtIso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(createdAtIso));
  const get = (t: string) => parts.find(p => p.type === t)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Aggregate self-generated leads booked per SA across a set of bookings. */
export function aggregateLeadsBookedBySa(
  bookings: LeadBookedBookingInput[],
  vipSessions: VipSessionLite[],
): Map<string, { count: number; bookings: LeadBookedBookingInput[] }> {
  const sessionMap = new Map(vipSessions.map(s => [s.id, s]));
  const out = new Map<string, { count: number; bookings: LeadBookedBookingInput[] }>();
  for (const b of bookings) {
    if (!isSelfGeneratedLeadBooked(b)) continue;
    const sa = getLeadBookedCreditSa(b, sessionMap);
    if (!sa) continue;
    const cur = out.get(sa) || { count: 0, bookings: [] };
    cur.count += 1;
    cur.bookings.push(b);
    out.set(sa, cur);
  }
  return out;
}
