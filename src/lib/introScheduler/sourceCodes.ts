/**
 * Canonical LEAD_SOURCE → tiny integer code map for short scheduler URLs.
 * Numbers are fixed forever; new sources append with the next unused integer.
 */
import { LEAD_SOURCES } from '@/types';

export const SOURCE_CODE_MAP: Record<string, number> = {
  'Intro Scheduler Link': 1,
  'Instagram DMs': 2,
  'Event': 3,
  'Member Referral': 4,
  'Member Referral (3 class pack)': 5,
  'Business Partnership Referral': 6,
  'My Personal Friend I Invited': 7,
  'VIP Class': 8,
  'Lead Management': 9,
  'Online Intro Offer (self-booked)': 10,
  'Intro Scheduler Link (Friend)': 11,
  'Instagram DMs (Friend)': 12,
  'VIP Class (Friend)': 13,
  'Lead Management (Friend)': 14,
  'Online Intro Offer (Friend)': 15,
  'Walk-in': 16,
  'Walk-in (Friend)': 17,
};

export function codeForSource(source: string): number {
  return SOURCE_CODE_MAP[source] ?? 1;
}

export function sourceForCode(n: number): string | null {
  const entry = Object.entries(SOURCE_CODE_MAP).find(([, v]) => v === n);
  return entry ? entry[0] : null;
}

/** Sanity check — every LEAD_SOURCES value has a code. */
export function assertAllSourcesMapped() {
  const missing = (LEAD_SOURCES as readonly string[]).filter(s => !(s in SOURCE_CODE_MAP));
  if (missing.length) console.warn('[sourceCodes] Missing codes for:', missing);
}
