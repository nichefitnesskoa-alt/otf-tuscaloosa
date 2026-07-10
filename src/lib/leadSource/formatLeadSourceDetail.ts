/**
 * Canonical inline "Lead Source · Detail" formatter.
 *
 * Everywhere the app renders a lead_source on a card, drill-down, or drawer,
 * use this helper so the referrer / business partner / event / outreach detail
 * captured in the follow-up dropdown is visible at a glance.
 *
 * Detail resolution:
 *   - Referral-like sources (Member Referral, Buddy Card, Milestone, Coach,
 *     Business Partnership Referral, any "(Friend)" variant) → referred_by_member_name
 *   - Event / Self Generated Lead (+ Friend) → event name (with date for
 *     activity_type='event', no date for 'general_outreach')
 *   - Everything else → no detail
 */
import {
  isReferralLikeSource,
  isBusinessPartnershipReferralSource,
  isEventOrOutreachSource,
} from '@/lib/sa/leadsBooked';

export interface LeadSourceDetailInput {
  lead_source: string | null | undefined;
  referred_by_member_name?: string | null;
  event_id?: string | null;
}

export interface EventLookupEntry {
  name: string;
  event_date: string | null;
  activity_type: 'event' | 'general_outreach';
}

export type EventLookup = Map<string, EventLookupEntry> | Record<string, EventLookupEntry> | null | undefined;

function readEvent(lookup: EventLookup, id: string): EventLookupEntry | undefined {
  if (!lookup) return undefined;
  if (lookup instanceof Map) return lookup.get(id);
  return (lookup as Record<string, EventLookupEntry>)[id];
}

function formatShortDate(ymd: string | null | undefined): string | null {
  if (!ymd) return null;
  const parts = ymd.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

export interface LeadSourceDetailResult {
  /** The source label, unchanged. Falsy → empty string. */
  label: string;
  /** The dropdown detail (referrer name / event name / etc). Null if none. */
  detail: string | null;
  /** Convenience: "Label · Detail" or just "Label". */
  combined: string;
}

export function formatLeadSourceDetail(
  input: LeadSourceDetailInput,
  events?: EventLookup,
): LeadSourceDetailResult {
  const label = input.lead_source || '';
  let detail: string | null = null;

  if (isEventOrOutreachSource(label) && input.event_id) {
    const ev = readEvent(events, input.event_id);
    if (ev) {
      const date = ev.activity_type === 'event' ? formatShortDate(ev.event_date) : null;
      detail = date ? `${ev.name} (${date})` : ev.name;
    }
  } else if (
    (isReferralLikeSource(label) || isBusinessPartnershipReferralSource(label)) &&
    input.referred_by_member_name
  ) {
    detail = input.referred_by_member_name.trim() || null;
  }

  return {
    label,
    detail,
    combined: detail ? `${label} · ${detail}` : label,
  };
}

/** Build a lookup Map from an array of event rows returned by useEvents(). */
export function buildEventLookup(
  rows: Array<{ id: string; name: string; event_date: string | null; activity_type: 'event' | 'general_outreach' }> | null | undefined,
): Map<string, EventLookupEntry> {
  const map = new Map<string, EventLookupEntry>();
  if (!rows) return map;
  for (const r of rows) {
    map.set(r.id, {
      name: r.name,
      event_date: r.event_date,
      activity_type: r.activity_type,
    });
  }
  return map;
}
