/**
 * Person resolver for the Journey card.
 *
 * Multi-strategy UNION matcher. Resolves "a person" → every
 * intros_booked row that belongs to them, across multiple chains.
 * No persons table exists; we match by:
 *
 *   1. Normalized phone (10-digit) — strongest
 *   2. Normalized email (lowercased + trimmed)
 *   3. Normalized member_name — used IN ADDITION to phone/email,
 *      with a guard: name-only candidates whose phone or email
 *      disagree with the seed are rejected.
 *
 * All strategies run independently and their results are UNIONed.
 * Having a phone on the seed never blocks email or name strategies
 * (the previous behavior — and the source of "0 intros" popups
 * when stored phones were formatted as "(217) 586-7614" while the
 * query searched for "2175867614").
 */
import { supabase } from '@/integrations/supabase/client';
import { stripCountryCode } from '@/lib/parsing/phone';

export interface PersonIdentifier {
  /** If passed, used as the seed booking — its phone/email/name drive the search. */
  bookingId?: string;
  /** If passed (and no bookingId), seeds from the leads row. */
  leadId?: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

export type PersonMatchMethod = 'phone' | 'email' | 'name_only' | 'seed_only';

export interface PersonResolution {
  identity: {
    name: string | null;
    phone10: string | null;
    emailNorm: string | null;
  };
  /** All matched intros_booked IDs (sorted: oldest first). */
  bookingIds: string[];
  /** True when the only matches came via name (no phone/email confirmation). */
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

type Candidate = {
  id: string;
  created_at: string;
  phone10: string | null;
  emailNorm: string | null;
  nameNorm: string | null;
  via: 'phone' | 'email' | 'name';
};

export async function resolvePerson(
  id: PersonIdentifier,
): Promise<PersonResolution> {
  // Step 1 — gather seed identity from booking, lead, or raw fields.
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
      seedPhone10 = stripCountryCode((seed as any).phone_e164 || (seed as any).phone) || seedPhone10;
      seedEmail = normEmail((seed as any).email) || seedEmail;
    }
  } else if (id.leadId) {
    const { data: seed } = await supabase
      .from('leads')
      .select('first_name, last_name, phone, email')
      .eq('id', id.leadId)
      .maybeSingle();
    if (seed) {
      const full = `${(seed as any).first_name || ''} ${(seed as any).last_name || ''}`.trim();
      seedName = full || seedName;
      seedPhone10 = stripCountryCode((seed as any).phone) || seedPhone10;
      seedEmail = normEmail((seed as any).email) || seedEmail;
    }
  }

  const seedNameNorm = normName(seedName);
  const identity = {
    name: seedName,
    phone10: seedPhone10,
    emailNorm: seedEmail,
  };

  // Step 2 — run every applicable strategy in parallel; UNION results.
  const candidates = new Map<string, Candidate>();
  const upsert = (row: any, via: Candidate['via']) => {
    const c: Candidate = {
      id: row.id,
      created_at: row.created_at,
      phone10: stripCountryCode(row.phone_e164 || row.phone),
      emailNorm: normEmail(row.email),
      nameNorm: normName(row.member_name),
      via,
    };
    const existing = candidates.get(c.id);
    // Prefer the strongest via for reporting.
    const rank = { phone: 3, email: 2, name: 1 } as const;
    if (!existing || rank[via] > rank[existing.via]) candidates.set(c.id, c);
  };

  const queries: Promise<unknown>[] = [];

  if (seedPhone10) {
    const e164 = `+1${seedPhone10}`;
    const last4 = seedPhone10.slice(-4);
    queries.push(
      supabase
        .from('intros_booked')
        .select('id, created_at, member_name, phone, phone_e164, email')
        .or(`phone_e164.eq.${e164},phone.ilike.%${last4}%`)
        .then(({ data }) => {
          for (const r of data || []) {
            const ten = stripCountryCode((r as any).phone_e164 || (r as any).phone);
            if (ten === seedPhone10) upsert(r, 'phone');
          }
        }),
    );
  }

  if (seedEmail) {
    queries.push(
      supabase
        .from('intros_booked')
        .select('id, created_at, member_name, phone, phone_e164, email')
        .ilike('email', seedEmail)
        .then(({ data }) => {
          for (const r of data || []) {
            if (normEmail((r as any).email) === seedEmail) upsert(r, 'email');
          }
        }),
    );
  }

  if (seedNameNorm) {
    queries.push(
      supabase
        .from('intros_booked')
        .select('id, created_at, member_name, phone, phone_e164, email')
        .ilike('member_name', seedName!.trim())
        .then(({ data }) => {
          for (const r of data || []) {
            if (normName((r as any).member_name) !== seedNameNorm) continue;
            const rPhone = stripCountryCode((r as any).phone_e164 || (r as any).phone);
            const rEmail = normEmail((r as any).email);
            // Risk control: if candidate has a phone/email that contradicts
            // the seed's phone/email, treat as a different person.
            if (seedPhone10 && rPhone && rPhone !== seedPhone10) continue;
            if (seedEmail && rEmail && rEmail !== seedEmail) continue;
            upsert(r, 'name');
          }
        }),
    );
  }

  await Promise.all(queries);

  // Step 3 — always include the seed booking itself.
  if (id.bookingId && !candidates.has(id.bookingId)) {
    candidates.set(id.bookingId, {
      id: id.bookingId,
      created_at: '',
      phone10: seedPhone10,
      emailNorm: seedEmail,
      nameNorm: seedNameNorm,
      via: 'name',
    });
  }

  const all = Array.from(candidates.values());
  const hasPhoneOrEmailMatch = all.some(c => c.via === 'phone' || c.via === 'email');
  const seedHasStrongId = !!(seedPhone10 || seedEmail);
  const nameOnlyMatch = all.length > 0 && !hasPhoneOrEmailMatch && !seedHasStrongId;

  let method: PersonMatchMethod = 'seed_only';
  if (all.some(c => c.via === 'phone')) method = 'phone';
  else if (all.some(c => c.via === 'email')) method = 'email';
  else if (all.some(c => c.via === 'name')) method = nameOnlyMatch ? 'name_only' : 'name_only';

  const bookingIds = all
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
    .map(c => c.id);

  return { identity, bookingIds, nameOnlyMatch, method };
}
