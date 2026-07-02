/**
 * Build/parse public /book URLs for the Intro Scheduler Link.
 *
 *   /book?sa=<name>&source=<lead_source>&event_id=<uuid?>
 *   /book?friend_of=<booking_uuid>
 */
export interface IntroLinkParams {
  sa: string;
  source: string;             // e.g. 'Intro Scheduler Link' | 'Event' | 'Instagram DMs'
  eventId?: string | null;
}

export function buildIntroLinkUrl(base: string, p: IntroLinkParams): string {
  const url = new URL('/book', base);
  url.searchParams.set('sa', p.sa);
  url.searchParams.set('source', p.source);
  if (p.eventId) url.searchParams.set('event_id', p.eventId);
  return url.toString();
}

export function buildFriendLinkUrl(base: string, originatorBookingId: string): string {
  const url = new URL('/book', base);
  url.searchParams.set('friend_of', originatorBookingId);
  return url.toString();
}

/** Given a non-friend source, return the "(Friend)" variant used by the friend flow. */
export function friendSourceFor(source: string): string {
  if (source.endsWith('(Friend)')) return source;
  if (source === 'Intro Scheduler Link') return 'Intro Scheduler Link (Friend)';
  if (source === 'Event') return 'Event'; // Events stay Event; friend inherits event_id
  // For other sources (IG DMs, Member Referral, etc.) append the standard (Friend) suffix
  return `${source} (Friend)`;
}
