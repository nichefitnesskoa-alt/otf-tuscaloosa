/**
 * Canonical predicate + types for the "self-sourced leads waiting to be
 * texted" surface (My Day card + Follow-Up section).
 *
 * A self-sourced lead is "awaiting first text" when:
 *   - sourced_by_sa is set (real SA, not a phantom name)
 *   - booked_intro_id is null (not yet converted to a booking)
 *   - text_archived_at is null (not marked dead by an SA)
 *
 * Booking conversion is handled by the existing
 * `auto_link_self_sourced_lead_to_booking` trigger, which flips
 * booked_intro_id + stage='booked' when a booking comes in with a matching
 * phone — so we don't need to listen to intros_booked here.
 */
import { PHANTOM_BOOKED_BY } from './leadsBooked';

export interface SourcedLeadRow {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  source: string | null;
  sourced_by_sa: string | null;
  booked_intro_id: string | null;
  text_archived_at: string | null;
  text_archived_reason?: string | null;
  created_at: string;
}

export function isLeadAwaitingFirstText(l: SourcedLeadRow): boolean {
  if (!l.sourced_by_sa) return false;
  if (l.booked_intro_id) return false;
  if (l.text_archived_at) return false;
  if (PHANTOM_BOOKED_BY.has(l.sourced_by_sa)) return false;
  return true;
}

export function fullName(l: SourcedLeadRow): string {
  return `${l.first_name || ''} ${l.last_name || ''}`.trim() || 'Unknown';
}

/** Days since the lead was logged (UTC-fine — purely for display nudging). */
export function daysSinceLogged(l: SourcedLeadRow): number {
  const created = new Date(l.created_at).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
}
