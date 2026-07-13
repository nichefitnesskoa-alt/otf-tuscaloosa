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
  // Any "(Friend)" variant is ALWAYS self-generated — an SA got a member/friend
  // to bring someone in, which is itself the self-generated action, regardless
  // of the base source (Lead Management, OIO, Intro Scheduler Link, etc.).
  // This override runs FIRST, before any exclusion-list check.
  if (source.trim().endsWith('(Friend)')) return true;
  return !EXCLUDED_LEAD_SOURCES.has(source);
}

/** Sources where the lead was referred by an existing member / friend and
 *  therefore should capture a referring-member name AND route into the SOML
 *  referral pipeline. Single source of truth used by the log-a-lead form and
 *  the soml_create_pending_referral trigger. */
const REFERRAL_LIKE_EXPLICIT = new Set<string>([
  'Member Referral',
  'Member Referral (3 class pack)',
  'Business Partnership Referral',
  'My Personal Friend I Invited',
]);

export const BUSINESS_PARTNERSHIP_REFERRAL_SOURCE = 'Business Partnership Referral';

export function isBusinessPartnershipReferralSource(source: string | null | undefined): boolean {
  return source === BUSINESS_PARTNERSHIP_REFERRAL_SOURCE;
}

/**
 * Event / Self Generated Lead sources — both the base source and the "(Friend)"
 * variant. Any lead source that starts with this label uses the Outreach
 * Activity picker (dated event OR general outreach with no date).
 */
export const EVENT_OUTREACH_SOURCE = 'Event / Self Generated Lead';
export const EVENT_OUTREACH_FRIEND_SOURCE = 'Event / Self Generated Lead (Friend)';

export function isEventOrOutreachSource(source: string | null | undefined): boolean {
  if (!source) return false;
  return source === EVENT_OUTREACH_SOURCE || source === EVENT_OUTREACH_FRIEND_SOURCE;
}

export function isReferralLikeSource(source: string | null | undefined): boolean {
  if (!source) return false;
  if (REFERRAL_LIKE_EXPLICIT.has(source)) return true;
  return source.endsWith('(Friend)');
}

const VIP_LEAD_SOURCES = new Set<string>([
  'VIP Class',
  'VIP Class (Friend)',
]);

/** Sources where no SA did the booking work — member booked themselves online.
 *  Excluded from the "Booked" column (SA Booked = bookings an SA was
 *  responsible for). Lead Management is NOT here — an SA still works and
 *  books those. */
export const NO_SA_RESPONSIBLE_SOURCES = new Set<string>([
  'Online Intro Offer (self-booked)',
]);

/** Canonical predicate: was an SA responsible for booking this intro?
 *  False for self-booked Online Intro Offer (member did everything). */
export function isSaResponsibleBooking(b: { lead_source: string | null }): boolean {
  if (!b.lead_source) return true;
  return !NO_SA_RESPONSIBLE_SOURCES.has(b.lead_source);
}

/** Phantom booked_by values that are NOT real people — never credit them on the
 *  leaderboard. If these appear, the booking is treated as unattributed and
 *  hidden until a real SA is assigned. Safety net for legacy/import artifacts. */
export const PHANTOM_BOOKED_BY = new Set<string>([
  'System (Auto-Import)',
  'System (Sheet Import)',
  'Self (VIP Form)',
  'Self-booked',
  'Self booked',
  'AM Shift',
  'Unknown',
  'TBD',
]);

/** Placeholder sourced_by_sa values that represent inbound channels rather
 *  than a real SA. They appear in the Self-Sourced Leads dialog as their
 *  own group so someone can claim them, but never appear on the WIG SA
 *  leaderboard (which iterates active staff). */
export const PLACEHOLDER_SOURCED_BY = new Set<string>([
  'Buddy Card',
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

/**
 * Aggregate ALL booked intros per SA (inbound + sourced) — used by the
 * "Booked" column on the SA Leaderboard. Differs from `aggregateLeadsBookedBySa`
 * only in that the source predicate is NOT applied; phantom credit names and
 * soft-deleted / ignored rows are still filtered.
 */
export function aggregateAllBookedBySa(
  bookings: LeadBookedBookingInput[],
  vipSessions: VipSessionLite[],
): Map<string, { count: number; bookings: LeadBookedBookingInput[] }> {
  const sessionMap = new Map(vipSessions.map(s => [s.id, s]));
  const out = new Map<string, { count: number; bookings: LeadBookedBookingInput[] }>();
  for (const b of bookings) {
    if (b.deleted_at) continue;
    if (b.ignore_from_metrics) continue;
    if (!isSaResponsibleBooking(b)) continue; // self-booked OIO → no SA credit
    const sa = getLeadBookedCreditSa(b, sessionMap);
    if (!sa) continue;
    const cur = out.get(sa) || { count: 0, bookings: [] };
    cur.count += 1;
    cur.bookings.push(b);
    out.set(sa, cur);
  }
  return out;
}
