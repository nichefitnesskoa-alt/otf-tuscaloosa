/**
 * Person resolver for the Journey card.
 *
 * Resolves "a person" → every intros_booked row that belongs to them,
 * across multiple chains. No persons table exists; we match by:
 *
 *   1. Normalized phone (10-digit) — strongest
 *   2. Normalized email (lowercased + trimmed)
 *   3. member_name match — used ONLY when both sides lack phone and
 *      email. Caller surfaces a "matched by name only — verify same
 *      person" badge so name collisions stay visible.
 *
 * Returns the union of all matched bookings plus the method used.
 */
import { supabase } from '@/integrations/supabase/client';
import { stripCountryCode } from '@/lib/parsing/phone';

export interface PersonIdentifier {
  /** If passed, used as the seed booking — its phone/email/name drive the search. */
  bookingId?: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

export type PersonMatchMethod = 'phone' | 'email' | 'name_only' | 'seed_only';

export interface PersonResolution {
  /** Normalized seed identity used to find matches. */
  identity: {
    name: string | null;
    phone10: string | null;
    emailNorm: string | null;
  };
  /** All matched intros_booked IDs (sorted: oldest first). */
  bookingIds: string[];
  /** True when we had to fall back to name-only matching (no phone or
   *  email on either side). Surface a "verify same person" badge. */
  nameOnlyMatch: boolean;
  /** Strongest method that produced matches. */
  method: PersonMatchMethod;
}

function normEmail(e: string | null | undefined): string | null {
  if (!e) return null;
  const t = e.trim().toLowerCase();
  return t.length > 0 ? t : null;
}

function normName(n: string | null | undefined): string | null {
  if (!n) return null;
  const t = n.trim().toLowerCase().replace(/\s+/g, ' ');
  return t.length > 0 ? t : null;
}

export async function resolvePerson(
  id: PersonIdentifier,
): Promise<PersonResolution> {
  // Step 1 — gather seed identity. If a bookingId is provided, prefer its
  // stored contact info (more reliable than free-form name).
  let seedName = id.name || null;
  let seedPhone10: string | null = stripCountryCode(id.phone || null);
  let seedEmail: string | null = normEmail(id.email);

  if (id.bookingId) {
    const { data: seed } = await supabase
      .from('intros_booked')
      .select('member_name, phone, phone_e164, email')
      .eq('id', id.bookingId)
      .maybeSingle();
    if (seed) {
      seedName = seed.member_name ?? seedName;
      seedPhone10 = stripCountryCode(seed.phone_e164 || seed.phone) || seedPhone10;
      seedEmail = normEmail(seed.email) || seedEmail;
    }
  }

  const identity = {
    name: seedName,
    phone10: seedPhone10,
    emailNorm: seedEmail,
  };

  // Step 2 — fetch candidate rows by phone OR email first.
  const matched = new Map<string, { id: string; created_at: string }>();
  let methodUsed: PersonMatchMethod = 'seed_only';

  if (seedPhone10) {
    // Match against phone_e164 (+1XXXXXXXXXX) and raw phone (digits only).
    const e164 = `+1${seedPhone10}`;
    const { data: byPhone } = await supabase
      .from('intros_booked')
      .select('id, created_at, phone, phone_e164')
      .or(`phone_e164.eq.${e164},phone.ilike.%${seedPhone10}%`);
    for (const r of byPhone || []) {
      const ten = stripCountryCode((r as any).phone_e164 || (r as any).phone);
      if (ten === seedPhone10) matched.set(r.id, { id: r.id, created_at: (r as any).created_at });
    }
    if (matched.size > 0) methodUsed = 'phone';
  }

  if (seedEmail) {
    const { data: byEmail } = await supabase
      .from('intros_booked')
      .select('id, created_at, email')
      .ilike('email', seedEmail);
    for (const r of byEmail || []) {
      if (normEmail((r as any).email) === seedEmail) {
        if (!matched.has(r.id)) matched.set(r.id, { id: r.id, created_at: (r as any).created_at });
      }
    }
    if (methodUsed === 'seed_only' && matched.size > 0) methodUsed = 'email';
  }

  // Step 3 — name fallback. ONLY used when neither side has phone/email.
  // We still scope by exact (case-insensitive) member_name and verify the
  // matched rows themselves also lack phone+email — otherwise the name
  // match overlaps with stronger matches we'd have caught above and we
  // skip it.
  let nameOnlyMatch = false;
  if (matched.size === 0 && seedName && !seedPhone10 && !seedEmail) {
    const { data: byName } = await supabase
      .from('intros_booked')
      .select('id, created_at, member_name, phone, phone_e164, email')
      .ilike('member_name', seedName);
    for (const r of byName || []) {
      const rPhone = stripCountryCode((r as any).phone_e164 || (r as any).phone);
      const rEmail = normEmail((r as any).email);
      if (!rPhone && !rEmail && normName((r as any).member_name) === normName(seedName)) {
        matched.set(r.id, { id: r.id, created_at: (r as any).created_at });
        nameOnlyMatch = true;
      }
    }
    if (matched.size > 0) methodUsed = 'name_only';
  }

  // Step 4 — always include the seed booking itself.
  if (id.bookingId && !matched.has(id.bookingId)) {
    matched.set(id.bookingId, { id: id.bookingId, created_at: '' });
  }

  const bookingIds = Array.from(matched.values())
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
    .map(r => r.id);

  return { identity, bookingIds, nameOnlyMatch, method: methodUsed };
}
