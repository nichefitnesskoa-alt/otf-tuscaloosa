import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateNameSimilarity, normalizeNameForComparison, hasPartialNameMatch } from '@/lib/utils';

export interface PotentialMatch {
  id: string;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  booking_status: string | null;
  lead_source: string;
  booked_by: string | null;
  coach_name: string;
  fitness_goal: string | null;
  similarity: number;
  matchType: 'exact' | 'fuzzy' | 'partial';
  warningMessage?: string;
  // NEW: source distinguishes a real booking from a VIP registrant who has no booking yet
  source?: 'booking' | 'vip';
  // VIP-only fields (present when source === 'vip')
  vip_session_id?: string | null;
  vip_class_name?: string | null;
  vip_session_date?: string | null;
  vip_session_time?: string | null;
  vip_status?: string | null;
  phone?: string | null;
  email?: string | null;
}

const EXCLUDED_STATUSES = ['Closed (Purchased)', 'Deleted (soft)', 'Duplicate'];

function getStatusWarning(status: string | null): string | undefined {
  if (!status) return undefined;
  const upperStatus = status.toUpperCase();

  if (upperStatus.includes('ACTIVE')) {
    return 'This client has an active intro scheduled';
  }
  if (upperStatus.includes('2ND INTRO')) {
    return 'This client is scheduled for a 2nd intro';
  }
  if (upperStatus.includes('NOT INTERESTED')) {
    return 'This client was previously marked as not interested';
  }
  if (upperStatus.includes('NO-SHOW') || upperStatus.includes('NO SHOW')) {
    return 'This client previously no-showed';
  }
  return undefined;
}

function classifyMatch(
  inputNormalized: string,
  candidateName: string,
  rawInput: string,
): { matchType: 'exact' | 'fuzzy' | 'partial' | null; similarity: number } {
  const normalizedExisting = normalizeNameForComparison(candidateName);
  const similarity = calculateNameSimilarity(inputNormalized, normalizedExisting);
  const startsWithInput =
    normalizedExisting.startsWith(inputNormalized) ||
    normalizedExisting.split(' ').some(part => part.startsWith(inputNormalized));

  if (similarity === 1) return { matchType: 'exact', similarity };
  if (similarity >= 0.85) return { matchType: 'fuzzy', similarity };
  if (startsWithInput || similarity >= 0.5 || hasPartialNameMatch(rawInput, candidateName)) {
    return { matchType: 'partial', similarity };
  }
  return { matchType: null, similarity };
}

export function useDuplicateDetection() {
  const [isChecking, setIsChecking] = useState(false);
  const [matches, setMatches] = useState<PotentialMatch[]>([]);

  const checkForDuplicates = useCallback(async (name: string): Promise<PotentialMatch[]> => {
    if (!name || name.trim().length < 2) {
      setMatches([]);
      return [];
    }

    setIsChecking(true);

    try {
      const [bookingsRes, vipRes] = await Promise.all([
        supabase
          .from('intros_booked')
          .select('id, member_name, class_date, intro_time, booking_status, lead_source, booked_by, coach_name, fitness_goal')
          .is('deleted_at', null),
        supabase
          .from('vip_registrations')
          .select(`
            id, first_name, last_name, phone, email, vip_session_id, vip_class_name, booking_id,
            vip_sessions:vip_session_id ( session_date, session_time, vip_class_name, reserved_by_group, status )
          ` as any),
      ]);

      if (bookingsRes.error) console.error('Booking duplicate check error:', bookingsRes.error);
      if (vipRes.error) console.error('VIP duplicate check error:', vipRes.error);

      const normalizedInput = normalizeNameForComparison(name);
      const found: PotentialMatch[] = [];
      const bookedVipRegistrationIds = new Set<string>();

      // Bookings
      for (const booking of bookingsRes.data || []) {
        const status = booking.booking_status || '';
        if (EXCLUDED_STATUSES.some(s => status.toUpperCase().includes(s.toUpperCase()))) continue;

        const { matchType, similarity } = classifyMatch(normalizedInput, booking.member_name, name);
        if (!matchType) continue;

        found.push({
          id: booking.id,
          member_name: booking.member_name,
          class_date: booking.class_date,
          intro_time: booking.intro_time,
          booking_status: booking.booking_status,
          lead_source: booking.lead_source,
          booked_by: booking.booked_by,
          coach_name: booking.coach_name,
          fitness_goal: booking.fitness_goal,
          similarity,
          matchType,
          warningMessage: getStatusWarning(booking.booking_status),
          source: 'booking',
        });
      }

      // VIP registrants — skip any that already converted to a booking (we already
      // surfaced that booking above)
      for (const reg of (vipRes.data || []) as any[]) {
        if (reg.booking_id) {
          bookedVipRegistrationIds.add(reg.id);
          continue;
        }
        const fullName = `${reg.first_name || ''} ${reg.last_name || ''}`.trim();
        if (!fullName) continue;

        const { matchType, similarity } = classifyMatch(normalizedInput, fullName, name);
        if (!matchType) continue;

        const session = reg.vip_sessions || {};
        const className = reg.vip_class_name || session.vip_class_name || session.reserved_by_group || 'VIP Class';

        found.push({
          id: reg.id,
          member_name: fullName,
          class_date: session.session_date || '',
          intro_time: session.session_time || null,
          booking_status: 'VIP Registered',
          lead_source: 'VIP Class',
          booked_by: null,
          coach_name: '',
          fitness_goal: null,
          similarity,
          matchType,
          warningMessage: 'Registered for a VIP class — no intro booked yet',
          source: 'vip',
          vip_session_id: reg.vip_session_id,
          vip_class_name: className,
          vip_session_date: session.session_date || null,
          vip_session_time: session.session_time || null,
          phone: reg.phone || null,
          email: reg.email || null,
        });
      }

      // Sort by similarity (highest first), then top 8 (slightly higher to leave room for VIP)
      found.sort((a, b) => b.similarity - a.similarity);
      const topMatches = found.slice(0, 8);
      setMatches(topMatches);
      return topMatches;
    } catch (err) {
      console.error('Error in duplicate detection:', err);
      setMatches([]);
      return [];
    } finally {
      setIsChecking(false);
    }
  }, []);

  const clearMatches = useCallback(() => {
    setMatches([]);
  }, []);

  return {
    checkForDuplicates,
    clearMatches,
    isChecking,
    matches,
  };
}
