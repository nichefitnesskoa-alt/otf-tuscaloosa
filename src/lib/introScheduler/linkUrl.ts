/**
 * Build/parse public booking URLs for the Intro Scheduler Link.
 *
 * Short (new, preferred):
 *   /book-intro/<code>              → resolves via public.intro_link_codes
 *   /book-intro/<code>-<eventShort> → same, tags to a specific event
 *   /book-intro/f/<friendCode>      → friend flow (looks up intros_booked.friend_code)
 *
 * Long (legacy, still supported forever for QRs already in the wild):
 *   /book?sa=<name>&source=<lead_source>&event_id=<uuid?>
 *   /book?friend_of=<booking_uuid>
 */
import { supabase } from '@/integrations/supabase/client';
import { codeForSource } from './sourceCodes';

export interface IntroLinkParams {
  sa: string;
  source: string;
  eventId?: string | null;
}

/** Legacy long URL (kept so already-printed QRs never break). */
export function buildIntroLinkUrl(base: string, p: IntroLinkParams): string {
  const url = new URL('/book', base);
  url.searchParams.set('sa', p.sa);
  url.searchParams.set('source', p.source);
  if (p.eventId) url.searchParams.set('event_id', p.eventId);
  return url.toString();
}

/** Legacy long friend URL (kept for compatibility). */
export function buildFriendLinkUrl(base: string, originatorBookingId: string): string {
  const url = new URL('/book', base);
  url.searchParams.set('friend_of', originatorBookingId);
  return url.toString();
}

/** New short friend URL: /book-intro/f/<friend_code>. */
export function buildShortFriendUrl(base: string, friendCode: string): string {
  return new URL(`/book-intro/f/${friendCode}`, base).toString();
}

/** New short SA link URL: /book-intro/<code>. */
export function buildShortIntroUrl(base: string, code: string): string {
  return new URL(`/book-intro/${code}`, base).toString();
}

/** Given a non-friend source, return the "(Friend)" variant used by the friend flow. */
export function friendSourceFor(source: string): string {
  if (source.endsWith('(Friend)')) return source;
  if (source === 'Intro Scheduler Link') return 'Intro Scheduler Link (Friend)';
  if (source === 'Event') return 'Event';
  return `${source} (Friend)`;
}

/* --------------------- SA slug allocation --------------------- */

function firstInitial(name: string): string {
  const c = (name.trim()[0] || 'x').toLowerCase();
  return /[a-z0-9]/.test(c) ? c : 'x';
}

/**
 * Reserve (or reuse) a short code for this SA + source (+ event).
 *
 * Idempotent: same SA + same source + same event → same code forever.
 * Format: <saSlug><sourceCode>[-<eventShort>] e.g. "k1", "k3-a1b2", "b7".
 */
export async function ensureIntroLinkCode(params: {
  saName: string;
  source: string;
  eventId?: string | null;
}): Promise<string> {
  const { saName, source, eventId } = params;
  const eid = eventId ?? null;

  // 1. Already provisioned? Return it.
  const found = await (eid
    ? supabase.from('intro_link_codes' as any).select('code').eq('sa_name', saName).eq('source', source).eq('event_id', eid).maybeSingle()
    : supabase.from('intro_link_codes' as any).select('code').eq('sa_name', saName).eq('source', source).is('event_id', null).maybeSingle());
  if ((found as any).data?.code) return (found as any).data.code as string;

  // 2. Compute SA slug — first initial, plus a collision counter if that initial
  //    is already used by a DIFFERENT SA in the codes table.
  const initial = firstInitial(saName);
  const { data: sameInitialRows } = await supabase
    .from('intro_link_codes' as any)
    .select('code, sa_name')
    .ilike('code', `${initial}%`);

  const initialToSa = new Map<string, string>(); // saSlug → sa_name
  for (const row of (sameInitialRows as any[]) || []) {
    const code: string = row.code;
    // Extract leading letter+optional digits before the source number.
    // codes look like: [a-z][optional digits][source #][-eventShort?]
    // slug = the letter + trailing digits BEFORE the last block of digits that is the source number.
    const m = code.match(/^([a-z])(\d*)(\d+)(?:-.+)?$/);
    if (!m) continue;
    const letter = m[1];
    const collisionDigits = m[2]; // may be empty
    const slug = `${letter}${collisionDigits}`;
    if (!initialToSa.has(slug)) initialToSa.set(slug, row.sa_name);
  }

  let saSlug: string | null = null;
  // Reuse existing slug if this SA already owns one
  for (const [slug, name] of initialToSa.entries()) {
    if (name === saName) { saSlug = slug; break; }
  }
  if (!saSlug) {
    // Pick the smallest unused: prefer bare initial, then initial+2, +3, ...
    if (![...initialToSa.keys()].includes(initial)) {
      saSlug = initial;
    } else {
      let n = 2;
      while (initialToSa.has(`${initial}${n}`)) n++;
      saSlug = `${initial}${n}`;
    }
  }

  // 3. Look up event short code if needed
  let eventShort: string | null = null;
  if (eid) {
    const { data: ev } = await supabase.from('events').select('short_code').eq('id', eid).maybeSingle();
    eventShort = (ev as any)?.short_code || null;
  }

  const srcNum = codeForSource(source);
  const baseCode = `${saSlug}${srcNum}${eventShort ? `-${eventShort}` : ''}`;

  // 4. Insert. Unique(sa_name, source, event_id) guarantees no duplicates on race.
  const { error: insErr, data: inserted } = await supabase
    .from('intro_link_codes' as any)
    .insert({ code: baseCode, sa_name: saName, source, event_id: eid })
    .select('code')
    .maybeSingle();

  if (!insErr && (inserted as any)?.code) return (inserted as any).code;

  // Race / conflict — re-read
  const retry = await (eid
    ? supabase.from('intro_link_codes' as any).select('code').eq('sa_name', saName).eq('source', source).eq('event_id', eid).maybeSingle()
    : supabase.from('intro_link_codes' as any).select('code').eq('sa_name', saName).eq('source', source).is('event_id', null).maybeSingle());
  return (retry as any).data?.code || baseCode;
}

/** Resolve a short code → { sa, source, eventId }. Returns null if not found. */
export async function resolveIntroLinkCode(code: string): Promise<IntroLinkParams | null> {
  const { data } = await supabase
    .from('intro_link_codes' as any)
    .select('sa_name, source, event_id')
    .eq('code', code)
    .maybeSingle();
  if (!data) return null;
  const d = data as any;
  return { sa: d.sa_name, source: d.source, eventId: d.event_id };
}

/** Resolve a friend short code → originator booking id. */
export async function resolveFriendCode(friendCode: string): Promise<string | null> {
  const { data } = await (supabase.from('intros_booked') as any)
    .select('id')
    .eq('friend_code', friendCode)
    .maybeSingle();
  return (data as any)?.id || null;
}

/** Ensure a friend short code exists on a booking, returning it. */
export async function ensureFriendCode(bookingId: string): Promise<string> {
  const { data: existing } = await (supabase.from('intros_booked') as any)
    .select('friend_code')
    .eq('id', bookingId)
    .maybeSingle();
  const cur = (existing as any)?.friend_code;
  if (cur) return cur;
  const { data } = await (supabase.rpc as any)('gen_intro_friend_code', { _id: bookingId });
  return (data as any) || '';
}
